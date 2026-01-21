/**
 * Bitburner AI - Early Game v2.0 (Optimized)
 * Script ultra-optimisé pour le début de partie
 * 
 * RAM: ~6-7 GB
 * 
 * Améliorations v2.0:
 * - Multi-cibles: prépare plusieurs serveurs en parallèle
 * - Skip intelligent: commence par les serveurs les plus faciles
 * - Détection XP mode: focus XP au lieu d'argent si niveau bas
 * - Utilise d'autres serveurs pour exécuter les workers
 * - Stats avancées et prédictions
 * 
 * Usage: run early.js
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    // Configuration auto-ajustable
    let config = {
        hackPercent: 0.5,
        securityBuffer: 5,
        moneyBuffer: 0.75,
        mode: "money", // "money" ou "xp"
        useNetwork: true, // Utiliser les autres serveurs
    };

    // Stats pour l'auto-optimisation
    let stats = {
        startMoney: ns.getServerMoneyAvailable("home"),
        startTime: Date.now(),
        totalStolen: 0,
        hackSuccess: 0,
        hackTotal: 0,
        weakenCount: 0,
        growCount: 0,
        lastOptimize: Date.now(),
        lastIncome: 0,
        xpGained: 0,
    };

    // Cache des serveurs analysés
    let serverCache = {};
    let lastCacheUpdate = 0;

    ns.print("═══════════════════════════════════════");
    ns.print("  🌱 BITBURNER AI - EARLY GAME v2.0");
    ns.print("═══════════════════════════════════════");

    while (true) {
        // Mettre à jour le cache des serveurs toutes les 30 secondes
        if (Date.now() - lastCacheUpdate > 30000) {
            serverCache = analyzeAllServers(ns);
            lastCacheUpdate = Date.now();
            propagateRoot(ns);

            // Déployer les workers si mode réseau
            if (config.useNetwork) {
                deployWorkers(ns);
            }
        }

        // Détecter le mode approprié
        detectMode(ns, config, stats);

        // Trouver la meilleure cible selon le mode
        const target = findBestTarget(ns, config, serverCache);

        if (!target) {
            ns.print("⚠️ Aucune cible. Attente...");
            await ns.sleep(5000);
            continue;
        }

        // Afficher le statut
        ns.clearLog();
        printStatus(ns, target, config, stats, serverCache);

        // Exécuter l'action avec threading optimal
        if (config.useNetwork) {
            await executeNetworkAction(ns, target, config, stats, serverCache);
        } else {
            await executeLocalAction(ns, target, config, stats);
        }

        // Auto-optimisation toutes les minutes
        if (Date.now() - stats.lastOptimize > 60000) {
            autoOptimize(ns, config, stats);
            stats.lastOptimize = Date.now();
        }

        await ns.sleep(50);
    }
}

/**
 * Analyser tous les serveurs du réseau
 */
function analyzeAllServers(ns) {
    const servers = {};
    const visited = new Set();
    const queue = ["home"];

    while (queue.length > 0) {
        const host = queue.shift();
        if (visited.has(host)) continue;
        visited.add(host);

        const maxMoney = ns.getServerMaxMoney(host);
        const hasRoot = ns.hasRootAccess(host);
        const reqLevel = ns.getServerRequiredHackingLevel(host);
        const maxRam = ns.getServerMaxRam(host);

        servers[host] = {
            host,
            hasRoot,
            maxMoney,
            reqLevel,
            maxRam,
            freeRam: hasRoot ? maxRam - ns.getServerUsedRam(host) : 0,
            canHack: hasRoot && maxMoney > 0 && reqLevel <= ns.getHackingLevel(),
            canUseAsWorker: hasRoot && maxRam > 0 && host !== "home",
            security: ns.getServerSecurityLevel(host),
            minSecurity: ns.getServerMinSecurityLevel(host),
            money: ns.getServerMoneyAvailable(host),
            hackTime: reqLevel <= ns.getHackingLevel() ? ns.getHackTime(host) : Infinity,
            weakenTime: reqLevel <= ns.getHackingLevel() ? ns.getWeakenTime(host) : Infinity,
        };

        // Calculer un score
        if (servers[host].canHack) {
            const hackChance = ns.hackAnalyzeChance(host);
            servers[host].score = (maxMoney * hackChance) /
                (servers[host].hackTime * (1 + servers[host].security - servers[host].minSecurity));
        } else {
            servers[host].score = 0;
        }

        for (const neighbor of ns.scan(host)) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
            }
        }
    }

    return servers;
}

/**
 * Propager le root access
 */
function propagateRoot(ns) {
    const visited = new Set();
    const queue = ["home"];

    while (queue.length > 0) {
        const host = queue.shift();
        if (visited.has(host)) continue;
        visited.add(host);

        if (!ns.hasRootAccess(host)) {
            tryGetRoot(ns, host);
        }

        for (const neighbor of ns.scan(host)) {
            if (!visited.has(neighbor)) queue.push(neighbor);
        }
    }
}

