/**
 * Bitburner AI - Optimizer Daemon
 * Système d'auto-optimisation qui apprend et s'adapte
 * 
 * Ce daemon:
 * - Surveille les performances en temps réel
 * - Ajuste les paramètres automatiquement
 * - Apprend quelles cibles sont les plus rentables
 * - S'adapte à la phase du jeu
 * 
 * Usage: run daemon-optimizer.js
 */

import { scanAll, canHack, formatMoney, formatTime } from "../lib/utils.js";

// Fichier de données persistant
const DATA_FILE = "/data/optimizer-data.txt";

// Paramètres ajustables
let config = {
    hackPercent: 0.5,
    securityThreshold: 5,
    moneyThreshold: 0.75,
    batchDelay: 200,
};

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

    ns.print("═══════════════════════════════════════");
    ns.print("  🧠 OPTIMIZER DAEMON - Self-Learning");
    ns.print("═══════════════════════════════════════");

    while (true) {
        await ns.sleep(10000); // Vérifier toutes les 10 secondes

        const currentMoney = ns.getServerMoneyAvailable("home");
        const currentTime = Date.now();
        const elapsed = (currentTime - lastCheck) / 1000;

        // Calculer le revenu actuel
        const moneyGained = currentMoney - lastMoney;
        const incomePerSec = moneyGained / elapsed;

        // Enregistrer dans l'historique
        performanceHistory.push({
            timestamp: currentTime,
            income: incomePerSec,
            config: { ...config },
            hackLevel: ns.getHackingLevel(),
        });

        // Garder seulement les 100 dernières entrées
        if (performanceHistory.length > 100) {
            performanceHistory.shift();
        }

        // Analyser les cibles actuelles
        await analyzeTargets(ns);

        // Afficher le statut
        ns.clearLog();
        printStatus(ns, incomePerSec, optimizationCycle);

        // Optimisation périodique (toutes les minutes)
        if (optimizationCycle % 6 === 0) {
            await optimize(ns);
        }

        // Sauvegarder les données
        saveData(ns);

        lastMoney = currentMoney;
        lastCheck = currentTime;
        optimizationCycle++;
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
        const growTime = ns.getGrowTime(host);
        const weakenTime = ns.getWeakenTime(host);
        const hackChance = ns.hackAnalyzeChance(host);
        const security = ns.getServerSecurityLevel(host);
        const minSecurity = ns.getServerMinSecurityLevel(host);

        // Score de rentabilité théorique
        const theoreticalScore = (maxMoney * hackChance) / (hackTime * (1 + security - minSecurity));

        // Initialiser ou mettre à jour les stats
        if (!targetStats[host]) {
            targetStats[host] = {
                theoreticalScore,
                hackAttempts: 0,
                successfulHacks: 0,
                totalStolen: 0,
                avgStealTime: hackTime,
                lastUpdated: Date.now(),
            };
        } else {
            // Mise à jour avec moyenne mobile
            const stats = targetStats[host];
            stats.theoreticalScore = (stats.theoreticalScore * 0.7) + (theoreticalScore * 0.3);
            stats.avgStealTime = (stats.avgStealTime * 0.8) + (hackTime * 0.2);
            stats.lastUpdated = Date.now();
        }
    }
}

/**
 * Optimiser les paramètres basé sur les performances
 */
async function optimize(ns) {
    ns.print("🔄 Cycle d'optimisation...");

    if (performanceHistory.length < 10) {
        ns.print("   Pas assez de données, collecte en cours...");
        return;
    }

    // Calculer la moyenne des revenus récents
    const recentHistory = performanceHistory.slice(-10);
    const avgIncome = recentHistory.reduce((sum, h) => sum + h.income, 0) / recentHistory.length;

    // Comparer avec l'historique plus ancien
    const olderHistory = performanceHistory.slice(-30, -10);
    if (olderHistory.length < 5) {
        ns.print("   Collecte de plus de données...");
        return;
    }

    const oldAvgIncome = olderHistory.reduce((sum, h) => sum + h.income, 0) / olderHistory.length;

    // Calculer le changement de performance
    const performanceChange = ((avgIncome - oldAvgIncome) / Math.max(oldAvgIncome, 1)) * 100;

    ns.print(`   Performance récente: ${formatMoney(avgIncome)}/sec`);
    ns.print(`   Performance passée: ${formatMoney(oldAvgIncome)}/sec`);
    ns.print(`   Changement: ${performanceChange > 0 ? '+' : ''}${performanceChange.toFixed(1)}%`);

    // Ajuster les paramètres si la performance baisse
    if (performanceChange < -10) {
        // Performance en baisse, essayer différentes stratégies
        adjustParameters(ns, "aggressive");
    } else if (performanceChange < 0) {
        // Légère baisse, ajustements mineurs
        adjustParameters(ns, "minor");
    } else if (performanceChange > 20) {
        // Bonne performance, noter la configuration actuelle
        ns.print("   ✅ Configuration performante détectée!");
    }

    // Adapter selon la phase du jeu
    adaptToGamePhase(ns);
}

/**
 * Ajuster les paramètres de hacking
 */
