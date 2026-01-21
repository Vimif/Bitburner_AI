/**
 * Bitburner AI - Main Orchestrator
 * Script principal qui lance et gère tous les daemons
 * 
 * Usage: run main.js
 * 
 * Ce script est le point d'entrée de l'IA Bitburner.
 * Il lance automatiquement tous les daemons et surveille leur état.
 */

import { scanAll, getRootAccess, formatMoney, formatTime, formatRam } from "./lib/utils.js";

// Configuration des daemons
const DAEMONS = [
    { name: "Optimizer", script: "/daemons/daemon-optimizer.js", ram: 0, critical: false },
    { name: "Hack Daemon", script: "/daemons/daemon-hack.js", ram: 0, critical: true },
    { name: "Server Daemon", script: "/daemons/daemon-servers.js", ram: 0, critical: false },
    { name: "Hacknet Daemon", script: "/daemons/daemon-hacknet.js", ram: 0, critical: false },
    { name: "Contracts Daemon", script: "/daemons/daemon-contracts.js", ram: 0, critical: false },
    { name: "Stocks Daemon", script: "/daemons/daemon-stocks.js", ram: 0, critical: false },
    { name: "Buyer Daemon", script: "/daemons/daemon-buyer.js", ram: 0, critical: false },
    { name: "Gang Daemon", script: "/daemons/daemon-gang.js", ram: 0, critical: false },
    { name: "Sleeve Daemon", script: "/daemons/daemon-sleeve.js", ram: 0, critical: false },
    { name: "Factions Daemon", script: "/daemons/daemon-factions.js", ram: 0, critical: false },
    { name: "Stanek Daemon", script: "/daemons/daemon-stanek.js", ram: 0, critical: false },
    { name: "Share Daemon", script: "/daemons/daemon-share.js", ram: 0, critical: false },
    { name: "Prestige Daemon", script: "/daemons/daemon-prestige.js", ram: 0, critical: false },
    { name: "Bladeburner", script: "/daemons/daemon-bladeburner.js", ram: 0, critical: false },
    { name: "Corp Daemon", script: "/daemons/daemon-corp.js", ram: 0, critical: false },
];

// Scripts à copier sur tous les serveurs
const DEPLOY_SCRIPTS = [
    "/workers/hack.js",
    "/workers/grow.js",
    "/workers/weaken.js",
];

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const startTime = Date.now();

    // Affichage initial
    printBanner(ns);

    // Phase 1: Initialisation
    ns.print("📦 Phase 1: Initialisation...");
    await initialize(ns);

    // Phase 2: Propagation des accès root
    ns.print("🔓 Phase 2: Propagation root...");
    await propagateRoot(ns);

    // Phase 3: Déploiement des workers
    ns.print("📤 Phase 3: Déploiement workers...");
    await deployWorkers(ns);

    // Phase 4: Lancement des daemons
    ns.print("🚀 Phase 4: Lancement daemons...");
    await launchDaemons(ns);

    // Boucle principale de monitoring
    ns.print("✅ Tous les systèmes sont opérationnels!");
    ns.print("");

    while (true) {
        ns.clearLog();
        printStatus(ns, startTime);

        // Vérifier et relancer les daemons si nécessaire
        await checkDaemons(ns);

        // Continuer à propager root sur nouveaux serveurs
        await propagateRoot(ns);

        await ns.sleep(5000);
    }
}

/**
 * Afficher la bannière de démarrage
 */
function printBanner(ns) {
    ns.print("");
    ns.print("╔══════════════════════════════════════════╗");
    ns.print("║                                          ║");
    ns.print("║     🤖 BITBURNER AI v1.0                 ║");
    ns.print("║     Système d'automatisation avancé      ║");
    ns.print("║                                          ║");
    ns.print("╚══════════════════════════════════════════╝");
    ns.print("");
}

/**
 * Initialisation du système
 */
async function initialize(ns) {
    // Calculer la RAM de chaque daemon
    for (const daemon of DAEMONS) {
        daemon.ram = ns.getScriptRam(daemon.script);
        ns.print(`   ${daemon.name}: ${formatRam(daemon.ram)}`);
    }

    await ns.sleep(500);
}

/**
 * Propager l'accès root sur tous les serveurs
 */
async function propagateRoot(ns) {
    const servers = scanAll(ns);
    let newRoots = 0;

    for (const host of servers) {
        if (!ns.hasRootAccess(host)) {
            if (getRootAccess(ns, host)) {
                newRoots++;
            }
        }
    }

    if (newRoots > 0) {
        ns.print(`   🔓 ${newRoots} nouveau(x) serveur(s) rooté(s)`);
    }
}

