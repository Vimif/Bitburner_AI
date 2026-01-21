/**
 * Bitburner AI - Auto Buyer Daemon
 * Achète automatiquement les programmes et upgrades
 * 
 * Fonctionnalités:
 * - Achète le TOR router dès que possible
 * - Achète les programmes crack dans l'ordre optimal
 * - Upgrade la RAM de home
 * - Achète les serveurs optimaux
 * 
 * Usage: run daemon-buyer.js
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier l'accès Singularity
    try {
        ns.singularity.getUpgradeHomeRamCost();
    } catch (e) {
        ns.tprint("❌ Singularity API non disponible.");
        ns.tprint("   Nécessite BitNode 4 ou Source-File 4.");
        return;
    }

    // Programme à acheter dans l'ordre de priorité
    const PROGRAMS = [
        { name: "BruteSSH.exe", cost: 500000 },
        { name: "FTPCrack.exe", cost: 1500000 },
        { name: "relaySMTP.exe", cost: 5000000 },
        { name: "HTTPWorm.exe", cost: 30000000 },
        { name: "SQLInject.exe", cost: 250000000 },
        { name: "ServerProfiler.exe", cost: 500000 },
        { name: "DeepscanV1.exe", cost: 500000 },
        { name: "DeepscanV2.exe", cost: 25000000 },
        { name: "AutoLink.exe", cost: 1000000 },
        { name: "Formulas.exe", cost: 5000000000 },
    ];

    let lastPurchase = "";

    while (true) {
        const money = ns.getServerMoneyAvailable("home");

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🛒 AUTO BUYER DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: $${formatMoney(money)}`);
        ns.print("");

        // Vérifier si on a le TOR
        if (!ns.hasTorRouter()) {
            const torCost = 200000;
            if (money >= torCost * 2) {
                const success = ns.singularity.purchaseTor();
                if (success) {
                    lastPurchase = "TOR Router";
                    ns.toast("🌐 TOR Router acheté!", "success");
                }
            } else {
                ns.print(`⏳ TOR Router: $200k (besoin: $${formatMoney(torCost * 2)})`);
            }
        } else {
            ns.print("✅ TOR Router: Possédé");

            // Acheter les programmes
            ns.print("");
            ns.print("📦 Programmes:");

            for (const prog of PROGRAMS) {
                if (ns.fileExists(prog.name, "home")) {
                    ns.print(`   ✅ ${prog.name}`);
                } else {
                    if (money >= prog.cost * 1.5) {
                        const success = ns.singularity.purchaseProgram(prog.name);
                        if (success) {
                            lastPurchase = prog.name;
                            ns.toast(`📦 ${prog.name} acheté!`, "success");
                        }
                    } else {
                        ns.print(`   ⏳ ${prog.name}: $${formatMoney(prog.cost)}`);
                    }
                }
            }
        }

        // Upgrade RAM de home
        ns.print("");
        ns.print("💾 RAM Home:");

        const currentRam = ns.getServerMaxRam("home");
        const upgradeCost = ns.singularity.getUpgradeHomeRamCost();

        if (money >= upgradeCost * 2 && currentRam < 1048576) {
            const success = ns.singularity.upgradeHomeRam();
            if (success) {
                lastPurchase = `RAM ${currentRam * 2}GB`;
                ns.toast(`💾 RAM Home upgradée!`, "success");
            }
        }

        ns.print(`   Actuel: ${currentRam}GB`);
        ns.print(`   Prochain: $${formatMoney(upgradeCost)}`);

        // Upgrade Cores de home
        const coresCost = ns.singularity.getUpgradeHomeCoresCost();
        if (money >= coresCost * 2) {
            ns.singularity.upgradeHomeCores();
        }

        if (lastPurchase) {
            ns.print("");
            ns.print(`🛒 Dernier achat: ${lastPurchase}`);
        }

        await ns.sleep(10000);
    }
}

function formatMoney(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
