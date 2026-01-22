/**
 * Bitburner AI - Buyer Daemon v2.0
 * Achat automatique des programmes et upgrades
 * 
 * Améliorations v2.0:
 * - Achat priorisé des programmes de crack
 * - Upgrades maison (RAM, Cores)
 * - Détection des programmes manquants
 * - Feedback vers optimizer
 * 
 * Nécessite: Singularity API (BitNode 4 ou Source-File 4)
 * 
 * Usage: run daemon-buyer.js
 */

import { formatMoney, formatRam } from "../lib/utils.js";
import { sendFeedback } from "../lib/brain-state.js";

// Programmes à acheter (par priorité)
const PROGRAMS = [
    { name: "BruteSSH.exe", cost: 500000 },
    { name: "FTPCrack.exe", cost: 1500000 },
    { name: "relaySMTP.exe", cost: 5000000 },
    { name: "HTTPWorm.exe", cost: 30000000 },
    { name: "SQLInject.exe", cost: 250000000 },
    { name: "DeepscanV1.exe", cost: 500000 },
    { name: "DeepscanV2.exe", cost: 25000000 },
    { name: "ServerProfiler.exe", cost: 500000 },
    { name: "AutoLink.exe", cost: 1000000 },
    { name: "Formulas.exe", cost: 5000000000 },
];

// Tor Router cost
const TOR_COST = 200000;

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier l'accès Singularity
    try {
        ns.singularity.purchaseTor();
    } catch (e) {
        // Peut échouer si déjà acheté, ce n'est pas grave
    }

    let lastFeedbackTime = 0;
    let totalSpent = 0;

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const homeRam = ns.getServerMaxRam("home");
        const homeCores = ns.getServer("home").cpuCores;

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🛒 BUYER DAEMON v2.0");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: ${formatMoney(money)}`);
        ns.print(`🏠 Home: ${formatRam(homeRam)} RAM | ${homeCores} Cores`);
        ns.print(`💸 Total dépensé: ${formatMoney(totalSpent)}`);
        ns.print("");

        // 1. Acheter TOR si nécessaire
        if (!hasTor(ns)) {
            if (money >= TOR_COST * 2) {
                try {
                    ns.singularity.purchaseTor();
                    ns.print("✅ TOR Router acheté!");
                    ns.toast("TOR Router acheté!", "success");
                    totalSpent += TOR_COST;
                } catch (e) { }
            } else {
                ns.print(`⏳ TOR Router: ${formatMoney(TOR_COST)}`);
            }
        }

        // 2. Acheter les programmes manquants
        ns.print("📦 Programmes:");
        let programsBought = 0;

        for (const prog of PROGRAMS) {
            const owned = ns.fileExists(prog.name, "home");

            if (owned) {
                ns.print(`   ✅ ${prog.name}`);
            } else {
                if (hasTor(ns) && money >= prog.cost * 1.5) {
                    try {
                        if (ns.singularity.purchaseProgram(prog.name)) {
                            ns.print(`   🆕 ${prog.name} acheté!`);
                            ns.toast(`Acheté ${prog.name}`, "success");
                            totalSpent += prog.cost;
                            programsBought++;
                        }
                    } catch (e) { }
                } else {
                    ns.print(`   ❌ ${prog.name} (${formatMoney(prog.cost)})`);
                }
            }
        }
        ns.print("");

        // 3. Upgrades Home
        ns.print("🏠 Home Upgrades:");

        // RAM Upgrade
        try {
            const ramCost = ns.singularity.getUpgradeHomeRamCost();
            if (ramCost < Infinity) {
                if (money >= ramCost * 2) {
                    if (ns.singularity.upgradeHomeRam()) {
                        const newRam = ns.getServerMaxRam("home");
                        ns.print(`   ⬆️ RAM upgradée: ${formatRam(newRam)}`);
                        ns.toast(`Home RAM: ${formatRam(newRam)}`, "success");
                        totalSpent += ramCost;
                    }
                } else {
                    ns.print(`   💾 RAM: ${formatMoney(ramCost)} (${formatRam(homeRam * 2)})`);
                }
            } else {
                ns.print("   💾 RAM: MAX");
            }
        } catch (e) { }

        // Cores Upgrade
        try {
            const coresCost = ns.singularity.getUpgradeHomeCoresCost();
            if (coresCost < Infinity) {
                if (money >= coresCost * 3) {
                    if (ns.singularity.upgradeHomeCores()) {
                        const newCores = ns.getServer("home").cpuCores;
                        ns.print(`   ⬆️ Cores upgradés: ${newCores}`);
                        ns.toast(`Home Cores: ${newCores}`, "success");
                        totalSpent += coresCost;
                    }
                } else {
                    ns.print(`   ⚙️ Cores: ${formatMoney(coresCost)} (${homeCores + 1} cores)`);
                }
            } else {
                ns.print("   ⚙️ Cores: MAX");
            }
        } catch (e) { }

        // 4. Stats des programmes de crack
        ns.print("");
        ns.print("🔓 Crack Programs:");
        const crackPrograms = [
            "BruteSSH.exe",
            "FTPCrack.exe",
            "relaySMTP.exe",
            "HTTPWorm.exe",
            "SQLInject.exe"
        ];

        let cracksOwned = 0;
        for (const prog of crackPrograms) {
            if (ns.fileExists(prog, "home")) {
                cracksOwned++;
            }
        }
        ns.print(`   ${cracksOwned}/5 (Peut rooter ${cracksOwned}-port servers)`);

        // Feedback
        if (Date.now() - lastFeedbackTime > 60000) {
            const ownedPrograms = PROGRAMS.filter(p => ns.fileExists(p.name, "home")).length;
            sendFeedback(ns, "buyer", {
                programs: ownedPrograms,
                totalPrograms: PROGRAMS.length,
                homeRam,
                homeCores,
                spent: totalSpent,
            });
            lastFeedbackTime = Date.now();
        }

        await ns.sleep(30000); // Check toutes les 30 secondes
    }
}

/**
 * Vérifier si on a TOR
 */
function hasTor(ns) {
    try {
        // Si on peut voir le darkweb, on a TOR
        const servers = ns.scan("home");
        return servers.includes("darkweb");
    } catch (e) {
        return false;
    }
}
