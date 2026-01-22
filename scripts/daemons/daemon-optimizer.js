/**
 * Bitburner AI - Optimizer Daemon v2.0
 * Système d'auto-optimisation avec apprentissage renforcé
 * 
 * Améliorations v2.0:
 * - Feedback loop: Reçoit les données des autres daemons
 * - A/B Testing: Teste différentes configurations
 * - Trend analysis: Analyse les tendances court/moyen/long terme
 * - Phase adaptation: S'adapte automatiquement à la phase de jeu
 * - Cross-daemon coordination: Gère les priorités globales
 * 
 * Usage: run daemon-optimizer.js
 */

import { scanAll, canHack, formatMoney, formatTime } from "../lib/utils.js";
import {
    getState,
    setState,
    detectPhase,
    determinePriority,
    readFeedback,
    sendFeedback
} from "../lib/brain-state.js";

// Fichiers de données
const DATA_FILE = "/data/optimizer-data.txt";
const CONFIG_FILE = "/data/optimizer-config.txt";

// Configuration de base
let config = {
    hackPercent: 0.5,
    securityThreshold: 5,
    moneyThreshold: 0.75,
    batchDelay: 200,
};

// Variants A/B Testing
const CONFIG_VARIANTS = {
    conservative: { hackPercent: 0.4, securityThreshold: 3, moneyThreshold: 0.85 },
    balanced: { hackPercent: 0.5, securityThreshold: 5, moneyThreshold: 0.75 },
    aggressive: { hackPercent: 0.7, securityThreshold: 7, moneyThreshold: 0.65 },
    extreme: { hackPercent: 0.9, securityThreshold: 10, moneyThreshold: 0.5 },
};

let activeVariant = "balanced";
let variantTestStart = 0;
let variantPerformance = {};

// Historique des performances
let performanceHistory = [];
let targetStats = {};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    // Charger les données précédentes
    loadData(ns);

    const startMoney = ns.getServerMoneyAvailable("home");
    const startTime = Date.now();
    let lastMoney = startMoney;
    let lastCheck = startTime;
    let optimizationCycle = 0;
    variantTestStart = Date.now();

    ns.print("═══════════════════════════════════════");
    ns.print("  🧠 OPTIMIZER v2.0 - AI Learning");
    ns.print("═══════════════════════════════════════");

    while (true) {
        await ns.sleep(10000); // Vérifier toutes les 10 secondes

        const currentMoney = ns.getServerMoneyAvailable("home");
        const currentTime = Date.now();
        const elapsed = (currentTime - lastCheck) / 1000;

        // Calculer le revenu actuel
        const moneyGained = currentMoney - lastMoney;
        const incomePerSec = moneyGained / elapsed;

        // Collecter le feedback des autres daemons
        const feedback = collectAllFeedback(ns);

        // Enregistrer dans l'historique
        recordPerformance(ns, incomePerSec, feedback);

        // Analyser les cibles
        await analyzeTargets(ns);

        // Mettre à jour l'état global
        updateGlobalState(ns);

        // Afficher le statut
        ns.clearLog();
        printStatus(ns, incomePerSec, feedback, optimizationCycle);

        // Optimisation périodique (toutes les 60s)
        if (optimizationCycle % 6 === 0) {
            await optimize(ns);
        }

        // A/B Testing: évaluer le variant actuel (toutes les 5 minutes)
        if (currentTime - variantTestStart > 300000) {
            evaluateVariant(ns, incomePerSec);
        }

        // Sauvegarder les données
        saveData(ns);

        // Écrire la config pour les autres daemons
        writeConfig(ns);

        lastMoney = currentMoney;
        lastCheck = currentTime;
        optimizationCycle++;
    }
}

/**
 * Collecter le feedback de tous les daemons
 */
function collectAllFeedback(ns) {
    return {
        hack: readFeedback(ns, "hack"),
        stocks: readFeedback(ns, "stocks"),
        gang: readFeedback(ns, "gang"),
        corp: readFeedback(ns, "corp"),
    };
}

/**
 * Enregistrer les performances avec trend analysis
 */
