/**
 * Bitburner AI - Hack Daemon
 * Système de hacking HWGW (Hack-Weaken-Grow-Weaken) automatisé
 * 
 * Ce script orchestre le hacking optimisé de serveurs cibles.
 * Il distribue les workers sur tous les serveurs disponibles.
 * Il utilise la config dynamique de l'optimizer si disponible.
 * 
 * Usage: run daemon-hack.js
 */

import { HACK_CONFIG, WORKER_RAM } from "../lib/constants.js";
import {
    scanAll,
    getRootAccess,
    canHack,
    getBestTarget,
    getAvailableRam,
    formatMoney,
    formatTime,
    formatRam,
} from "../lib/utils.js";

// Chemins des workers
const WORKERS = {
    hack: "/workers/hack.js",
    grow: "/workers/grow.js",
    weaken: "/workers/weaken.js",
};

// Config dynamique (sera mise à jour depuis l'optimizer)
let dynamicConfig = null;

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
    } catch (e) {
        // Pas de config optimizer, utiliser les defaults
    }
    return false;
}

/**
 * Obtenir une valeur de config (dynamique ou statique)
 */
function getConfig(key) {
    if (dynamicConfig && dynamicConfig[key] !== undefined) {
        return dynamicConfig[key];
    }
    // Fallback sur la config statique
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

    ns.print("═══════════════════════════════════════");
    ns.print("  🤖 BITBURNER AI - HACK DAEMON");
    ns.print("═══════════════════════════════════════");

    // Boucle principale
    while (true) {
        // Recharger la config de l'optimizer
        loadOptimizerConfig(ns);

        // Phase 1: Propager l'accès root
        await propagateRootAccess(ns);

        // Phase 2: Copier les workers sur tous les serveurs
        await deployWorkers(ns);

        // Phase 3: Trouver la meilleure cible
        const target = getBestTarget(ns);

        if (!target) {
            ns.print("⚠️ Aucune cible valide trouvée. Attente...");
            await ns.sleep(5000);
            continue;
        }

        // Phase 4: Préparer ou hacker la cible
        const serverInfo = getTargetInfo(ns, target);

        ns.clearLog();
        printStatus(ns, target, serverInfo, batchCount, totalStolen, startTime);

        if (needsPreparation(ns, target)) {
            // Préparer le serveur (réduire sécurité, maximiser argent)
            await prepareServer(ns, target);
        } else {
            // Lancer un batch HWGW
            const stolen = await executeBatch(ns, target);
            if (stolen > 0) {
                batchCount++;
                totalStolen += stolen;
            }
        }

        await ns.sleep(getConfig("batchDelay") || 200);
    }
}

/**
 * Propager l'accès root sur tous les serveurs possibles
 */
async function propagateRootAccess(ns) {
    const servers = scanAll(ns);
    let newRoots = 0;

    for (const host of servers) {
        if (!ns.hasRootAccess(host)) {
            if (getRootAccess(ns, host)) {
                ns.print(`✓ Root obtenu: ${host}`);
                newRoots++;
            }
        }
    }

    if (newRoots > 0) {
        ns.print(`🔓 ${newRoots} nouveau(x) serveur(s) rooté(s)`);
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

        // Vérifier si les workers sont déjà présents
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
 * Vérifier si un serveur a besoin de préparation
 */
function needsPreparation(ns, target) {
    const currentSecurity = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    const currentMoney = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);

    const secThreshold = getConfig("securityThreshold") || 5;
    const moneyThreshold = getConfig("moneyThreshold") || 0.75;

    const securityOk = currentSecurity <= minSecurity + secThreshold;
    const moneyOk = currentMoney >= maxMoney * moneyThreshold;

    return !securityOk || !moneyOk;
}

/**
 * Préparer un serveur (réduire sécurité, augmenter argent)
 */
async function prepareServer(ns, target) {
    const currentSecurity = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    const currentMoney = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);

    const secThreshold = getConfig("securityThreshold") || 5;
    const moneyThreshold = getConfig("moneyThreshold") || 0.75;

    const securityDiff = currentSecurity - minSecurity;
    const moneyRatio = currentMoney / maxMoney;

    // Priorité: d'abord réduire la sécurité
    if (securityDiff > secThreshold) {
        ns.print(`🛡️ Réduction sécurité: ${currentSecurity.toFixed(2)} → ${minSecurity.toFixed(2)}`);
        await distributeWork(ns, target, "weaken", Math.ceil(securityDiff / 0.05));
    }
    // Ensuite augmenter l'argent
    else if (moneyRatio < moneyThreshold) {
        const growthNeeded = maxMoney / Math.max(currentMoney, 1);
        const growThreads = Math.ceil(ns.growthAnalyze(target, growthNeeded));
        ns.print(`💰 Croissance: ${(moneyRatio * 100).toFixed(1)}% → 100%`);
        await distributeWork(ns, target, "grow", Math.min(growThreads, 1000));
    }
}

/**
 * Calculer les temps d'exécution (avec ou sans Formulas)
 */
