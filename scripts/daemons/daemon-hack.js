/**
 * Bitburner AI - Hack Daemon (Lightweight)
 * RAM optimisé: ~8GB
 * 
 * Proto-batching HWGW avec pool de cibles
 * 
 * Usage: run daemon-hack.js
 */

const WORKERS = {
    hack: "/workers/hack.js",
    grow: "/workers/grow.js",
    weaken: "/workers/weaken.js",
};

const CONFIG = {
    HACK_PERCENT: 0.5,
    SECURITY_THRESHOLD: 5,
    MONEY_THRESHOLD: 0.75,
    BATCH_SPACING: 200,
    TARGET_POOL_SIZE: 3,
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const startTime = Date.now();
    let batchCount = 0;
    let totalStolen = 0;
    let batchId = 0;

    // Charger config dynamique
    let config = { ...CONFIG };

    ns.print("🤖 HACK DAEMON - Démarrage...");

    while (true) {
        // Recharger config
        try {
            const data = ns.read("/data/optimizer-config.txt");
            if (data) {
                const parsed = JSON.parse(data);
                config.HACK_PERCENT = parsed.hackPercent || CONFIG.HACK_PERCENT;
                config.SECURITY_THRESHOLD = parsed.securityThreshold || CONFIG.SECURITY_THRESHOLD;
            }
        } catch (e) { }

        // Propager root
        await propagateRoot(ns);

        // Déployer workers
        await deployWorkers(ns);

        // Pool de cibles
        const targets = getTargetPool(ns);

        ns.clearLog();
        printStatus(ns, targets, batchCount, totalStolen, startTime, config);

        if (targets.length === 0) {
            ns.print("⚠️ Aucune cible valide");
            await ns.sleep(5000);
            continue;
        }

        // Traiter chaque cible
        for (const target of targets) {
            if (isPrepared(ns, target.host, config)) {
                // Lancer un batch
                const result = await executeBatch(ns, target.host, config, batchId++);
                if (result.success) {
                    batchCount++;
                    totalStolen += result.stolen;
                }
            } else {
                // Préparer
                await prepareServer(ns, target.host, config);
            }
        }

        await ns.sleep(config.BATCH_SPACING);
    }
}

/**
 * Pool des meilleures cibles
 */
function getTargetPool(ns) {
    const servers = scanAll(ns);
    const targets = [];

    for (const host of servers) {
        if (!canHack(ns, host)) continue;

        const maxMoney = ns.getServerMaxMoney(host);
        const hackTime = ns.getHackTime(host);
        const chance = ns.hackAnalyzeChance(host);

        if (maxMoney <= 0 || hackTime <= 0) continue;

        const score = (maxMoney * chance) / hackTime;
        targets.push({ host, score });
    }

    return targets
        .sort((a, b) => b.score - a.score)
        .slice(0, CONFIG.TARGET_POOL_SIZE);
}

/**
 * Vérifier si serveur prêt
 */
function isPrepared(ns, host, config) {
    const sec = ns.getServerSecurityLevel(host);
    const minSec = ns.getServerMinSecurityLevel(host);
    const money = ns.getServerMoneyAvailable(host);
    const maxMoney = ns.getServerMaxMoney(host);

    return sec <= minSec + config.SECURITY_THRESHOLD &&
        money >= maxMoney * config.MONEY_THRESHOLD;
}

/**
 * Préparer un serveur
 */
async function prepareServer(ns, host, config) {
    const sec = ns.getServerSecurityLevel(host);
    const minSec = ns.getServerMinSecurityLevel(host);
    const money = ns.getServerMoneyAvailable(host);
    const maxMoney = ns.getServerMaxMoney(host);

    if (sec > minSec + config.SECURITY_THRESHOLD) {
        const threads = Math.ceil((sec - minSec) / 0.05);
        await distribute(ns, host, "weaken", Math.min(threads, 500));
    } else if (money < maxMoney * config.MONEY_THRESHOLD) {
        const mult = maxMoney / Math.max(money, 1);
        const threads = Math.ceil(ns.growthAnalyze(host, mult));
        await distribute(ns, host, "grow", Math.min(threads, 500));
    }
}

/**
 * Exécuter un batch HWGW
 */
