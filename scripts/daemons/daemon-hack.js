/**
 * Bitburner AI - Hack Daemon v2.0
 * Système de hacking HWGW (Hack-Weaken-Grow-Weaken) avec Proto-Batching
 * 
 * Améliorations v2.0:
 * - Proto-batching: Multiple batches en pipeline
 * - Pool de cibles: Prépare plusieurs serveurs en parallèle
 * - Distribution RAM optimisée: Gros serveurs d'abord
 * - Timing précis avec Formulas.exe si disponible
 * - Feedback vers l'optimizer
 * 
 * Usage: run daemon-hack.js
 */

import { HACK_CONFIG, WORKER_RAM } from "../lib/constants.js";
import {
    scanAll,
    getRootAccess,
    canHack,
    getAvailableRam,
    formatMoney,
    formatTime,
    formatRam,
} from "../lib/utils.js";
import { getState, setState, sendFeedback, detectPhase } from "../lib/brain-state.js";

// Chemins des workers
const WORKERS = {
    hack: "/workers/hack.js",
    grow: "/workers/grow.js",
    weaken: "/workers/weaken.js",
};

// Configuration proto-batching
const PROTO_CONFIG = {
    BATCH_SPACING: 200,        // ms entre batches
    MAX_BATCHES: 100,          // Batches simultanés max
    TARGET_POOL_SIZE: 3,       // Nombre de cibles préparées
    MIN_BATCH_RAM: 50,         // RAM minimum pour un batch
};

// Config dynamique (sera mise à jour depuis l'optimizer)
let dynamicConfig = null;
let batchId = 0;

/**
 * Lire la configuration de l'optimizer
 */
function loadOptimizerConfig(ns) {
    try {
        const data = ns.read("/data/optimizer-config.txt");
        if (data && data.length > 0) {
            dynamicConfig = JSON.parse(data);
            return true;
        }
    } catch (e) { }
    return false;
}

/**
 * Obtenir une valeur de config (dynamique ou statique)
 */
function getConfig(key) {
    if (dynamicConfig && dynamicConfig[key] !== undefined) {
        return dynamicConfig[key];
    }
    const keyMap = {
        hackPercent: "HACK_PERCENT",
        securityThreshold: "SECURITY_THRESHOLD",
        moneyThreshold: "MONEY_THRESHOLD",
        batchDelay: "BATCH_DELAY",
    };
    return HACK_CONFIG[keyMap[key]] || HACK_CONFIG[key];
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const startTime = Date.now();
    let batchCount = 0;
    let totalStolen = 0;
    let lastFeedbackTime = 0;

    ns.print("═══════════════════════════════════════");
    ns.print("  🤖 BITBURNER AI - HACK DAEMON v2.0");
    ns.print("═══════════════════════════════════════");

    // Boucle principale
    while (true) {
        // Recharger la config de l'optimizer
        loadOptimizerConfig(ns);

        // Mettre à jour l'état global
        const phase = detectPhase(ns);
        setState(ns, { phase });

        // Phase 1: Propager l'accès root
        await propagateRootAccess(ns);

        // Phase 2: Copier les workers sur tous les serveurs
        await deployWorkers(ns);

        // Phase 3: Obtenir le pool de cibles
        const targetPool = getTargetPool(ns);

        if (targetPool.length === 0) {
            ns.print("⚠️ Aucune cible valide trouvée. Attente...");
            await ns.sleep(5000);
            continue;
        }

        // Phase 4: Préparer les cibles non-prêtes
        const preparedTargets = [];
        const needsPrep = [];

        for (const target of targetPool) {
            if (isServerPrepared(ns, target.host)) {
                preparedTargets.push(target);
            } else {
                needsPrep.push(target);
            }
        }

        // Afficher le statut
        ns.clearLog();
        printStatus(ns, targetPool, preparedTargets, batchCount, totalStolen, startTime);

        // Phase 5: Préparation ou Proto-Batching
        if (preparedTargets.length > 0) {
            // Lancer des batches sur les cibles prêtes
            const result = await executeProtoBatches(ns, preparedTargets);
            batchCount += result.batches;
            totalStolen += result.stolen;
        }

        // Préparer les autres cibles en parallèle
        if (needsPrep.length > 0) {
            await prepareServers(ns, needsPrep.slice(0, 2)); // Max 2 en préparation
        }

        // Envoyer feedback à l'optimizer (toutes les 30s)
        if (Date.now() - lastFeedbackTime > 30000) {
            sendFeedback(ns, "hack", {
                batchCount,
                totalStolen,
                incomePerSec: totalStolen / ((Date.now() - startTime) / 1000),
                preparedTargets: preparedTargets.length,
                totalTargets: targetPool.length,
            });
            lastFeedbackTime = Date.now();
        }

        await ns.sleep(PROTO_CONFIG.BATCH_SPACING);
    }
}

