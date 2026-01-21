/**
 * Bitburner AI - Server Daemon
 * Gestion automatique des serveurs personnels
 * 
 * Achète et upgrade les serveurs automatiquement
 * 
 * Usage: run daemon-servers.js
 */

import { SERVER_CONFIG } from "../lib/constants.js";
import { formatMoney, formatRam } from "../lib/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    ns.print("═══════════════════════════════════════");
    ns.print("  🖥️ BITBURNER AI - SERVER DAEMON");
    ns.print("═══════════════════════════════════════");

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const ownedServers = ns.getPurchasedServers();

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🖥️ SERVER DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: ${formatMoney(money)}`);
        ns.print(`🖥️ Serveurs: ${ownedServers.length}/${SERVER_CONFIG.MAX_SERVERS}`);
        ns.print("");

        // Afficher les serveurs actuels
        if (ownedServers.length > 0) {
            ns.print("📋 Serveurs possédés:");
            const sortedServers = [...ownedServers].sort((a, b) => {
                return ns.getServerMaxRam(b) - ns.getServerMaxRam(a);
            });
            for (const server of sortedServers.slice(0, 10)) {
                const ram = ns.getServerMaxRam(server);
                ns.print(`   ${server}: ${formatRam(ram)}`);
            }
            if (sortedServers.length > 10) {
                ns.print(`   ... et ${sortedServers.length - 10} autres`);
            }
            ns.print("");
        }

        // Déterminer la meilleure action
        if (ownedServers.length < SERVER_CONFIG.MAX_SERVERS) {
            // On peut encore acheter des serveurs
            const optimalRam = getOptimalRamToBuy(ns, money);

            if (optimalRam >= SERVER_CONFIG.MIN_RAM) {
                const cost = ns.getPurchasedServerCost(optimalRam);

                if (money >= cost * SERVER_CONFIG.COST_MULTIPLIER) {
                    const serverName = `${SERVER_CONFIG.PREFIX}${ownedServers.length}`;
                    const newServer = ns.purchaseServer(serverName, optimalRam);

                    if (newServer) {
                        ns.print(`✅ Acheté: ${newServer} (${formatRam(optimalRam)})`);
                        ns.toast(`Nouveau serveur: ${newServer}`, "success", 3000);
                    }
                } else {
                    const nextOptimal = getOptimalRamToBuy(ns, money * SERVER_CONFIG.COST_MULTIPLIER);
                    const nextCost = ns.getPurchasedServerCost(nextOptimal);
                    ns.print(`⏳ Prochain achat: ${formatRam(nextOptimal)}`);
                    ns.print(`   Coût: ${formatMoney(nextCost)}`);
                    ns.print(`   Besoin: ${formatMoney(nextCost * SERVER_CONFIG.COST_MULTIPLIER)}`);
                }
            }
        } else {
            // On a le max de serveurs, essayer d'upgrader
            const upgraded = await tryUpgradeServer(ns, money, ownedServers);

            if (!upgraded) {
                const smallestRam = getSmallestServerRam(ns, ownedServers);
                const nextRam = smallestRam * 2;

                if (nextRam <= SERVER_CONFIG.MAX_RAM) {
                    const upgradeCost = ns.getPurchasedServerCost(nextRam);
                    ns.print(`⏳ Prochain upgrade: ${formatRam(smallestRam)} → ${formatRam(nextRam)}`);
                    ns.print(`   Coût: ${formatMoney(upgradeCost)}`);
                    ns.print(`   Besoin: ${formatMoney(upgradeCost * SERVER_CONFIG.COST_MULTIPLIER)}`);
                } else {
                    ns.print("🎉 Tous les serveurs sont au maximum!");
                }
            }
        }

        await ns.sleep(10000); // Vérifier toutes les 10 secondes
    }
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

    return smallestRam;
}

/**
 * Tenter d'upgrader un serveur
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

    if (!serverToUpgrade) return false;

    const newRam = minRam * 2;
    if (newRam > SERVER_CONFIG.MAX_RAM) return false;

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
            return true;
        }
    }

    return false;
}
