/**
 * Bitburner AI - Server Daemon v2.0
 * Gestion automatique des serveurs personnels
 * 
 * Améliorations v2.0:
 * - Stratégie d'achat progressive
 * - Upgrade intelligent (plus petite RAM d'abord)
 * - Stats de RAM totale
 * - Feedback vers optimizer
 * - Redéploiement automatique des workers après upgrade
 * 
 * Usage: run daemon-servers.js
 */

import { SERVER_CONFIG } from "../lib/constants.js";
import { formatMoney, formatRam } from "../lib/utils.js";
import { getState, sendFeedback } from "../lib/brain-state.js";

// Workers à déployer
const DEPLOY_SCRIPTS = [
    "/workers/hack.js",
    "/workers/grow.js",
    "/workers/weaken.js",
];

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    let lastFeedbackTime = 0;
    let totalUpgrades = 0;
    let totalPurchases = 0;

    ns.print("═══════════════════════════════════════");
    ns.print("  🖥️ SERVER DAEMON v2.0");
    ns.print("═══════════════════════════════════════");

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const ownedServers = ns.getPurchasedServers();
        const state = getState(ns);

        // Calculer les stats
        let totalRam = 0;
        let usedRam = 0;
        for (const server of ownedServers) {
            totalRam += ns.getServerMaxRam(server);
            usedRam += ns.getServerUsedRam(server);
        }

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🖥️ SERVER DAEMON v2.0");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: ${formatMoney(money)}`);
        ns.print(`🖥️ Serveurs: ${ownedServers.length}/${SERVER_CONFIG.MAX_SERVERS}`);
        ns.print(`💾 RAM totale: ${formatRam(totalRam)}`);
        ns.print(`📊 Utilisation: ${formatRam(usedRam)} (${totalRam > 0 ? ((usedRam / totalRam) * 100).toFixed(0) : 0}%)`);
        ns.print(`⬆️ Upgrades: ${totalUpgrades} | Achats: ${totalPurchases}`);
        ns.print("");

        // Afficher les serveurs par RAM (top 5 + bottom 5)
        if (ownedServers.length > 0) {
            const sortedServers = [...ownedServers].sort((a, b) => {
                return ns.getServerMaxRam(b) - ns.getServerMaxRam(a);
            });

            ns.print("📋 Serveurs (par RAM):");

            // Top 3
            for (const server of sortedServers.slice(0, 3)) {
                const ram = ns.getServerMaxRam(server);
                const used = ns.getServerUsedRam(server);
                ns.print(`   🟢 ${server}: ${formatRam(ram)} (${((used / ram) * 100).toFixed(0)}% used)`);
            }

            if (sortedServers.length > 6) {
                ns.print(`   ... ${sortedServers.length - 6} autres ...`);
            }

            // Bottom 3 (pour montrer les cibles d'upgrade)
            if (sortedServers.length > 3) {
                const bottom = sortedServers.slice(-3).reverse();
                for (const server of bottom) {
                    const ram = ns.getServerMaxRam(server);
                    const nextRam = Math.min(ram * 2, SERVER_CONFIG.MAX_RAM);
                    const upgradeCost = ns.getPurchasedServerCost(nextRam);
                    const canUpgrade = money >= upgradeCost * SERVER_CONFIG.COST_MULTIPLIER;
                    const icon = canUpgrade ? "🟡" : "🔴";
                    ns.print(`   ${icon} ${server}: ${formatRam(ram)} → ${formatRam(nextRam)}`);
                }
            }
            ns.print("");
        }

        // Stratégie: Acheter d'abord jusqu'au max, puis upgrader
        if (ownedServers.length < SERVER_CONFIG.MAX_SERVERS) {
            // Phase d'achat
            const result = await tryBuyServer(ns, money);
            if (result) {
                totalPurchases++;
                // Déployer les workers sur le nouveau serveur
                await deployWorkers(ns, result);
            } else {
                // Afficher le prochain achat
                showNextPurchase(ns, money);
            }
        } else {
            // Phase d'upgrade
            const result = await tryUpgradeServer(ns, money, ownedServers);
            if (result) {
                totalUpgrades++;
                // Déployer les workers sur le serveur upgradé
                await deployWorkers(ns, result);
            } else {
                // Afficher le prochain upgrade
                showNextUpgrade(ns, money, ownedServers);
            }
        }

        // Feedback
        if (Date.now() - lastFeedbackTime > 30000) {
            sendFeedback(ns, "servers", {
                count: ownedServers.length,
                totalRam,
                usedRam,
                purchases: totalPurchases,
                upgrades: totalUpgrades,
            });
            lastFeedbackTime = Date.now();
        }

        await ns.sleep(10000);
    }
}

/**
 * Essayer d'acheter un nouveau serveur
 */