function getTimes(ns, target) {
    // Si Formulas.exe existe et API activée
    if (ns.fileExists("Formulas.exe", "home")) {
        try {
            const server = ns.getServer(target);
            const player = ns.getPlayer();

            // Simuler l'état pour les calculs (sécurité min, argent max)
            server.hackDifficulty = server.minDifficulty;
            server.moneyAvailable = server.moneyMax;

            return {
                hackTime: ns.formulas.hacking.hackTime(server, player),
                growTime: ns.formulas.hacking.growTime(server, player),
                weakenTime: ns.formulas.hacking.weakenTime(server, player),
            };
        } catch (e) {
            // Fallback si l'API crash ou n'est pas dispo
        }
    }

    // Fallback standard
    return {
        hackTime: ns.getHackTime(target),
        growTime: ns.getGrowTime(target),
        weakenTime: ns.getWeakenTime(target),
    };
}

/**
 * Exécuter un batch HWGW optimisé
 */
async function executeBatch(ns, target) {
    const maxMoney = ns.getServerMaxMoney(target);
    const hackPercent = getConfig("hackPercent") || 0.5;

    // Calculer les threads nécessaires
    const hackAmount = maxMoney * hackPercent;
    const hackThreads = Math.max(1, Math.floor(ns.hackAnalyzeThreads(target, hackAmount)));

    // Sécurité ajoutée par le hack
    const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads, target);
    const weaken1Threads = Math.ceil(hackSecurityIncrease / 0.05);

    // Threads de grow pour récupérer l'argent volé
    const growThreads = Math.ceil(ns.growthAnalyze(target, 1 / (1 - hackPercent)));

    // Sécurité ajoutée par le grow
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, target);
    const weaken2Threads = Math.ceil(growSecurityIncrease / 0.05);

    // Calculer les timings
    const times = getTimes(ns, target);
    const hackTime = times.hackTime;
    const growTime = times.growTime;
    const weakenTime = times.weakenTime;

    const step = HACK_CONFIG.STEP_DELAY;

    // Ordre d'arrivée: Hack → Weaken1 → Grow → Weaken2
    // Calculer les délais de départ
    const hackDelay = weakenTime - hackTime - step * 3;
    const weaken1Delay = 0;
    const growDelay = weakenTime - growTime - step;
    const weaken2Delay = step * 2;

    // Lancer les opérations
    const totalThreads = hackThreads + weaken1Threads + growThreads + weaken2Threads;
    const ramNeeded = hackThreads * WORKER_RAM.hack +
        (weaken1Threads + weaken2Threads) * WORKER_RAM.weaken +
        growThreads * WORKER_RAM.grow;

    ns.print(`📦 Batch: H:${hackThreads} W1:${weaken1Threads} G:${growThreads} W2:${weaken2Threads}`);
    ns.print(`   RAM: ${formatRam(ramNeeded)} | Durée: ${formatTime(weakenTime)}`);

    // Distribuer le travail
    let launched = 0;
    launched += await distributeWork(ns, target, "hack", hackThreads, hackDelay);
    launched += await distributeWork(ns, target, "weaken", weaken1Threads, weaken1Delay);
    launched += await distributeWork(ns, target, "grow", growThreads, growDelay);
    launched += await distributeWork(ns, target, "weaken", weaken2Threads, weaken2Delay);

    if (launched > 0) {
        return hackAmount * ns.hackAnalyzeChance(target);
    }

    return 0;
}

/**
 * Distribuer le travail sur les serveurs disponibles
 */
async function distributeWork(ns, target, type, threads, delay = 0) {
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

        const pid = ns.exec(workerScript, server.host, threadsToRun, target, delay, Date.now());

        if (pid > 0) {
            threadsLaunched += threadsToRun;
            threadsRemaining -= threadsToRun;
        }
    }

    return threadsLaunched;
}

/**
 * Obtenir les informations sur la cible
 */
function getTargetInfo(ns, target) {
    return {
        currentMoney: ns.getServerMoneyAvailable(target),
        maxMoney: ns.getServerMaxMoney(target),
        currentSecurity: ns.getServerSecurityLevel(target),
        minSecurity: ns.getServerMinSecurityLevel(target),
        hackChance: ns.hackAnalyzeChance(target),
        hackTime: ns.getHackTime(target),
    };
}

/**
 * Afficher le statut actuel
 */
function printStatus(ns, target, info, batchCount, totalStolen, startTime) {
    const runtime = Date.now() - startTime;
    const moneyPerSec = totalStolen / (runtime / 1000);

    ns.print("═══════════════════════════════════════");
    ns.print("  🤖 BITBURNER AI - HACK DAEMON");
    ns.print("═══════════════════════════════════════");
    ns.print("");
    ns.print(`🎯 Cible: ${target}`);
    ns.print(`   💰 Argent: ${formatMoney(info.currentMoney)} / ${formatMoney(info.maxMoney)}`);
    ns.print(`   🛡️ Sécurité: ${info.currentSecurity.toFixed(2)} / ${info.minSecurity.toFixed(2)}`);
    ns.print(`   🎲 Chance: ${(info.hackChance * 100).toFixed(1)}%`);
    ns.print(`   ⏱️ Temps hack: ${formatTime(info.hackTime)}`);
    ns.print("");
    ns.print(`📊 Statistiques:`);
    ns.print(`   Batches: ${batchCount}`);
    ns.print(`   Total volé: ${formatMoney(totalStolen)}`);
    ns.print(`   $/sec: ${formatMoney(moneyPerSec)}`);
    ns.print(`   Temps: ${formatTime(runtime)}`);
    ns.print("");
}