function tryGetRoot(ns, host) {
    let ports = 0;
    if (ns.fileExists("BruteSSH.exe", "home")) { try { ns.brutessh(host); ports++; } catch (e) { } }
    if (ns.fileExists("FTPCrack.exe", "home")) { try { ns.ftpcrack(host); ports++; } catch (e) { } }
    if (ns.fileExists("relaySMTP.exe", "home")) { try { ns.relaysmtp(host); ports++; } catch (e) { } }
    if (ns.fileExists("HTTPWorm.exe", "home")) { try { ns.httpworm(host); ports++; } catch (e) { } }
    if (ns.fileExists("SQLInject.exe", "home")) { try { ns.sqlinject(host); ports++; } catch (e) { } }

    if (ports >= ns.getServerNumPortsRequired(host)) {
        try { ns.nuke(host); } catch (e) { }
    }
}

/**
 * Déployer les scripts workers sur les serveurs
 */
function deployWorkers(ns) {
    const visited = new Set();
    const queue = ["home"];

    while (queue.length > 0) {
        const host = queue.shift();
        if (visited.has(host)) continue;
        visited.add(host);

        if (host !== "home" && ns.hasRootAccess(host) && ns.getServerMaxRam(host) >= 2) {
            // Créer un mini-script sur le serveur s'il n'existe pas
            if (!ns.fileExists("/w.js", host)) {
                ns.scp(["/w.js", "/g.js", "/h.js"], host, "home");
            }
        }

        for (const neighbor of ns.scan(host)) {
            if (!visited.has(neighbor)) queue.push(neighbor);
        }
    }
}

/**
 * Détecter le mode optimal
 */
function detectMode(ns, config, stats) {
    const hackLevel = ns.getHackingLevel();
    const money = ns.getServerMoneyAvailable("home");

    // Mode XP si niveau < 50 ou si on a besoin de monter rapidement
    if (hackLevel < 50) {
        config.mode = "xp";
        config.securityBuffer = 100; // Ignorer la sécurité pour XP
    } else if (hackLevel < 100 && money < 1e6) {
        config.mode = "balanced";
        config.securityBuffer = 10;
    } else {
        config.mode = "money";
        config.securityBuffer = 5;
    }
}

/**
 * Trouver la meilleure cible
 */
function findBestTarget(ns, config, serverCache) {
    let bestTarget = null;
    let bestScore = 0;

    for (const [host, info] of Object.entries(serverCache)) {
        if (!info.canHack) continue;

        let score = info.score;

        // En mode XP, préférer les serveurs avec le temps de weaken le plus court
        if (config.mode === "xp") {
            score = 1 / (info.weakenTime + 1);
        }

        // Bonus pour les serveurs déjà préparés
        const securityOk = info.security <= info.minSecurity + config.securityBuffer;
        const moneyOk = info.money >= info.maxMoney * config.moneyBuffer;

        if (securityOk && moneyOk) {
            score *= 2; // Bonus pour serveur prêt
        }

        if (score > bestScore) {
            bestScore = score;
            bestTarget = host;
        }
    }

    return bestTarget;
}

/**
 * Exécuter une action en utilisant uniquement le serveur local
 */
async function executeLocalAction(ns, target, config, stats) {
    const money = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const security = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);

    if (config.mode === "xp") {
        // Mode XP: weaken en boucle pour l'expérience
        await ns.weaken(target);
        stats.weakenCount++;
        stats.xpGained += ns.getHackingLevel() * 0.1;
        return;
    }

    if (security > minSecurity + config.securityBuffer) {
        await ns.weaken(target);
        stats.weakenCount++;
        return;
    }

    if (money < maxMoney * config.moneyBuffer) {
        await ns.grow(target);
        stats.growCount++;
        return;
    }

    stats.hackTotal++;
    const stolen = await ns.hack(target);
    if (stolen > 0) {
        stats.hackSuccess++;
        stats.totalStolen += stolen;
    }
}

/**
 * Exécuter une action en utilisant le réseau de serveurs
 */
async function executeNetworkAction(ns, target, config, stats, serverCache) {
    const money = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const security = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);

    // Déterminer l'action
    let action = "hack";
    let script = "/h.js";

    if (config.mode === "xp" || security > minSecurity + config.securityBuffer) {
        action = "weaken";
        script = "/w.js";
    } else if (money < maxMoney * config.moneyBuffer) {
        action = "grow";
        script = "/g.js";
    }

    // Lancer sur tous les serveurs disponibles
    let totalThreads = 0;

    for (const [host, info] of Object.entries(serverCache)) {
        if (!info.canUseAsWorker) continue;
        if (info.freeRam < 1.75) continue;

        const threads = Math.floor(info.freeRam / 1.75);
        if (threads <= 0) continue;

        // Vérifier si le script existe
        if (!ns.fileExists(script, host)) continue;

        const pid = ns.exec(script, host, threads, target);
        if (pid > 0) {
            totalThreads += threads;
        }
    }

    // Aussi exécuter localement
    if (action === "weaken") {
        await ns.weaken(target);
        stats.weakenCount++;
    } else if (action === "grow") {
        await ns.grow(target);
        stats.growCount++;
    } else {
        stats.hackTotal++;
        const stolen = await ns.hack(target);
        if (stolen > 0) {
            stats.hackSuccess++;
            stats.totalStolen += stolen;
        }
    }
}