/**
 * Obtenir le pool des meilleures cibles
 */
function getTargetPool(ns) {
    const servers = scanAll(ns);
    const targets = [];

    for (const host of servers) {
        if (!canHack(ns, host)) continue;

        const score = getAdvancedScore(ns, host);
        if (score > 0) {
            targets.push({ host, score });
        }
    }

    // Trier par score et retourner le top N
    targets.sort((a, b) => b.score - a.score);
    return targets.slice(0, PROTO_CONFIG.TARGET_POOL_SIZE);
}

/**
 * Score avancé incluant le temps de préparation
 */
function getAdvancedScore(ns, host) {
    const maxMoney = ns.getServerMaxMoney(host);
    const hackTime = ns.getHackTime(host);
    const hackChance = ns.hackAnalyzeChance(host);
    const security = ns.getServerSecurityLevel(host);
    const minSec = ns.getServerMinSecurityLevel(host);
    const money = ns.getServerMoneyAvailable(host);

    if (maxMoney <= 0 || hackTime <= 0) return 0;

    // Pénalité pour serveurs non préparés
    const secPenalty = 1 + (security - minSec) * 0.15;
    const moneyPenalty = 1 + (1 - money / maxMoney) * 0.3;

    // Bonus pour serveurs déjà prêts
    const prepBonus = isServerPrepared(ns, host) ? 2 : 1;

    return (maxMoney * hackChance * prepBonus) / (hackTime * secPenalty * moneyPenalty);
}

/**
 * Vérifier si un serveur est prêt pour le hacking
 */
function isServerPrepared(ns, host) {
    const security = ns.getServerSecurityLevel(host);
    const minSec = ns.getServerMinSecurityLevel(host);
    const money = ns.getServerMoneyAvailable(host);
    const maxMoney = ns.getServerMaxMoney(host);

    const secThreshold = getConfig("securityThreshold") || 5;
    const moneyThreshold = getConfig("moneyThreshold") || 0.75;

    return security <= minSec + secThreshold && money >= maxMoney * moneyThreshold;
}

/**
 * Préparer plusieurs serveurs en parallèle
 */
async function prepareServers(ns, targets) {
    for (const target of targets) {
        const host = target.host;
        const security = ns.getServerSecurityLevel(host);
        const minSec = ns.getServerMinSecurityLevel(host);
        const money = ns.getServerMoneyAvailable(host);
        const maxMoney = ns.getServerMaxMoney(host);

        const secThreshold = getConfig("securityThreshold") || 5;
        const moneyThreshold = getConfig("moneyThreshold") || 0.75;

        // Priorité: d'abord réduire la sécurité
        if (security > minSec + secThreshold) {
            const threads = Math.ceil((security - minSec) / 0.05);
            await distributeWork(ns, host, "weaken", Math.min(threads, 500));
        }
        // Ensuite augmenter l'argent
        else if (money < maxMoney * moneyThreshold) {
            const growthNeeded = maxMoney / Math.max(money, 1);
            const threads = Math.ceil(ns.growthAnalyze(host, growthNeeded));
            await distributeWork(ns, host, "grow", Math.min(threads, 500));
        }
    }
}