function recordPerformance(ns, income, feedback) {
    const entry = {
        timestamp: Date.now(),
        income,
        config: { ...config },
        variant: activeVariant,
        hackLevel: ns.getHackingLevel(),
        feedback,
    };

    performanceHistory.push(entry);

    // Garder seulement les 500 dernières entrées (5000 sec = ~83 min)
    if (performanceHistory.length > 500) {
        performanceHistory.shift();
    }
}

/**
 * Analyser les performances de chaque cible
 */
async function analyzeTargets(ns) {
    const servers = scanAll(ns);

    for (const host of servers) {
        if (!canHack(ns, host)) continue;

        const maxMoney = ns.getServerMaxMoney(host);
        const hackTime = ns.getHackTime(host);
        const hackChance = ns.hackAnalyzeChance(host);
        const security = ns.getServerSecurityLevel(host);
        const minSecurity = ns.getServerMinSecurityLevel(host);

        const theoreticalScore = (maxMoney * hackChance) / (hackTime * (1 + security - minSecurity));

        if (!targetStats[host]) {
            targetStats[host] = {
                theoreticalScore,
                avgScore: theoreticalScore,
                samples: 1,
                lastUpdated: Date.now(),
            };
        } else {
            // Moyenne mobile exponentielle
            const alpha = 0.3;
            targetStats[host].avgScore =
                alpha * theoreticalScore + (1 - alpha) * targetStats[host].avgScore;
            targetStats[host].samples++;
            targetStats[host].lastUpdated = Date.now();
        }
    }
}

/**
 * Mettre à jour l'état global du système
 */
function updateGlobalState(ns) {
    const phase = detectPhase(ns);
    const state = getState(ns);
    const priority = determinePriority(ns, { ...state, phase });

    setState(ns, {
        phase,
        priority,
        config: { ...config },
        stats: {
            hackingLevel: ns.getHackingLevel(),
            netWorth: ns.getServerMoneyAvailable("home"),
        },
    });
}

/**
 * Optimisation basée sur les performances
 */
async function optimize(ns) {
    ns.print("🔄 Cycle d'optimisation...");

    if (performanceHistory.length < 20) {
        ns.print("   📊 Collecte de données en cours...");
        return;
    }

    // Analyser les tendances
    const trends = analyzeTrends();

    ns.print(`   📈 Trend 1min: ${trends.short > 0 ? '+' : ''}${(trends.short * 100).toFixed(1)}%`);
    ns.print(`   📈 Trend 5min: ${trends.medium > 0 ? '+' : ''}${(trends.medium * 100).toFixed(1)}%`);
    ns.print(`   📈 Trend 15min: ${trends.long > 0 ? '+' : ''}${(trends.long * 100).toFixed(1)}%`);

    // Si tendance négative sur moyen/long terme, ajuster
    if (trends.medium < -0.1 || trends.long < -0.1) {
        adjustForNegativeTrend(ns, trends);
    } else if (trends.medium > 0.2 && trends.long > 0.1) {
        // Bonne performance, essayer d'être plus agressif
        if (config.hackPercent < 0.8) {
            config.hackPercent = Math.min(0.9, config.hackPercent + 0.05);
            ns.print(`   ⬆️ hackPercent augmenté: ${(config.hackPercent * 100).toFixed(0)}%`);
        }
    }

    // Adapter selon la phase du jeu
    adaptToGamePhase(ns);
}

/**
 * Analyser les tendances de performance
 */
function analyzeTrends() {
    const now = Date.now();

    // Filtrer par période
    const last1min = performanceHistory.filter(h => now - h.timestamp < 60000);
    const last5min = performanceHistory.filter(h => now - h.timestamp < 300000);
    const last15min = performanceHistory.filter(h => now - h.timestamp < 900000);

    return {
        short: calculateTrend(last1min),
        medium: calculateTrend(last5min),
        long: calculateTrend(last15min),
    };
}

/**
 * Calculer le trend d'une série de données
 */
function calculateTrend(history) {
    if (history.length < 4) return 0;

    const half = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, half);
    const secondHalf = history.slice(half);

    const avgFirst = firstHalf.reduce((s, h) => s + h.income, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, h) => s + h.income, 0) / secondHalf.length;

    if (avgFirst === 0) return 0;
    return (avgSecond - avgFirst) / Math.abs(avgFirst);
}