/**
 * Déployer les workers sur tous les serveurs
 */
async function deployWorkers(ns) {
    const servers = scanAll(ns);
    let deployed = 0;

    for (const host of servers) {
        if (host === "home") continue;
        if (!ns.hasRootAccess(host)) continue;
        if (ns.getServerMaxRam(host) === 0) continue;

        // Copier les scripts
        const copied = ns.scp(DEPLOY_SCRIPTS, host, "home");
        if (copied) deployed++;
    }

    ns.print(`   📤 Workers déployés sur ${deployed} serveur(s)`);
}

/**
 * Lancer tous les daemons
 */
async function launchDaemons(ns) {
    for (const daemon of DAEMONS) {
        if (ns.isRunning(daemon.script, "home")) {
            ns.print(`   ⏭️ ${daemon.name} déjà en cours`);
            continue;
        }

        const homeRam = ns.getServerMaxRam("home");
        const usedRam = ns.getServerUsedRam("home");
        const freeRam = homeRam - usedRam;

        if (daemon.ram > freeRam) {
            ns.print(`   ⚠️ ${daemon.name}: RAM insuffisante (${formatRam(daemon.ram)} requis)`);
            if (daemon.critical) {
                ns.print(`      ❌ CRITIQUE: L'IA ne peut pas fonctionner sans ce daemon!`);
            }
            continue;
        }

        const pid = ns.run(daemon.script);

        if (pid > 0) {
            ns.print(`   ✅ ${daemon.name} lancé (PID: ${pid})`);
        } else {
            ns.print(`   ❌ ${daemon.name}: Échec du lancement`);
        }

        await ns.sleep(100);
    }
}

/**
 * Vérifier l'état des daemons et relancer si nécessaire
 */
async function checkDaemons(ns) {
    for (const daemon of DAEMONS) {
        if (!ns.isRunning(daemon.script, "home")) {
            const homeRam = ns.getServerMaxRam("home");
            const usedRam = ns.getServerUsedRam("home");
            const freeRam = homeRam - usedRam;

            if (daemon.ram <= freeRam) {
                ns.print(`   🔄 Relancement de ${daemon.name}...`);
                ns.run(daemon.script);
            }
        }
    }
}

/**
 * Afficher le statut actuel
 */
function printStatus(ns, startTime) {
    const runtime = Date.now() - startTime;
    const money = ns.getServerMoneyAvailable("home");
    const servers = scanAll(ns);

    // Compter les serveurs avec root
    const rootedServers = servers.filter(s => ns.hasRootAccess(s)).length;

    // Calculer la RAM totale disponible
    let totalRam = 0;
    let usedRam = 0;
    for (const host of servers) {
        if (ns.hasRootAccess(host)) {
            totalRam += ns.getServerMaxRam(host);
            usedRam += ns.getServerUsedRam(host);
        }
    }

    // Compter les serveurs personnels
    const purchasedServers = ns.getPurchasedServers();

    // Compter les hacknet nodes
    const hacknetNodes = ns.hacknet.numNodes();

    printBanner(ns);

    ns.print("📊 STATISTIQUES");
    ns.print("─────────────────────────────────────────");
    ns.print(`⏱️ Temps d'exécution: ${formatTime(runtime)}`);
    ns.print(`💰 Argent: ${formatMoney(money)}`);
    ns.print(`🖥️ Serveurs: ${rootedServers}/${servers.length} rootés`);
    ns.print(`📦 Serveurs perso: ${purchasedServers.length}/25`);
    ns.print(`🌐 Hacknet Nodes: ${hacknetNodes}`);
    ns.print(`💾 RAM réseau: ${formatRam(usedRam)} / ${formatRam(totalRam)}`);
    ns.print("");

    ns.print("🔧 DAEMONS");
    ns.print("─────────────────────────────────────────");

    for (const daemon of DAEMONS) {
        const running = ns.isRunning(daemon.script, "home");
        const status = running ? "🟢" : "🔴";
        ns.print(`${status} ${daemon.name}`);
    }
    ns.print("");

    ns.print("📈 INCOME");
    ns.print("─────────────────────────────────────────");
    const income = ns.getTotalScriptIncome();
    ns.print(`💵 Scripts: ${formatMoney(income[0])}/sec`);
    ns.print(`📊 Total depuis reset: ${formatMoney(income[1])}`);
    ns.print("");
}