async function executeBatch(ns, target, config, uid) {
    const maxMoney = ns.getServerMaxMoney(target);
    const hackAmount = maxMoney * config.HACK_PERCENT;

    const hackThreads = Math.max(1, Math.floor(ns.hackAnalyzeThreads(target, hackAmount)));
    const hackSecInc = ns.hackAnalyzeSecurity(hackThreads, target);
    const weaken1Threads = Math.ceil(hackSecInc / 0.05);

    const growMult = 1 / (1 - config.HACK_PERCENT);
    const growThreads = Math.ceil(ns.growthAnalyze(target, growMult));
    const growSecInc = ns.growthAnalyzeSecurity(growThreads, target);
    const weaken2Threads = Math.ceil(growSecInc / 0.05);

    const weakenTime = ns.getWeakenTime(target);
    const hackTime = ns.getHackTime(target);
    const growTime = ns.getGrowTime(target);
    const step = 40;

    const hackDelay = Math.max(0, weakenTime - hackTime - step * 3);
    const growDelay = Math.max(0, weakenTime - growTime - step);
    const weaken2Delay = step * 2;

    let launched = 0;
    launched += await distribute(ns, target, "hack", hackThreads, hackDelay);
    launched += await distribute(ns, target, "weaken", weaken1Threads, 0);
    launched += await distribute(ns, target, "grow", growThreads, growDelay);
    launched += await distribute(ns, target, "weaken", weaken2Threads, weaken2Delay);

    if (launched > 0) {
        const stolen = hackAmount * ns.hackAnalyzeChance(target);
        return { success: true, stolen };
    }
    return { success: false, stolen: 0 };
}

/**
 * Distribuer le travail
 */
async function distribute(ns, target, type, threads, delay = 0) {
    if (threads <= 0) return 0;

    const script = WORKERS[type];
    const scriptRam = ns.getScriptRam(script);
    const servers = getAvailableRam(ns);

    let remaining = threads;
    let launched = 0;

    for (const srv of servers) {
        if (remaining <= 0) break;

        const maxT = Math.floor(srv.free / scriptRam);
        if (maxT <= 0) continue;

        const t = Math.min(maxT, remaining);
        const pid = ns.exec(script, srv.host, t, target, delay, Date.now());

        if (pid > 0) {
            launched += t;
            remaining -= t;
        }
    }

    return launched;
}

/**
 * RAM disponible par serveur
 */
function getAvailableRam(ns) {
    const servers = scanAll(ns);
    const result = [];

    for (const host of servers) {
        if (!ns.hasRootAccess(host)) continue;
        const max = ns.getServerMaxRam(host);
        const used = ns.getServerUsedRam(host);
        const free = max - used;
        if (free > 0) result.push({ host, free, max });
    }

    return result.sort((a, b) => b.free - a.free);
}

/**
 * Scanner serveurs
 */
function scanAll(ns) {
    const servers = new Set();
    const queue = ["home"];
    while (queue.length > 0) {
        const current = queue.shift();
        if (servers.has(current)) continue;
        servers.add(current);
        for (const n of ns.scan(current)) {
            if (!servers.has(n)) queue.push(n);
        }
    }
    return Array.from(servers);
}

/**
 * Peut-on hacker?
 */
function canHack(ns, host) {
    if (host === "home") return false;
    if (host.startsWith("pserv-")) return false;
    if (!ns.hasRootAccess(host)) return false;
    if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) return false;
    if (ns.getServerMaxMoney(host) <= 0) return false;
    return true;
}

/**
 * Propager root
 */
async function propagateRoot(ns) {
    for (const host of scanAll(ns)) {
        if (ns.hasRootAccess(host)) continue;
        try { ns.brutessh(host); } catch (e) { }
        try { ns.ftpcrack(host); } catch (e) { }
        try { ns.relaysmtp(host); } catch (e) { }
        try { ns.httpworm(host); } catch (e) { }
        try { ns.sqlinject(host); } catch (e) { }
        try { ns.nuke(host); } catch (e) { }
    }
}

/**
 * Déployer workers
 */
async function deployWorkers(ns) {
    const files = Object.values(WORKERS);
    for (const host of scanAll(ns)) {
        if (host === "home") continue;
        if (!ns.hasRootAccess(host)) continue;
        if (ns.getServerMaxRam(host) === 0) continue;
        ns.scp(files, host, "home");
    }
}

/**
 * Afficher statut
 */
function printStatus(ns, targets, batches, stolen, startTime, config) {
    const runtime = Date.now() - startTime;
    const incomePerSec = stolen / (runtime / 1000);

    ns.print("═══════════════════════════════════════");
    ns.print("  🤖 HACK DAEMON (Proto-Batch)");
    ns.print("═══════════════════════════════════════");
    ns.print(`⚙️ Config: ${(config.HACK_PERCENT * 100).toFixed(0)}% hack`);
    ns.print(`📊 Batches: ${batches}`);
    ns.print(`💰 Volé: ${formatMoney(stolen)}`);
    ns.print(`📈 Income: ${formatMoney(incomePerSec)}/sec`);
    ns.print("");

    ns.print("🎯 Cibles:");
    for (const t of targets) {
        const prep = isPrepared(ns, t.host, config);
        const icon = prep ? "🟢" : "🟡";
        const money = ns.getServerMoneyAvailable(t.host);
        const max = ns.getServerMaxMoney(t.host);
        ns.print(`   ${icon} ${t.host}: ${formatMoney(money)}/${formatMoney(max)}`);
    }
    ns.print("");
}

function formatMoney(n) {
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "k";
    return "$" + n.toFixed(0);
}