/**
 * Ajuster les paramètres pour corriger une tendance négative
 */
function adjustForNegativeTrend(ns, trends) {
    ns.print("   ⚠️ Tendance négative détectée");

    // Essayer un variant différent
    if (activeVariant === "aggressive" || activeVariant === "extreme") {
        activeVariant = "balanced";
        config = { ...config, ...CONFIG_VARIANTS.balanced };
        ns.print("   🔄 Switch vers variant: balanced");
    } else if (activeVariant === "balanced") {
        activeVariant = "conservative";
        config = { ...config, ...CONFIG_VARIANTS.conservative };
        ns.print("   🔄 Switch vers variant: conservative");
    }

    variantTestStart = Date.now();
}

/**
 * Évaluer la performance du variant actuel
 */
function evaluateVariant(ns, currentIncome) {
    // Stocker la performance de ce variant
    if (!variantPerformance[activeVariant]) {
        variantPerformance[activeVariant] = { total: 0, count: 0 };
    }
    variantPerformance[activeVariant].total += currentIncome;
    variantPerformance[activeVariant].count++;

    // Trouver le meilleur variant
    let bestVariant = activeVariant;
    let bestAvg = 0;

    for (const [variant, perf] of Object.entries(variantPerformance)) {
        if (perf.count >= 3) {
            const avg = perf.total / perf.count;
            if (avg > bestAvg) {
                bestAvg = avg;
                bestVariant = variant;
            }
        }
    }

    // Si un autre variant est meilleur, switcher
    if (bestVariant !== activeVariant && variantPerformance[bestVariant]?.count >= 5) {
        ns.print(`   🔬 A/B Test: ${activeVariant} → ${bestVariant}`);
        activeVariant = bestVariant;
        config = { ...config, ...CONFIG_VARIANTS[bestVariant] };
    }

    // Explorer parfois un nouveau variant (10% du temps)
    if (Math.random() < 0.1) {
        const variants = Object.keys(CONFIG_VARIANTS);
        const randomVariant = variants[Math.floor(Math.random() * variants.length)];
        if (randomVariant !== activeVariant) {
            ns.print(`   🎲 Exploration: test de ${randomVariant}`);
            activeVariant = randomVariant;
            config = { ...config, ...CONFIG_VARIANTS[randomVariant] };
        }
    }

    variantTestStart = Date.now();
}

/**
 * Adapter la stratégie selon la phase du jeu
 */
function adaptToGamePhase(ns) {
    const state = getState(ns);
    const phase = state.phase;

    // Charger la config BitNode
    let bnConfig = { focus: "balanced", canHack: true };
    try {
        const bnData = ns.read("/data/bitnode-config.txt");
        if (bnData) bnConfig = JSON.parse(bnData);
    } catch (e) { }

    // Si on ne peut pas hacker (BN8), minimiser
    if (!bnConfig.canHack) {
        config.hackPercent = 0.1;
        ns.print("   🌍 BN8: Hacking minimal");
        return;
    }

    // Ajuster selon la phase
    switch (phase) {
        case "early":
            config.hackPercent = Math.min(config.hackPercent, 0.4);
            config.securityThreshold = 3;
            break;
        case "early-mid":
            config.hackPercent = 0.5;
            break;
        case "mid":
            config.hackPercent = 0.6;
            break;
        case "late":
            config.hackPercent = 0.75;
            break;
        case "endgame":
            config.hackPercent = 0.9;
            config.securityThreshold = 10;
            break;
    }

    ns.print(`   📊 Phase: ${phase.toUpperCase()}`);
}

/**
 * Écrire la config pour les autres daemons
 */
function writeConfig(ns) {
    const configData = JSON.stringify({
        hackPercent: config.hackPercent,
        securityThreshold: config.securityThreshold,
        moneyThreshold: config.moneyThreshold,
        batchDelay: config.batchDelay,
        variant: activeVariant,
        timestamp: Date.now(),
    });

    ns.write(CONFIG_FILE, configData, "w");
}

