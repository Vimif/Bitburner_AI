/**
 * Bitburner AI - Hacknet Daemon v2.0
 * Gestion avancée des Hacknet Nodes/Servers
 * 
 * Améliorations v2.0:
 * - ROI calculation amélioré
 * - Support Hacknet Servers (hashes)
 * - Hash spending prioritization
 * - Stats complètes
 * - Feedback vers optimizer
 * 
 * Usage: run daemon-hacknet.js
 */

import { HACKNET_CONFIG } from "../lib/constants.js";
import { formatMoney, formatTime } from "../lib/utils.js";
import { getState, sendFeedback } from "../lib/brain-state.js";

// Priorité de dépense des hashes
const HASH_PRIORITY = [
    "Sell for Corporation Funds",
    "Exchange for Bladeburner Rank",
    "Exchange for Bladeburner SP",
    "Reduce Minimum Security",
    "Increase Maximum Money",
    "Sell for Money",
];

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Détecter le mode (Hacknet Nodes vs Hacknet Servers)
    const isServerMode = ns.hacknet.hashCapacity !== undefined;

    let lastFeedbackTime = 0;
    let totalSpent = 0;
    let totalEarned = 0;

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const numNodes = ns.hacknet.numNodes();
        const state = getState(ns);

        // Calculer la production totale
        let totalProduction = 0;
        let totalLevel = 0;
        let totalRam = 0;
        let totalCores = 0;

        for (let i = 0; i < numNodes; i++) {
            const stats = ns.hacknet.getNodeStats(i);
            totalProduction += stats.production;
            totalLevel += stats.level;
            totalRam += stats.ram;
            totalCores += stats.cores;
            totalEarned += stats.totalProduction || 0;
        }

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print(`  🌐 HACKNET DAEMON v2.0 ${isServerMode ? "(Servers)" : "(Nodes)"}`);
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: ${formatMoney(money)}`);
        ns.print(`🌐 Nodes: ${numNodes}`);
        ns.print(`📈 Production: ${isServerMode ? formatHash(totalProduction) + "/sec" : formatMoney(totalProduction) + "/sec"}`);
        ns.print(`📊 Stats: Lv${totalLevel} | ${totalRam}GB RAM | ${totalCores} Cores`);
        ns.print("");

        // Gestion des Hashes (Hacknet Servers uniquement)
        if (isServerMode) {
            manageHashes(ns, state);
        }

        // Budget maximum pour l'investissement
        const maxInvestment = money * HACKNET_CONFIG.MAX_INVESTMENT_PERCENT;

        // Collecter toutes les actions possibles
        const actions = collectActions(ns, numNodes, maxInvestment);

        // Afficher les meilleures options
        if (actions.length > 0) {
            ns.print("📊 Meilleures options:");
            for (const action of actions.slice(0, 5)) {
                ns.print(`   ${action.description}`);
                ns.print(`      Coût: ${formatMoney(action.cost)} | ROI: ${formatTime(action.roi * 1000)}`);
            }
            ns.print("");

            // Exécuter la meilleure action si abordable
            const bestAction = actions[0];
            if (money >= bestAction.cost) {
                const success = executeAction(ns, bestAction);
                if (success) {
                    totalSpent += bestAction.cost;
                    ns.print(`✅ ${bestAction.description}`);
                    ns.toast(`Hacknet: ${bestAction.description}`, "success", 2000);
                }
            }
        } else {
            ns.print("⏳ Aucune action rentable disponible");
            ns.print(`   Budget max: ${formatMoney(maxInvestment)}`);
            ns.print(`   ROI max: ${formatTime(HACKNET_CONFIG.MAX_ROI_TIME * 1000)}`);
        }

        // Afficher les nodes
        ns.print("");
        ns.print("📋 Nodes:");
        for (let i = 0; i < Math.min(numNodes, 5); i++) {
            const stats = ns.hacknet.getNodeStats(i);
            ns.print(`   Node ${i}: Lv${stats.level} | ${stats.ram}GB | ${stats.cores}C`);
        }
        if (numNodes > 5) {
            ns.print(`   ... et ${numNodes - 5} autres`);
        }

        // Feedback
        if (Date.now() - lastFeedbackTime > 30000) {
            sendFeedback(ns, "hacknet", {
                nodes: numNodes,
                production: totalProduction,
                spent: totalSpent,
                isServerMode,
            });
            lastFeedbackTime = Date.now();
        }

        await ns.sleep(5000);
    }
}

/**
 * Collecter toutes les actions possibles avec leur ROI
 */
function collectActions(ns, numNodes, maxInvestment) {
    const actions = [];

    // Option: Acheter un nouveau node
    const newNodeCost = ns.hacknet.getPurchaseNodeCost();
    if (newNodeCost <= maxInvestment && newNodeCost < Infinity) {
        // Estimer la production d'un nouveau node de base
        // Production de base = environ 0.001 * level * mult
        const estimatedProd = 0.001 * 1; // Niveau 1
        const roi = estimatedProd > 0 ? newNodeCost / estimatedProd : HACKNET_CONFIG.MAX_ROI_TIME - 1;

        if (roi <= HACKNET_CONFIG.MAX_ROI_TIME) {
            actions.push({
                type: "buy",
                node: -1,
                cost: newNodeCost,
                roi: Math.min(roi, HACKNET_CONFIG.MAX_ROI_TIME - 1),
                description: `Nouveau node (#${numNodes})`,
            });
        }
    }

    // Options: Upgrader les nodes existants
    for (let i = 0; i < numNodes; i++) {
        const stats = ns.hacknet.getNodeStats(i);
        const currentProd = stats.production;

        // Upgrade Level
        const levelCost = ns.hacknet.getLevelUpgradeCost(i, 1);
        if (levelCost <= maxInvestment && levelCost < Infinity) {
            // ~1.6% gain par level
            const newProd = currentProd * 1.016;
            const prodGain = newProd - currentProd;
            const roi = prodGain > 0 ? levelCost / prodGain : Infinity;

            if (roi <= HACKNET_CONFIG.MAX_ROI_TIME) {
                actions.push({
                    type: "level",
                    node: i,
                    cost: levelCost,
                    roi,
                    description: `Node ${i}: Level ${stats.level} → ${stats.level + 1}`,
                });
            }
        }

        // Upgrade RAM
        const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
        if (ramCost <= maxInvestment && ramCost < Infinity) {
            // ~7% gain par RAM upgrade
            const newProd = currentProd * 1.07;
            const prodGain = newProd - currentProd;
            const roi = prodGain > 0 ? ramCost / prodGain : Infinity;

            if (roi <= HACKNET_CONFIG.MAX_ROI_TIME) {
                actions.push({
                    type: "ram",
                    node: i,
                    cost: ramCost,
                    roi,
                    description: `Node ${i}: RAM ${stats.ram}GB → ${stats.ram * 2}GB`,
                });
            }
        }

        // Upgrade Cores
        const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
        if (coreCost <= maxInvestment && coreCost < Infinity) {
            // ~10% gain par core
            const newProd = currentProd * 1.10;
            const prodGain = newProd - currentProd;
            const roi = prodGain > 0 ? coreCost / prodGain : Infinity;

            if (roi <= HACKNET_CONFIG.MAX_ROI_TIME) {
                actions.push({
                    type: "core",
                    node: i,
                    cost: coreCost,
                    roi,
                    description: `Node ${i}: Cores ${stats.cores} → ${stats.cores + 1}`,
                });
            }
        }
    }

    // Trier par ROI (le plus court d'abord)
    actions.sort((a, b) => a.roi - b.roi);

    return actions;
}