/**
 * Exécuter des proto-batches sur les cibles préparées
 */
async function executeProtoBatches(ns, targets) {
    let totalBatches = 0;
    let totalStolen = 0;

    // Calculer la RAM disponible
    const availableRam = getAvailableRam(ns);
    const totalFreeRam = availableRam.reduce((sum, s) => sum + s.freeRam, 0);

    if (totalFreeRam < PROTO_CONFIG.MIN_BATCH_RAM) {
        return { batches: 0, stolen: 0 };
    }

    // Distribuer les batches sur les cibles
    for (const target of targets) {
        const result = await executeSingleBatch(ns, target.host);
        if (result.success) {
            totalBatches++;
            totalStolen += result.expectedSteal;
        }
    }

    return { batches: totalBatches, stolen: totalStolen };
}

/**
 * Exécuter un seul batch HWGW
 */
async function executeSingleBatch(ns, target) {
    const maxMoney = ns.getServerMaxMoney(target);
    const hackPercent = getConfig("hackPercent") || 0.5;

    // Calculer les threads nécessaires
    const hackAmount = maxMoney * hackPercent;
    const hackThreads = Math.max(1, Math.floor(ns.hackAnalyzeThreads(target, hackAmount)));

    // Sécurité ajoutée par le hack
    const hackSecInc = ns.hackAnalyzeSecurity(hackThreads, target);
    const weaken1Threads = Math.ceil(hackSecInc / 0.05);

    // Threads de grow pour récupérer l'argent volé
    const growThreads = Math.ceil(ns.growthAnalyze(target, 1 / (1 - hackPercent)));

    // Sécurité ajoutée par le grow
    const growSecInc = ns.growthAnalyzeSecurity(growThreads, target);
    const weaken2Threads = Math.ceil(growSecInc / 0.05);

    // Calculer les timings
    const times = getTimes(ns, target);
    const step = HACK_CONFIG.STEP_DELAY || 40;

    // Ordre d'arrivée: Hack → Weaken1 → Grow → Weaken2
    const hackDelay = Math.max(0, times.weakenTime - times.hackTime - step * 3);
    const weaken1Delay = 0;
    const growDelay = Math.max(0, times.weakenTime - times.growTime - step);
    const weaken2Delay = step * 2;

    // Générer un ID unique pour ce batch
    const uid = `${batchId++}-${Date.now()}`;

    // Lancer les opérations
    let launched = 0;
    launched += await distributeWork(ns, target, "hack", hackThreads, hackDelay, uid);
    launched += await distributeWork(ns, target, "weaken", weaken1Threads, weaken1Delay, uid);
    launched += await distributeWork(ns, target, "grow", growThreads, growDelay, uid);
    launched += await distributeWork(ns, target, "weaken", weaken2Threads, weaken2Delay, uid);

    if (launched > 0) {
        const expectedSteal = hackAmount * ns.hackAnalyzeChance(target);
        return { success: true, expectedSteal };
    }

    return { success: false, expectedSteal: 0 };
}

/**
 * Calculer les temps d'exécution (avec ou sans Formulas)
 */
function getTimes(ns, target) {
    if (ns.fileExists("Formulas.exe", "home")) {
        try {
            const server = ns.getServer(target);
            const player = ns.getPlayer();

            server.hackDifficulty = server.minDifficulty;
            server.moneyAvailable = server.moneyMax;

            return {
                hackTime: ns.formulas.hacking.hackTime(server, player),
                growTime: ns.formulas.hacking.growTime(server, player),
                weakenTime: ns.formulas.hacking.weakenTime(server, player),
            };
        } catch (e) { }
    }

    return {
        hackTime: ns.getHackTime(target),
        growTime: ns.getGrowTime(target),
        weakenTime: ns.getWeakenTime(target),
    };
}