/**
 * Afficher le statut
 */
function printStatus(ns, currentIncome, feedback, cycle) {
    const state = getState(ns);

    ns.print("═══════════════════════════════════════");
    ns.print("  🧠 OPTIMIZER v2.0 - AI Learning");
    ns.print("═══════════════════════════════════════");
    ns.print("");
    ns.print(`📈 Revenu: ${formatMoney(currentIncome)}/sec`);
    ns.print(`🎮 Phase: ${state.phase?.toUpperCase() || "?"}`);
    ns.print(`🎯 Priorité: ${state.priority || "money"}`);
    ns.print(`🔄 Cycle: ${cycle}`);
    ns.print(`📊 Échantillons: ${performanceHistory.length}`);
    ns.print("");

    ns.print("⚙️ Configuration active:");
    ns.print(`   Variant: ${activeVariant}`);
    ns.print(`   hackPercent: ${(config.hackPercent * 100).toFixed(0)}%`);
    ns.print(`   securityThreshold: ${config.securityThreshold}`);
    ns.print(`   moneyThreshold: ${(config.moneyThreshold * 100).toFixed(0)}%`);
    ns.print("");

    // Feedback des daemons
    ns.print("📡 Feedback daemons:");
    if (feedback.hack) {
        ns.print(`   🤖 Hack: ${formatMoney(feedback.hack.incomePerSec || 0)}/sec`);
    }
    if (feedback.stocks) {
        ns.print(`   📈 Stocks: ${formatMoney(feedback.stocks.profit || 0)} profit`);
    }
    ns.print("");

    // Top 5 cibles
    const sortedTargets = Object.entries(targetStats)
        .sort((a, b) => b[1].avgScore - a[1].avgScore)
        .slice(0, 5);

    if (sortedTargets.length > 0) {
        ns.print("🎯 Meilleures cibles:");
        for (const [host, stats] of sortedTargets) {
            ns.print(`   ${host}: ${stats.avgScore.toFixed(2)}`);
        }
    }
    ns.print("");

    // A/B Testing stats
    ns.print("🔬 A/B Testing:");
    for (const [variant, perf] of Object.entries(variantPerformance)) {
        if (perf.count > 0) {
            const avg = perf.total / perf.count;
            const marker = variant === activeVariant ? "▶" : " ";
            ns.print(`   ${marker} ${variant}: ${formatMoney(avg)}/sec (n=${perf.count})`);
        }
    }
}

/**
 * Sauvegarder les données
 */
function saveData(ns) {
    if (performanceHistory.length < 10) return;

    try {
        const bnInfo = ns.getResetInfo();
        const data = JSON.stringify({
            config,
            activeVariant,
            variantPerformance,
            performanceHistory: performanceHistory.slice(-200),
            targetStats,
            savedAt: Date.now(),
            bitNode: bnInfo.currentNode,
        });

        ns.write(DATA_FILE, data, "w");
    } catch (e) { }
}

/**
 * Charger les données précédentes
 */
function loadData(ns) {
    try {
        const data = ns.read(DATA_FILE);
        if (data && data.length > 0) {
            const parsed = JSON.parse(data);

            // Vérifier si on est dans le même BitNode
            const currentBN = ns.getResetInfo().currentNode;
            if (parsed.bitNode !== currentBN) {
                ns.print("🔄 Nouveau BitNode détecté - Reset des statistiques");
                return;
            }

            if (parsed.config) config = { ...config, ...parsed.config };
            if (parsed.activeVariant) activeVariant = parsed.activeVariant;
            if (parsed.variantPerformance) variantPerformance = parsed.variantPerformance;
            if (parsed.performanceHistory) performanceHistory = parsed.performanceHistory;
            if (parsed.targetStats) targetStats = parsed.targetStats;

            ns.print(`📂 Données chargées (${Object.keys(targetStats).length} cibles)`);
        }
    } catch (e) {
        ns.print("📂 Nouvelles données initialisées");
    }
}

/**
 * Obtenir la config optimisée (pour les autres scripts)
 */
export function getOptimizedConfig() {
    return { ...config };
}
