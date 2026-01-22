/**
 * Bitburner AI - Main Orchestrator (Lightweight)
 * RAM optimisé: ~15GB
 * 
 * Gère intelligemment tous les daemons:
 * - Démarre/arrête selon conditions et RAM
 * - Priorité dynamique selon phase
 * 
 * Usage: run main.js
 */

// ===== Configuration des Daemons =====
const DAEMONS = [
    { id: "optimizer", script: "/daemons/daemon-optimizer.js", priority: 10, name: "Optimizer" },
    { id: "hack", script: "/daemons/daemon-hack.js", priority: 9, name: "Hack" },
    { id: "servers", script: "/daemons/daemon-servers.js", priority: 8, name: "Servers" },
    { id: "hacknet", script: "/daemons/daemon-hacknet.js", priority: 6, name: "Hacknet" },
    { id: "contracts", script: "/daemons/daemon-contracts.js", priority: 5, name: "Contracts" },
    { id: "stocks", script: "/daemons/daemon-stocks.js", priority: 7, name: "Stocks" },
    { id: "buyer", script: "/daemons/daemon-buyer.js", priority: 7, name: "Buyer" },
    { id: "gang", script: "/daemons/daemon-gang.js", priority: 6, name: "Gang" },
    { id: "sleeve", script: "/daemons/daemon-sleeve.js", priority: 5, name: "Sleeve" },
    { id: "factions", script: "/daemons/daemon-factions.js", priority: 4, name: "Factions" },
    { id: "bladeburner", script: "/daemons/daemon-bladeburner.js", priority: 6, name: "Bladeburner" },
    { id: "corp", script: "/daemons/daemon-corp.js", priority: 5, name: "Corp" },
];

const WORKERS = ["/workers/hack.js", "/workers/grow.js", "/workers/weaken.js"];

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const startTime = Date.now();
    let decisions = [];

    // Charger config
    let bnConfig = { skipDaemons: [], priorityDaemons: [], canHack: true };
    try {
        const data = ns.read("/data/bitnode-config.txt");
        if (data) bnConfig = JSON.parse(data);
    } catch (e) { }

    // Initialisation
    ns.print("🧠 BITBURNER AI v3.0 - Initialisation...");

    // Propager root et déployer workers
    await propagateAndDeploy(ns);

    ns.print("✅ Système prêt - Mode autonome");

    // Boucle principale
    while (true) {
        ns.clearLog();

        // Stats
        const homeRam = ns.getServerMaxRam("home");
        const homeUsed = ns.getServerUsedRam("home");
        const homeFree = homeRam - homeUsed;
        const money = ns.getServerMoneyAvailable("home");
        const hackLevel = ns.getHackingLevel();

        // Affichage
        ns.print("╔══════════════════════════════════════╗");
        ns.print("║    🧠 BITBURNER AI v3.0 - AUTONOME   ║");
        ns.print("╚══════════════════════════════════════╝");
        ns.print("");
        ns.print(`💾 RAM Home: ${homeFree.toFixed(1)}GB / ${homeRam}GB`);
        ns.print(`💰 Argent: ${formatMoney(money)}`);
        ns.print(`🎓 Hack: ${hackLevel}`);
        ns.print(`⏱️ Runtime: ${formatTime(Date.now() - startTime)}`);
        ns.print("");

        // Gérer les daemons
        await manageDaemons(ns, bnConfig, decisions);

        // Afficher daemons
        ns.print("🔧 DAEMONS:");
        for (const d of DAEMONS) {
            if (bnConfig.skipDaemons?.includes(d.id)) continue;
            const running = ns.isRunning(d.script, "home");
            const icon = running ? "🟢" : "⚫";
            ns.print(`   ${icon} ${d.name}`);
        }
        ns.print("");

        // Décisions récentes
        if (decisions.length > 0) {
            ns.print("📝 Décisions:");
            for (const d of decisions.slice(-5)) {
                ns.print(`   ${d}`);
            }
        }

        // Propager root périodiquement
        await propagateAndDeploy(ns);

        await ns.sleep(10000);
    }
}

/**
 * Gérer les daemons (start/stop)
 */
async function manageDaemons(ns, bnConfig, decisions) {
    const getFreeRam = () => ns.getServerMaxRam("home") - ns.getServerUsedRam("home");

    // Calculer RAM de chaque daemon
    for (const daemon of DAEMONS) {
        daemon.ram = ns.getScriptRam(daemon.script);
        daemon.running = ns.isRunning(daemon.script, "home");
        daemon.skip = bnConfig.skipDaemons?.includes(daemon.id);
    }

    // Trier par priorité
    const sorted = [...DAEMONS].sort((a, b) => b.priority - a.priority);

    // Démarrer les daemons par ordre de priorité
    for (const daemon of sorted) {
        if (daemon.skip) continue;
        if (daemon.running) continue;

        const freeRam = getFreeRam();

        if (daemon.ram <= freeRam) {
            const pid = ns.run(daemon.script);
            if (pid > 0) {
                daemon.running = true;
                const msg = `▶️ ${daemon.name} (${daemon.ram.toFixed(1)}GB)`;
                decisions.push(msg);
                ns.toast(msg, "success", 2000);
                await ns.sleep(100);
            }
        }
    }

    // Garder les 20 dernières décisions
    while (decisions.length > 20) decisions.shift();
}

/**
 * Propager root et déployer workers
 */
async function propagateAndDeploy(ns) {
    const servers = scanAll(ns);

    for (const host of servers) {
        // Root access
        if (!ns.hasRootAccess(host)) {
            openPorts(ns, host);
            try { ns.nuke(host); } catch (e) { }
        }

        // Déployer workers
        if (host !== "home" && ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0) {
            ns.scp(WORKERS, host, "home");
        }
    }
}

/**
 * Scanner tous les serveurs
 */
function scanAll(ns) {
    const servers = new Set();
    const queue = ["home"];

    while (queue.length > 0) {
        const current = queue.shift();
        if (servers.has(current)) continue;
        servers.add(current);

        for (const neighbor of ns.scan(current)) {
            if (!servers.has(neighbor)) queue.push(neighbor);
        }
    }

    return Array.from(servers);
}

/**
 * Ouvrir les ports
 */
function openPorts(ns, host) {
    try { ns.brutessh(host); } catch (e) { }
    try { ns.ftpcrack(host); } catch (e) { }
    try { ns.relaysmtp(host); } catch (e) { }
    try { ns.httpworm(host); } catch (e) { }
    try { ns.sqlinject(host); } catch (e) { }
}

/**
 * Formater argent
 */
function formatMoney(n) {
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "k";
    return "$" + n.toFixed(0);
}

/**
 * Formater temps
 */
function formatTime(ms) {
    if (ms < 60000) return (ms / 1000).toFixed(0) + "s";
    if (ms < 3600000) return (ms / 60000).toFixed(1) + "m";
    return (ms / 3600000).toFixed(1) + "h";
}