/**
 * Exécuter une action
 */
function executeAction(ns, action) {
    switch (action.type) {
        case "buy":
            return ns.hacknet.purchaseNode() !== -1;
        case "level":
            return ns.hacknet.upgradeLevel(action.node, 1);
        case "ram":
            return ns.hacknet.upgradeRam(action.node, 1);
        case "core":
            return ns.hacknet.upgradeCore(action.node, 1);
        default:
            return false;
    }
}

/**
 * Gérer les hashes (Hacknet Servers uniquement)
 */
function manageHashes(ns, state) {
    try {
        const hashes = ns.hacknet.numHashes();
        const capacity = ns.hacknet.hashCapacity();

        ns.print(`🔷 Hashes: ${formatHash(hashes)} / ${formatHash(capacity)}`);

        // Si on approche de la capacité, dépenser
        if (hashes > capacity * 0.8) {
            for (const upgrade of HASH_PRIORITY) {
                try {
                    // Vérifier si cette dépense est appropriée selon le contexte
                    if (upgrade === "Sell for Corporation Funds") {
                        // Seulement si on a une corporation
                        try {
                            ns.corporation.getCorporation();
                        } catch (e) {
                            continue;
                        }
                    }

                    if (upgrade === "Exchange for Bladeburner Rank" ||
                        upgrade === "Exchange for Bladeburner SP") {
                        // Seulement si on est dans Bladeburner
                        try {
                            if (!ns.bladeburner.inBladeburner()) continue;
                        } catch (e) {
                            continue;
                        }
                    }

                    if (ns.hacknet.spendHashes(upgrade)) {
                        ns.print(`   💎 Dépensé: ${upgrade}`);
                        return;
                    }
                } catch (e) { }
            }

            // Fallback: vendre pour argent
            ns.hacknet.spendHashes("Sell for Money");
            ns.print(`   💰 Hashes → Money`);
        }
    } catch (e) { }
}

/**
 * Formater les hashes
 */
function formatHash(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return n.toFixed(2);
}
