/**
 * Bitburner AI - Main Orchestrator v2.0
 * Script principal qui lance et gère tous les daemons
 * 
 * Améliorations v2.0:
 * - Respect des configurations BitNode (skip/priority daemons)
 * - Intégration brain-state
 * - Stats réseau améliorées
 * - Meilleure gestion des erreurs
 * 
 * Usage: run main.js
 */

import {
    scanAll,
    getRootAccess,
    formatMoney,
    formatTime,
    formatRam,
    getNetworkRamStats,
    readJSON
} from "./lib/utils.js";
import { getState, setState, detectPhase } from "./lib/brain-state.js";

// Configuration des daemons (ordre de priorité)
const DAEMONS = [
    { name: "Optimizer", script: "/daemons/daemon-optimizer.js", id: "optimizer", ram: 0, critical: false },
    { name: "Hack Daemon", script: "/daemons/daemon-hack.js", id: "hack", ram: 0, critical: true },
    { name: "Server Daemon", script: "/daemons/daemon-servers.js", id: "servers", ram: 0, critical: false },
    { name: "Hacknet Daemon", script: "/daemons/daemon-hacknet.js", id: "hacknet", ram: 0, critical: false },
    { name: "Contracts Daemon", script: "/daemons/daemon-contracts.js", id: "contracts", ram: 0, critical: false },
    { name: "Stocks Daemon", script: "/daemons/daemon-stocks.js", id: "stocks", ram: 0, critical: false },
    { name: "Buyer Daemon", script: "/daemons/daemon-buyer.js", id: "buyer", ram: 0, critical: false },
    { name: "Gang Daemon", script: "/daemons/daemon-gang.js", id: "gang", ram: 0, critical: false },
    { name: "Sleeve Daemon", script: "/daemons/daemon-sleeve.js", id: "sleeve", ram: 0, critical: false },
    { name: "Factions Daemon", script: "/daemons/daemon-factions.js", id: "factions", ram: 0, critical: false },
    { name: "Stanek Daemon", script: "/daemons/daemon-stanek.js", id: "stanek", ram: 0, critical: false },
    { name: "Share Daemon", script: "/daemons/daemon-share.js", id: "share", ram: 0, critical: false },
    { name: "Prestige Daemon", script: "/daemons/daemon-prestige.js", id: "prestige", ram: 0, critical: false },
    { name: "Bladeburner", script: "/daemons/daemon-bladeburner.js", id: "bladeburner", ram: 0, critical: false },
    { name: "Corp Daemon", script: "/daemons/daemon-corp.js", id: "corp", ram: 0, critical: false },
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

    // Charger la config BitNode
    const bnConfig = readJSON(ns, "/data/bitnode-config.txt") || {
        skipDaemons: [],
        priorityDaemons: [],
        focus: "balanced",
    };

    // Affichage initial
    printBanner(ns, bnConfig);

    // Phase 1: Initialisation
    ns.print("📦 Phase 1: Initialisation...");
    await initialize(ns, bnConfig);

    // Phase 2: Propagation des accès root
    ns.print("🔓 Phase 2: Propagation root...");
    await propagateRoot(ns);

    // Phase 3: Déploiement des workers
    ns.print("📤 Phase 3: Déploiement workers...");
    await deployWorkers(ns);

    // Phase 4: Lancement des daemons
    ns.print("🚀 Phase 4: Lancement daemons...");
    await launchDaemons(ns, bnConfig);

    // Boucle principale de monitoring
    ns.print("✅ Tous les systèmes sont opérationnels!");
    ns.print("");

    while (true) {
        ns.clearLog();

        // Mettre à jour l'état global
        updateGlobalState(ns);

        // Afficher le statut
        printStatus(ns, startTime, bnConfig);

        // Vérifier et relancer les daemons si nécessaire
        await checkDaemons(ns, bnConfig);

        // Continuer à propager root sur nouveaux serveurs
        await propagateRoot(ns);

        await ns.sleep(5000);
    }
}

/**
 * Afficher la bannière de démarrage
 */
function printBanner(ns, bnConfig) {
    ns.print("");
    ns.print("╔══════════════════════════════════════════╗");
    ns.print("║                                          ║");
    ns.print("║     🤖 BITBURNER AI v2.0                 ║");
    ns.print("║     Système d'automatisation avancé      ║");
    ns.print("║                                          ║");
    ns.print("╚══════════════════════════════════════════╝");
    ns.print("");
    ns.print(`🌍 BitNode: ${bnConfig.bitNode || "?"}`);
    ns.print(`🎯 Focus: ${bnConfig.focus || "balanced"}`);
    if (bnConfig.description) {
        ns.print(`📋 ${bnConfig.description}`);
    }
    ns.print("");
}