async function tryBuyServer(ns, money) {
    const ownedServers = ns.getPurchasedServers();
    const optimalRam = getOptimalRamToBuy(ns, money);

    if (optimalRam < SERVER_CONFIG.MIN_RAM) return null;

    const cost = ns.getPurchasedServerCost(optimalRam);

    if (money >= cost * SERVER_CONFIG.COST_MULTIPLIER) {
        const serverName = `${SERVER_CONFIG.PREFIX}${ownedServers.length}`;
        const newServer = ns.purchaseServer(serverName, optimalRam);

        if (newServer) {
            ns.print(`✅ Acheté: ${newServer} (${formatRam(optimalRam)})`);
            ns.toast(`Nouveau serveur: ${newServer}`, "success", 3000);
            return newServer;
        }
    }

    return null;
}

/**
 * Essayer d'upgrader un serveur
 */
async function tryUpgradeServer(ns, money, servers) {
    // Trouver le serveur avec le moins de RAM
    let minRam = Infinity;
    let serverToUpgrade = null;

    for (const server of servers) {
        const ram = ns.getServerMaxRam(server);
        if (ram < minRam && ram < SERVER_CONFIG.MAX_RAM) {
            minRam = ram;
            serverToUpgrade = server;
        }
    }

    if (!serverToUpgrade) return null;

    const newRam = Math.min(minRam * 2, SERVER_CONFIG.MAX_RAM);
    if (newRam <= minRam) return null;

    const cost = ns.getPurchasedServerCost(newRam);

    if (money >= cost * SERVER_CONFIG.COST_MULTIPLIER) {
        // Tuer tous les scripts sur le serveur
        ns.killall(serverToUpgrade);

        // Supprimer le serveur
        ns.deleteServer(serverToUpgrade);

        // Acheter un nouveau serveur avec plus de RAM
        const newServer = ns.purchaseServer(serverToUpgrade, newRam);

        if (newServer) {
            ns.print(`⬆️ Upgrade: ${serverToUpgrade} (${formatRam(minRam)} → ${formatRam(newRam)})`);
            ns.toast(`Serveur upgradé: ${newServer}`, "success", 3000);
            return newServer;
        }
    }

    return null;
}

/**
 * Afficher le prochain achat possible
 */
function showNextPurchase(ns, money) {
    const targetRam = getOptimalRamToBuy(ns, money * 2);
    if (targetRam < SERVER_CONFIG.MIN_RAM) return;

    const cost = ns.getPurchasedServerCost(targetRam);
    const needed = cost * SERVER_CONFIG.COST_MULTIPLIER;

    ns.print(`⏳ Prochain achat: ${formatRam(targetRam)}`);
    ns.print(`   Coût: ${formatMoney(cost)}`);
    ns.print(`   Besoin: ${formatMoney(needed)} (${((money / needed) * 100).toFixed(0)}%)`);
}

/**
 * Afficher le prochain upgrade possible
 */
function showNextUpgrade(ns, money, servers) {
    const smallestRam = getSmallestServerRam(ns, servers);

    if (smallestRam >= SERVER_CONFIG.MAX_RAM) {
        ns.print("🎉 Tous les serveurs sont au maximum!");
        return;
    }

    const newRam = Math.min(smallestRam * 2, SERVER_CONFIG.MAX_RAM);
    const cost = ns.getPurchasedServerCost(newRam);
    const needed = cost * SERVER_CONFIG.COST_MULTIPLIER;

    ns.print(`⏳ Prochain upgrade: ${formatRam(smallestRam)} → ${formatRam(newRam)}`);
    ns.print(`   Coût: ${formatMoney(cost)}`);
    ns.print(`   Besoin: ${formatMoney(needed)} (${((money / needed) * 100).toFixed(0)}%)`);
}

/**
 * Déployer les workers sur un serveur
 */
async function deployWorkers(ns, server) {
    try {
        ns.scp(DEPLOY_SCRIPTS, server, "home");
    } catch (e) { }
}

/**
 * Calculer la RAM optimale à acheter pour un budget donné
 */
function getOptimalRamToBuy(ns, money) {
    let ram = SERVER_CONFIG.MIN_RAM;

    while (ram * 2 <= SERVER_CONFIG.MAX_RAM) {
        const cost = ns.getPurchasedServerCost(ram * 2);
        if (cost > money / SERVER_CONFIG.COST_MULTIPLIER) break;
        ram *= 2;
    }

    return ram;
}

/**
 * Trouver le serveur avec le moins de RAM
 */
function getSmallestServerRam(ns, servers) {
    let smallestRam = Infinity;

    for (const server of servers) {
        const ram = ns.getServerMaxRam(server);
        if (ram < smallestRam) {
            smallestRam = ram;
        }
    }

    return smallestRam === Infinity ? 0 : smallestRam;
}
