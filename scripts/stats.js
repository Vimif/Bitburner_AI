/**
 * Bitburner AI - Stats Dashboard
 * Affiche un tableau de bord complet des statistiques
 * 
 * Usage: run stats.js
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const startMoney = ns.getServerMoneyAvailable("home");
    const startTime = Date.now();
    let maxIncome = 0;
    let incomeHistory = [];

    while (true) {
        ns.clearLog();

        const money = ns.getServerMoneyAvailable("home");
        const runtime = (Date.now() - startTime) / 1000;
        const income = ns.getTotalScriptIncome();
        const currentIncome = income[0];

        // Tracker l'historique
        incomeHistory.push(currentIncome);
        if (incomeHistory.length > 60) incomeHistory.shift();

        const avgIncome = incomeHistory.reduce((a, b) => a + b, 0) / incomeHistory.length;
        maxIncome = Math.max(maxIncome, currentIncome);

        // Compter les serveurs
        const servers = getAllServers(ns);
        const rootedCount = servers.filter(s => ns.hasRootAccess(s)).length;
        const hackableCount = servers.filter(s =>
            ns.hasRootAccess(s) &&
            ns.getServerMaxMoney(s) > 0 &&
            ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel()
        ).length;

        // RAM totale
        let totalRam = 0;
        let usedRam = 0;
        for (const host of servers) {
            if (ns.hasRootAccess(host)) {
                totalRam += ns.getServerMaxRam(host);
                usedRam += ns.getServerUsedRam(host);
            }
        }

        // Purchased servers
        const pservers = ns.getPurchasedServers();
        let pserverRam = 0;
        for (const ps of pservers) {
            pserverRam += ns.getServerMaxRam(ps);
        }

        // Hacknet
        const hacknetNodes = ns.hacknet.numNodes();
        let hacknetProduction = 0;
        for (let i = 0; i < hacknetNodes; i++) {
            hacknetProduction += ns.hacknet.getNodeStats(i).production;
        }

        // Scripts actifs
        const scripts = ns.ps("home");

        // Affichage
        ns.print("╔══════════════════════════════════════════════╗");
        ns.print("║          🤖 BITBURNER AI DASHBOARD           ║");
        ns.print("╠══════════════════════════════════════════════╣");
        ns.print("");

        ns.print("💰 FINANCES");
        ns.print("─────────────────────────────────────────────");
        ns.print(`   Argent actuel:    $${formatMoney(money)}`);
        ns.print(`   Gagné cette run:  $${formatMoney(money - startMoney)}`);
        ns.print(`   Revenu actuel:    $${formatMoney(currentIncome)}/sec`);
        ns.print(`   Revenu moyen:     $${formatMoney(avgIncome)}/sec`);
        ns.print(`   Revenu max:       $${formatMoney(maxIncome)}/sec`);
        ns.print("");

        ns.print("🖥️ RÉSEAU");
        ns.print("─────────────────────────────────────────────");
        ns.print(`   Serveurs rootés:  ${rootedCount}/${servers.length}`);
        ns.print(`   Cibles hackables: ${hackableCount}`);
        ns.print(`   RAM réseau:       ${formatRam(usedRam)}/${formatRam(totalRam)} (${(usedRam / totalRam * 100).toFixed(0)}%)`);
        ns.print(`   Serveurs perso:   ${pservers.length}/25 (${formatRam(pserverRam)})`);
        ns.print("");

        ns.print("📊 PRODUCTION");
        ns.print("─────────────────────────────────────────────");
        ns.print(`   Hacknet Nodes:    ${hacknetNodes}`);
        ns.print(`   Hacknet Income:   $${formatMoney(hacknetProduction)}/sec`);
        ns.print(`   Scripts actifs:   ${scripts.length}`);
        ns.print("");

        // Gang (si disponible)
        try {
            if (ns.gang.inGang()) {
                const gInfo = ns.gang.getGangInformation();
                ns.print("🔫 GANG");
                ns.print("─────────────────────────────────────────────");
                ns.print(`   Respect:          ${formatMoney(gInfo.respect)}`);
                ns.print(`   Income:           $${formatMoney(gInfo.moneyGainRate * 5)}/sec`);
                ns.print(`   Territoire:       ${(gInfo.territory * 100).toFixed(1)}%`);
                ns.print("");
            }
        } catch (e) { }

        // Corporation (si disponible)
        try {
            const cInfo = ns.corporation.getCorporation();
            ns.print("🏢 CORPORATION");
            ns.print("─────────────────────────────────────────────");
            ns.print(`   Funds:            $${formatMoney(cInfo.funds)}`);
            ns.print(`   Profit:           $${formatMoney(cInfo.revenue - cInfo.expenses)}/sec`);
            ns.print(`   Divisions:        ${cInfo.divisions.length}`);
            ns.print("");
        } catch (e) { }

        ns.print("🎮 JOUEUR");
        ns.print("─────────────────────────────────────────────");
        ns.print(`   Hack Level:       ${ns.getHackingLevel()}`);
        ns.print(`   Home RAM:         ${ns.getServerMaxRam("home")}GB`);
        ns.print(`   Temps de jeu:     ${formatTime(runtime * 1000)}`);
        ns.print("");

        // Graphique simple du revenu
        ns.print("📈 REVENU (60 dernières secondes)");
        ns.print("─────────────────────────────────────────────");
        printGraph(ns, incomeHistory, maxIncome);
        ns.print("");

        ns.print("╚══════════════════════════════════════════════╝");

        await ns.sleep(1000);
    }
}

function getAllServers(ns) {
    const visited = new Set();
    const queue = ["home"];

    while (queue.length > 0) {
        const host = queue.shift();
        if (visited.has(host)) continue;
        visited.add(host);

        for (const neighbor of ns.scan(host)) {
            if (!visited.has(neighbor)) queue.push(neighbor);
        }
    }

    return Array.from(visited);
}

function printGraph(ns, data, max) {
    const height = 5;
    const width = Math.min(40, data.length);
    const samples = data.slice(-width);

    for (let row = height; row >= 0; row--) {
        let line = "   ";
        const threshold = (row / height) * max;

        for (const value of samples) {
            if (value >= threshold) {
                line += "█";
            } else if (value >= threshold * 0.5) {
                line += "▄";
            } else {
                line += " ";
            }
        }

        if (row === height) {
            line += ` $${formatMoney(max)}/s`;
        } else if (row === 0) {
            line += " $0/s";
        }

        ns.print(line);
    }
}

function formatMoney(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}

function formatRam(gb) {
    if (gb >= 1024) return (gb / 1024).toFixed(1) + "TB";
    return gb.toFixed(0) + "GB";
}

function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}