function adjustParameters(ns, mode) {
    const oldConfig = { ...config };

    if (mode === "aggressive") {
        // Stratégie plus agressive (Test A/B)
        // On augmente le hackPercent drastiquement si on a de la marge
        if (config.hackPercent < 0.8) {
            config.hackPercent = Math.min(0.95, config.hackPercent + 0.05);
            ns.print(`   📈 AGGRESSIVE: hackPercent ${oldConfig.hackPercent.toFixed(2)} → ${config.hackPercent.toFixed(2)}`);
        } else {
            // Si déjà haut, on tente de réduire le security buffer
            if (config.securityThreshold > 1) {
                config.securityThreshold = Math.max(1, config.securityThreshold - 2);
                ns.print(`   📉 AGGRESSIVE: secThreshold ${oldConfig.securityThreshold} → ${config.securityThreshold}`);
            }
        }
    } else if (mode === "minor") {
        // Ajustements mineurs aléatoires
        const param = Math.floor(Math.random() * 3);

        switch (param) {
            case 0:
                config.hackPercent = Math.max(0.3, Math.min(0.9, config.hackPercent + (Math.random() - 0.5) * 0.1));
                ns.print(`   🔧 hackPercent ajusté: ${config.hackPercent.toFixed(2)}`);
                break;
            case 1:
                config.securityThreshold = Math.max(2, Math.min(10, config.securityThreshold + (Math.random() > 0.5 ? 1 : -1)));
                ns.print(`   🔧 securityThreshold ajusté: ${config.securityThreshold}`);
                break;
            case 2:
                config.moneyThreshold = Math.max(0.5, Math.min(0.95, config.moneyThreshold + (Math.random() - 0.5) * 0.1));
                ns.print(`   🔧 moneyThreshold ajusté: ${config.moneyThreshold.toFixed(2)}`);
                break;
        }
    }

    // Écrire la nouvelle config pour les autres daemons
    writeConfig(ns);
}

/**
 * Adapter la stratégie selon la phase du jeu
 */
function adaptToGamePhase(ns) {
    const money = ns.getServerMoneyAvailable("home");
    const hackLevel = ns.getHackingLevel();
    const servers = ns.getPurchasedServers();

    // Charger la config BitNode si disponible
    let bnConfig = { focus: "balanced", canHack: true };
    try {
        const bnData = ns.read("/data/bitnode-config.txt");
        if (bnData) bnConfig = JSON.parse(bnData);
    } catch (e) { }

    let phase = "early";

    // Si on est en BN8 (Trading), on force un profil conservateur sur le hack pour ne pas gaspiller de RAM
    if (!bnConfig.canHack) {
        config.hackPercent = 0.1; // Minimal pour exp
        ns.print("   🌍 BN Specifique: Hacking désactivé/réduit (Focus: " + bnConfig.focus + ")");
        return;
    }

    if (money > 1e12 && hackLevel > 1000) {
        phase = "endgame";
    } else if (money > 1e9 && hackLevel > 500) {
        phase = "late";
    } else if (money > 1e6 && hackLevel > 100) {
        phase = "mid";
    }

    // Ajuster la stratégie selon la phase
    switch (phase) {
        case "early":
            // Phase early: focus sur l'XP et la croissance
            config.hackPercent = Math.min(config.hackPercent, 0.5);
            break;
        case "mid":
            // Phase mid: équilibre entre argent et croissance
            config.hackPercent = 0.5;
            break;
        case "late":
            // Phase late: maximiser les profits
            config.hackPercent = 0.7;
            break;
        case "endgame":
            // Endgame: extraction maximale
            config.hackPercent = 0.9;
            break;
    }

    ns.print(`   📊 Phase détectée: ${phase.toUpperCase()}`);
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
        timestamp: Date.now(),
    });

    ns.write("/data/optimizer-config.txt", configData, "w");
}

/**
 * Afficher le statut
 */
function printStatus(ns, currentIncome, cycle) {
    ns.print("═══════════════════════════════════════");
    ns.print("  🧠 OPTIMIZER - Auto-Apprentissage");
    ns.print("═══════════════════════════════════════");
    ns.print("");
    ns.print(`📈 Revenu actuel: ${formatMoney(currentIncome)}/sec`);
    ns.print(`🔄 Cycle: ${cycle}`);
    ns.print(`📊 Échantillons: ${performanceHistory.length}/100`);
    ns.print("");
    ns.print("⚙️ Configuration actuelle:");
    ns.print(`   hackPercent: ${(config.hackPercent * 100).toFixed(0)}%`);
    ns.print(`   securityThreshold: ${config.securityThreshold}`);
    ns.print(`   moneyThreshold: ${(config.moneyThreshold * 100).toFixed(0)}%`);
    ns.print("");

    // Top 5 cibles par score
    const sortedTargets = Object.entries(targetStats)
        .sort((a, b) => b[1].theoreticalScore - a[1].theoreticalScore)
        .slice(0, 5);

    if (sortedTargets.length > 0) {
        ns.print("🎯 Meilleures cibles:");
        for (const [host, stats] of sortedTargets) {
            ns.print(`   ${host}: score ${stats.theoreticalScore.toFixed(2)}`);
        }
    }
    ns.print("");
}

/**
 * Sauvegarder les données
 */
function saveData(ns) {
    // Sauvegarder uniquement si on a des données significatives
    if (performanceHistory.length > 5 || Object.keys(targetStats).length > 0) {
        const data = JSON.stringify({
            config,
            // On garde un historique plus long pour l'analyse long terme
            performanceHistory: performanceHistory.slice(-200),
            targetStats,
            savedAt: Date.now(),
            // Meta-data pour savoir si on doit reset les stats au prochain chargement (si nouveau BN)
            bitNode: ns.getResetInfo().currentNode,
        });

        ns.write(DATA_FILE, data, "w");
    }
}

/**
 * Charger les données précédentes
 */
function loadData(ns) {
    try {
        const data = ns.read(DATA_FILE);
        if (data && data.length > 0) {
            const parsed = JSON.parse(data);

            if (parsed.config) config = { ...config, ...parsed.config };
            if (parsed.performanceHistory) performanceHistory = parsed.performanceHistory;
            if (parsed.targetStats) targetStats = parsed.targetStats;

            ns.print(`📂 Données chargées (${Object.keys(targetStats).length} cibles connues)`);
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