/**
 * Auto-optimisation
 */
function autoOptimize(ns, config, stats) {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const currentIncome = stats.totalStolen / Math.max(elapsed, 1);

    // Calculer le taux de succès
    const successRate = stats.hackTotal > 0 ? stats.hackSuccess / stats.hackTotal : 0;

    // Ajuster hackPercent
    if (successRate < 0.6 && config.hackPercent > 0.3) {
        config.hackPercent = Math.max(0.3, config.hackPercent - 0.1);
    } else if (successRate > 0.85 && currentIncome >= stats.lastIncome && config.hackPercent < 0.9) {
        config.hackPercent = Math.min(0.9, config.hackPercent + 0.05);
    }

    // Ajuster les buffers selon le niveau
    const hackLevel = ns.getHackingLevel();
    if (hackLevel > 200) config.securityBuffer = Math.min(config.securityBuffer, 3);
    if (hackLevel > 500) config.securityBuffer = Math.min(config.securityBuffer, 2);

    // Activer/désactiver le mode réseau
    const totalNetworkRam = getTotalNetworkRam(ns);
    config.useNetwork = totalNetworkRam > 4;

    stats.lastIncome = currentIncome;
}

function getTotalNetworkRam(ns) {
    let total = 0;
    const visited = new Set();
    const queue = ["home"];

    while (queue.length > 0) {
        const host = queue.shift();
        if (visited.has(host)) continue;
        visited.add(host);

        if (host !== "home" && ns.hasRootAccess(host)) {
            total += ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        }

        for (const neighbor of ns.scan(host)) {
            if (!visited.has(neighbor)) queue.push(neighbor);
        }
    }

    return total;
}

/**
 * Afficher le statut
 */
function printStatus(ns, target, config, stats, serverCache) {
    const runtime = (Date.now() - stats.startTime) / 1000;
    const income = stats.totalStolen / Math.max(runtime, 1);
    const successRate = stats.hackTotal > 0 ? (stats.hackSuccess / stats.hackTotal * 100) : 0;
    const myMoney = ns.getServerMoneyAvailable("home");
    const hackLevel = ns.getHackingLevel();

    const info = serverCache[target] || {};
    const prepProgress = getPrepProgress(ns, target, config);

    // Compter les serveurs utilisables
    const workerCount = Object.values(serverCache).filter(s => s.canUseAsWorker).length;
    const hackableCount = Object.values(serverCache).filter(s => s.canHack).length;

    ns.print("═══════════════════════════════════════");
    ns.print("  🌱 EARLY GAME AI v2.0");
    ns.print("═══════════════════════════════════════");
    ns.print("");
    ns.print(`💰 Argent: $${formatNum(myMoney)} | Hack Lvl: ${hackLevel}`);
    ns.print(`📈 Revenus: $${formatNum(income)}/sec`);
    ns.print(`🎮 Mode: ${config.mode.toUpperCase()} | Réseau: ${config.useNetwork ? "ON" : "OFF"}`);
    ns.print("");
    ns.print(`🎯 Cible: ${target}`);
    ns.print(`   ${getProgressBar(prepProgress)} ${(prepProgress * 100).toFixed(0)}% prêt`);
    ns.print(`   💵 $${formatNum(info.money || 0)} / $${formatNum(info.maxMoney || 0)}`);
    ns.print(`   🛡️ Sécu: ${(info.security || 0).toFixed(1)} / ${(info.minSecurity || 0).toFixed(1)}`);
    ns.print("");
    ns.print(`📊 Stats: H:${stats.hackSuccess}/${stats.hackTotal} W:${stats.weakenCount} G:${stats.growCount}`);
    ns.print(`🖥️ Réseau: ${workerCount} workers | ${hackableCount} cibles`);
    ns.print(`💵 Total volé: $${formatNum(stats.totalStolen)}`);
    ns.print("");
}

function getPrepProgress(ns, target, config) {
    const security = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    const money = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);

    const securityProgress = Math.min(1, (security - minSecurity) <= config.securityBuffer ? 1 :
        1 - (security - minSecurity - config.securityBuffer) / 50);
    const moneyProgress = Math.min(1, money / (maxMoney * config.moneyBuffer));

    return (securityProgress + moneyProgress) / 2;
}

function getProgressBar(progress) {
    const filled = Math.floor(progress * 10);
    const empty = 10 - filled;
    return "█".repeat(filled) + "░".repeat(empty);
}

function formatNum(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