/**
 * Distribuer le travail sur les serveurs disponibles
 */
async function distributeWork(ns, target, type, threads, delay = 0, uid = "") {
    if (threads <= 0) return 0;

    const workerScript = WORKERS[type];
    const workerRam = WORKER_RAM[type];
    const servers = getAvailableRam(ns);

    let threadsRemaining = threads;
    let threadsLaunched = 0;

    for (const server of servers) {
        if (threadsRemaining <= 0) break;

        const maxThreads = Math.floor(server.freeRam / workerRam);
        if (maxThreads <= 0) continue;

        const threadsToRun = Math.min(maxThreads, threadsRemaining);

        const pid = ns.exec(workerScript, server.host, threadsToRun, target, delay, uid);

        if (pid > 0) {
            threadsLaunched += threadsToRun;
            threadsRemaining -= threadsToRun;
        }
    }

    return threadsLaunched;
}

/**
 * Propager l'accès root sur tous les serveurs possibles
 */
async function propagateRootAccess(ns) {
    const servers = scanAll(ns);

    for (const host of servers) {
        if (!ns.hasRootAccess(host)) {
            getRootAccess(ns, host);
        }
    }
}

/**
 * Déployer les workers sur tous les serveurs
 */
async function deployWorkers(ns) {
    const servers = scanAll(ns);
    const workerFiles = Object.values(WORKERS);

    for (const host of servers) {
        if (host === "home") continue;
        if (!ns.hasRootAccess(host)) continue;
        if (ns.getServerMaxRam(host) === 0) continue;

        let needsCopy = false;
        for (const file of workerFiles) {
            if (!ns.fileExists(file, host)) {
                needsCopy = true;
                break;
            }
        }

        if (needsCopy) {
            ns.scp(workerFiles, host, "home");
        }
    }
}

/**
 * Afficher le statut actuel
 */
function printStatus(ns, targetPool, preparedTargets, batchCount, totalStolen, startTime) {
    const runtime = Date.now() - startTime;
    const moneyPerSec = totalStolen / (runtime / 1000);

    // RAM totale
    const availableRam = getAvailableRam(ns);
    const totalFreeRam = availableRam.reduce((sum, s) => sum + s.freeRam, 0);
    const totalMaxRam = availableRam.reduce((sum, s) => sum + s.maxRam, 0);

    ns.print("═══════════════════════════════════════");
    ns.print("  🤖 HACK DAEMON v2.0 (Proto-Batch)");
    ns.print("═══════════════════════════════════════");
    ns.print("");
    ns.print(`💾 RAM: ${formatRam(totalFreeRam)} / ${formatRam(totalMaxRam)}`);
    ns.print(`📈 Config: ${(getConfig("hackPercent") * 100).toFixed(0)}% hack`);
    ns.print("");

    ns.print("🎯 Pool de cibles:");
    for (const target of targetPool) {
        const info = ns.getServer(target.host);
        const prepared = isServerPrepared(ns, target.host);
        const icon = prepared ? "🟢" : "🟡";
        const money = ns.getServerMoneyAvailable(target.host);
        const maxMoney = ns.getServerMaxMoney(target.host);
        ns.print(`   ${icon} ${target.host}: ${formatMoney(money)} / ${formatMoney(maxMoney)}`);
    }
    ns.print("");

    ns.print("📊 Statistiques:");
    ns.print(`   Batches: ${batchCount}`);
    ns.print(`   Total volé: ${formatMoney(totalStolen)}`);
    ns.print(`   $/sec: ${formatMoney(moneyPerSec)}`);
    ns.print(`   Temps: ${formatTime(runtime)}`);
    ns.print(`   Cibles prêtes: ${preparedTargets.length}/${targetPool.length}`);
    ns.print("");
}
