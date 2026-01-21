/**
 * Bitburner AI - Hacknet Daemon
 * Gestion automatique des Hacknet Nodes
 * 
 * Achète et upgrade les nodes selon le meilleur ROI
 * 
 * Usage: run daemon-hacknet.js
 */

import { HACKNET_CONFIG } from "../lib/constants.js";
import { formatMoney, formatTime } from "../lib/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const numNodes = ns.hacknet.numNodes();

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🌐 HACKNET DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: ${formatMoney(money)}`);
        ns.print(`🌐 Nodes: ${numNodes}`);
        ns.print("");

        // Calculer la production totale
        let totalProduction = 0;
        for (let i = 0; i < numNodes; i++) {
            const stats = ns.hacknet.getNodeStats(i);
            totalProduction += stats.production;
        }
        ns.print(`📈 Production: ${formatMoney(totalProduction)}/sec`);
        ns.print("");

        // Budget maximum pour l'investissement
        const maxInvestment = money * HACKNET_CONFIG.MAX_INVESTMENT_PERCENT;

        // Trouver la meilleure action
        const actions = [];

        // Option 1: Acheter un nouveau node
        const newNodeCost = ns.hacknet.getPurchaseNodeCost();
        if (newNodeCost <= maxInvestment) {
            // Estimer la production d'un nouveau node
            // Note: Pour Hacknet Servers, la prod est en Hashes, pour Classic en Money.
            // On utilise une heuristique simple: cout / 1000 pour éviter de bloquer
            const roi = newNodeCost / 10000; // Fake ROI pour pas bloquer

            // Pour les serveurs classiques, on garde le calcul précis si possible
            // Mais pour simplifier la compatibilité Hashnet/Classic, on simplifie

            if (roi <= HACKNET_CONFIG.MAX_ROI_TIME) {
                actions.push({
                    type: "buy",
                    node: -1,
                    cost: newNodeCost,
                    roi: roi,
                    description: "Nouveau node"
                });
            }
        }

        // Options 2-4: Upgrader les nodes existants
        for (let i = 0; i < numNodes; i++) {
            const stats = ns.hacknet.getNodeStats(i);

            // Upgrade Level
            const levelCost = ns.hacknet.getLevelUpgradeCost(i, 1);
            if (levelCost <= maxInvestment && levelCost < Infinity) {
                const currentProd = stats.production;
                // Approximation: +1.5% production par level
                const newProd = currentProd * 1.015;
                const prodGain = newProd - currentProd;
                const roi = prodGain > 0 ? levelCost / prodGain : Infinity;

                if (roi <= HACKNET_CONFIG.MAX_ROI_TIME) {
                    actions.push({
                        type: "level",
                        node: i,
                        cost: levelCost,
                        roi: roi,
                        description: `Node ${i}: Level ${stats.level} → ${stats.level + 1}`
                    });
                }
            }

            // Upgrade RAM
            const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
            if (ramCost <= maxInvestment && ramCost < Infinity) {
                const currentProd = stats.production;
                // Approximation: +7% production par RAM upgrade
                const newProd = currentProd * 1.07;
                const prodGain = newProd - currentProd;
                const roi = prodGain > 0 ? ramCost / prodGain : Infinity;

                if (roi <= HACKNET_CONFIG.MAX_ROI_TIME) {
                    actions.push({
                        type: "ram",
                        node: i,
                        cost: ramCost,
                        roi: roi,
                        description: `Node ${i}: RAM ${stats.ram}GB → ${stats.ram * 2}GB`
                    });
                }
            }

            // Upgrade Cores
            const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
            if (coreCost <= maxInvestment && coreCost < Infinity) {
                const currentProd = stats.production;
                // Approximation: +10% production par core
                const newProd = currentProd * 1.10;
                const prodGain = newProd - currentProd;
                const roi = prodGain > 0 ? coreCost / prodGain : Infinity;

                if (roi <= HACKNET_CONFIG.MAX_ROI_TIME) {
                    actions.push({
                        type: "core",
                        node: i,
                        cost: coreCost,
                        roi: roi,
                        description: `Node ${i}: Cores ${stats.cores} → ${stats.cores + 1}`
                    });
                }
            }
        }

        // Trier par ROI (le plus court d'abord)
        actions.sort((a, b) => a.roi - b.roi);

        // Afficher les meilleures options
        if (actions.length > 0) {
            ns.print("📊 Meilleures options:");
            for (const action of actions.slice(0, 5)) {
                ns.print(`   ${action.description}`);
                ns.print(`      Coût: ${formatMoney(action.cost)} | ROI: ${formatTime(action.roi * 1000)}`);
            }
            ns.print("");

            // Exécuter la meilleure action si on a l'argent
            const bestAction = actions[0];
            if (money >= bestAction.cost) {
                let success = false;

                switch (bestAction.type) {
                    case "buy":
                        success = ns.hacknet.purchaseNode() !== -1;
                        break;
                    case "level":
                        success = ns.hacknet.upgradeLevel(bestAction.node, 1);
                        break;
                    case "ram":
                        success = ns.hacknet.upgradeRam(bestAction.node, 1);
                        break;
                    case "core":
                        success = ns.hacknet.upgradeCore(bestAction.node, 1);
                        break;
                }

                if (success) {
                    ns.print(`✅ ${bestAction.description}`);
                    ns.toast(`Hacknet: ${bestAction.description}`, "success", 2000);
                }
            }
        } else {
            ns.print("⏳ Aucune action rentable disponible");
            ns.print(`   Budget max: ${formatMoney(maxInvestment)}`);
            ns.print(`   ROI max: ${formatTime(HACKNET_CONFIG.MAX_ROI_TIME * 1000)}`);
        }

        // ... (gestion des upgrades existants)

        // Gestion des Hashes (Hacknet Servers)
        if (ns.hacknet.numHashes) { // Vérifie si l'API Hash existe
            const hashes = ns.hacknet.numHashes();
            const capacity = ns.hacknet.hashCapacity();

            // Si on est proche de la capacité max, il faut dépenser
            if (hashes > capacity * 0.9) {
                // Priorité 1: Corporatartion Funds (si Corp existe et < 100t)
                let spent = false;
                try {
                    // Vérifier si corp existe (simple check d'erreur ou API)
                    // Note: Simple heuristic, si on peut vendre pour corp funds
                    if (ns.hacknet.spendHashes("Exchange for Corporation Funds")) {
                        ns.print("🏢 Hashes -> Corp Funds");
                        spent = true;
                    }
                } catch (e) { }

                // Priorité 2: Bladeburner (Rank & SP)
                if (!spent) {
                    try {
                        if (ns.hacknet.spendHashes("Exchange for Bladeburner Rank")) {
                            ns.print("⚔️ Hashes -> Bladeburner Rank");
                            spent = true;
                        }
                    } catch (e) { }
                }

                // Priorité 3: Argent (buffer par défaut)
                if (!spent) {
                    ns.hacknet.spendHashes("Sell for Money");
                    ns.print("💰 Hashes -> Money");
                }
            }
        }

        await ns.sleep(5000);
    }
}
