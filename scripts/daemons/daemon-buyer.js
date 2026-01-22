/**
 * Bitburner AI - Buyer Daemon (Lightweight)
 * RAM: ~6GB (Singularity API)
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    try {
        ns.singularity.purchaseTor();
    } catch (e) { }

    const PROGRAMS = [
        { name: "BruteSSH.exe", cost: 500e3 },
        { name: "FTPCrack.exe", cost: 1.5e6 },
        { name: "relaySMTP.exe", cost: 5e6 },
        { name: "HTTPWorm.exe", cost: 30e6 },
        { name: "SQLInject.exe", cost: 250e6 },
        { name: "DeepscanV1.exe", cost: 500e3 },
        { name: "DeepscanV2.exe", cost: 25e6 },
        { name: "ServerProfiler.exe", cost: 500e3 },
        { name: "AutoLink.exe", cost: 1e6 },
        { name: "Formulas.exe", cost: 5e9 },
    ];

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const homeRam = ns.getServerMaxRam("home");
        const cores = ns.getServer("home").cpuCores;

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🛒 BUYER DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: ${formatMoney(money)}`);
        ns.print(`🏠 Home: ${homeRam}GB RAM | ${cores} Cores`);
        ns.print("");

        // TOR
        const hasTor = ns.scan("home").includes("darkweb");
        if (!hasTor && money >= 400e3) {
            try {
                ns.singularity.purchaseTor();
                ns.toast("TOR acheté!", "success");
            } catch (e) { }
        }

        // Programmes
        ns.print("📦 Programmes:");
        let cracksOwned = 0;

        for (const prog of PROGRAMS) {
            const owned = ns.fileExists(prog.name, "home");

            if (owned) {
                ns.print(`   ✅ ${prog.name}`);
                if (["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"]
                    .includes(prog.name)) {
                    cracksOwned++;
                }
            } else if (hasTor && money >= prog.cost * 1.5) {
                try {
                    if (ns.singularity.purchaseProgram(prog.name)) {
                        ns.print(`   🆕 ${prog.name}`);
                        ns.toast(`Acheté ${prog.name}`, "success");
                    }
                } catch (e) { }
            } else {
                ns.print(`   ❌ ${prog.name} (${formatMoney(prog.cost)})`);
            }
        }
        ns.print("");
        ns.print(`🔓 Cracks: ${cracksOwned}/5`);
        ns.print("");

        // Home upgrades
        ns.print("🏠 Upgrades:");
        try {
            const ramCost = ns.singularity.getUpgradeHomeRamCost();
            if (ramCost < Infinity) {
                if (money >= ramCost * 2) {
                    if (ns.singularity.upgradeHomeRam()) {
                        ns.toast("RAM upgradée!", "success");
                    }
                }
                ns.print(`   💾 RAM: ${formatMoney(ramCost)}`);
            } else {
                ns.print("   💾 RAM: MAX");
            }
        } catch (e) { }

        try {
            const coreCost = ns.singularity.getUpgradeHomeCoresCost();
            if (coreCost < Infinity) {
                if (money >= coreCost * 3) {
                    if (ns.singularity.upgradeHomeCores()) {
                        ns.toast("Cores upgradés!", "success");
                    }
                }
                ns.print(`   ⚙️ Cores: ${formatMoney(coreCost)}`);
            } else {
                ns.print("   ⚙️ Cores: MAX");
            }
        } catch (e) { }

        await ns.sleep(30000);
    }
}

function formatMoney(n) {
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "k";
    return "$" + n.toFixed(0);
}