/**
 * Initialisation du système
 */
async function initialize(ns, bnConfig) {
    const activeDaemons = [];

    // Calculer la RAM de chaque daemon et déterminer lesquels activer
    for (const daemon of DAEMONS) {
        // Vérifier si ce daemon doit être skippé
        if (bnConfig.skipDaemons?.includes(daemon.id)) {
            daemon.skip = true;
            ns.print(`   ⏭️ ${daemon.name}: SKIP (BitNode config)`);
            continue;
        }

        daemon.ram = ns.getScriptRam(daemon.script);

        // Vérifier si prioritaire
        daemon.priority = bnConfig.priorityDaemons?.includes(daemon.id) || false;

        const priorityMark = daemon.priority ? "⭐ " : "";
        ns.print(`   ${priorityMark}${daemon.name}: ${formatRam(daemon.ram)}`);
        activeDaemons.push(daemon.id);
    }

    // Mettre à jour le state
    setState(ns, { activeDaemons });

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
async function launchDaemons(ns, bnConfig) {
    // Trier les daemons: prioritaires d'abord
    const sortedDaemons = [...DAEMONS].sort((a, b) => {
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;
        if (a.critical && !b.critical) return -1;
        if (!a.critical && b.critical) return 1;
        return 0;
    });

    for (const daemon of sortedDaemons) {
        // Skip si marqué comme tel
        if (daemon.skip) continue;

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
            const priorityMark = daemon.priority ? "⭐ " : "";
            ns.print(`   ✅ ${priorityMark}${daemon.name} lancé (PID: ${pid})`);
        } else {
            ns.print(`   ❌ ${daemon.name}: Échec du lancement`);
        }

        await ns.sleep(100);
    }
}

/**
 * Vérifier l'état des daemons et relancer si nécessaire
 */
async function checkDaemons(ns, bnConfig) {
    for (const daemon of DAEMONS) {
        if (daemon.skip) continue;

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
 * Mettre à jour l'état global
 */
function updateGlobalState(ns) {
    const phase = detectPhase(ns);
    setState(ns, {
        phase,
        stats: {
            hackingLevel: ns.getHackingLevel(),
            netWorth: ns.getServerMoneyAvailable("home"),
        }
    });
}

/**
 * Afficher le statut actuel
 */
function printStatus(ns, startTime, bnConfig) {
    const runtime = Date.now() - startTime;
    const money = ns.getServerMoneyAvailable("home");
    const servers = scanAll(ns);
    const state = getState(ns);

    // Compter les serveurs avec root
    const rootedServers = servers.filter(s => ns.hasRootAccess(s)).length;

    // Calculer la RAM réseau
    const ramStats = getNetworkRamStats(ns);

    // Compter les serveurs personnels
    const purchasedServers = ns.getPurchasedServers();

    // Compter les hacknet nodes
    const hacknetNodes = ns.hacknet.numNodes();

    printBanner(ns, bnConfig);

    ns.print("📊 STATISTIQUES");
    ns.print("─────────────────────────────────────────");
    ns.print(`⏱️ Temps d'exécution: ${formatTime(runtime)}`);
    ns.print(`💰 Argent: ${formatMoney(money)}`);
    ns.print(`🎮 Phase: ${state.phase?.toUpperCase() || "?"}`);
    ns.print(`🖥️ Serveurs: ${rootedServers}/${servers.length} rootés`);
    ns.print(`📦 Serveurs perso: ${purchasedServers.length}/25`);
    ns.print(`🌐 Hacknet Nodes: ${hacknetNodes}`);
    ns.print(`💾 RAM réseau: ${formatRam(ramStats.used)} / ${formatRam(ramStats.total)}`);
    ns.print("");

    ns.print("🔧 DAEMONS");
    ns.print("─────────────────────────────────────────");

    for (const daemon of DAEMONS) {
        if (daemon.skip) {
            ns.print(`⏭️ ${daemon.name} (skipped)`);
            continue;
        }

        const running = ns.isRunning(daemon.script, "home");
        const status = running ? "🟢" : "🔴";
        const priorityMark = daemon.priority ? "⭐" : " ";
        ns.print(`${status}${priorityMark} ${daemon.name}`);
    }
    ns.print("");

    ns.print("📈 INCOME");
    ns.print("─────────────────────────────────────────");
    const income = ns.getTotalScriptIncome();
    ns.print(`💵 Scripts: ${formatMoney(income[0])}/sec`);
    ns.print(`📊 Total depuis reset: ${formatMoney(income[1])}`);
    ns.print("");
}
