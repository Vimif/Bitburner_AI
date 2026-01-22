/**
 * Bitburner AI - Optimizer Daemon (Lightweight)
 * RAM optimisé: ~5GB
 * 
 * A/B testing et directives
 * 
 * Usage: run daemon-optimizer.js
 */

const CONFIG_FILE = "/data/optimizer-config.txt";
const STATE_FILE = "/data/brain-state.txt";
const DIRECTIVES_FILE = "/data/ai-directives.txt";

// Variants A/B
const VARIANTS = {
    conservative: { hackPercent: 0.4, securityThreshold: 3, moneyThreshold: 0.85 },
    balanced: { hackPercent: 0.5, securityThreshold: 5, moneyThreshold: 0.75 },
    aggressive: { hackPercent: 0.7, securityThreshold: 7, moneyThreshold: 0.65 },
    extreme: { hackPercent: 0.9, securityThreshold: 10, moneyThreshold: 0.5 },
};

let config = { ...VARIANTS.balanced };
let activeVariant = "balanced";
let history = [];
let variantPerformance = {};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const startTime = Date.now();
    let lastMoney = ns.getServerMoneyAvailable("home");
    let lastCheck = Date.now();
    let cycle = 0;

    ns.print("🧠 OPTIMIZER - Démarrage...");

    while (true) {
        await ns.sleep(10000);
        cycle++;

        const money = ns.getServerMoneyAvailable("home");
        const elapsed = (Date.now() - lastCheck) / 1000;
        const income = (money - lastMoney) / elapsed;

        // Enregistrer performance
        history.push({ time: Date.now(), income, variant: activeVariant });
        if (history.length > 100) history.shift();

        // Détecter phase
        const phase = detectPhase(ns, money);

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🧠 OPTIMIZER (A/B Testing)");
        ns.print("═══════════════════════════════════════");
        ns.print(`📈 Income: ${formatMoney(income)}/sec`);
        ns.print(`🎮 Phase: ${phase.toUpperCase()}`);
        ns.print(`🔬 Variant: ${activeVariant}`);
        ns.print(`🔄 Cycle: ${cycle}`);
        ns.print("");

        ns.print("⚙️ Config:");
        ns.print(`   hackPercent: ${(config.hackPercent * 100).toFixed(0)}%`);
        ns.print(`   securityThreshold: ${config.securityThreshold}`);
        ns.print("");

        // Optimiser toutes les 6 cycles (60s)
        if (cycle % 6 === 0) {
            optimize(ns, phase);
        }

        // Mettre à jour les directives
        updateDirectives(ns, phase);

        // Écrire config pour les autres daemons
        writeConfig(ns);

        // Mettre à jour state
        updateState(ns, phase);

        lastMoney = money;
        lastCheck = Date.now();
    }
}

function detectPhase(ns, money) {
    const hackLevel = ns.getHackingLevel();
    if (money > 1e15 && hackLevel > 2000) return "endgame";
    if (money > 1e12 && hackLevel > 1000) return "late";
    if (money > 1e9 && hackLevel > 500) return "mid";
    if (money > 1e6 && hackLevel > 50) return "early-mid";
    return "early";
}

function optimize(ns, phase) {
    if (history.length < 10) return;

    // Analyser tendance
    const recent = history.slice(-20);
    const older = history.slice(-40, -20);

    if (older.length < 10) return;

    const recentAvg = recent.reduce((s, h) => s + h.income, 0) / recent.length;
    const olderAvg = older.reduce((s, h) => s + h.income, 0) / older.length;
    const trend = olderAvg !== 0 ? (recentAvg - olderAvg) / Math.abs(olderAvg) : 0;

    ns.print(`📊 Trend: ${(trend * 100).toFixed(1)}%`);

    // Ajuster selon tendance
    if (trend < -0.1) {
        // Tendance négative - être plus conservateur
        if (activeVariant === "extreme") {
            activeVariant = "aggressive";
        } else if (activeVariant === "aggressive") {
            activeVariant = "balanced";
        }
        config = { ...VARIANTS[activeVariant] };
        ns.print(`🔄 Switch → ${activeVariant}`);
    } else if (trend > 0.2) {
        // Bonne tendance - être plus agressif
        if (activeVariant === "conservative") {
            activeVariant = "balanced";
        } else if (activeVariant === "balanced") {
            activeVariant = "aggressive";
        }
        config = { ...VARIANTS[activeVariant] };
        ns.print(`🔄 Switch → ${activeVariant}`);
    }

    // Adapter selon phase
    switch (phase) {
        case "early":
            config.hackPercent = Math.min(config.hackPercent, 0.4);
            break;
        case "endgame":
            config.hackPercent = Math.max(config.hackPercent, 0.8);
            break;
    }
}

function updateDirectives(ns, phase) {
    const directives = {};

    switch (phase) {
        case "early":
            directives.sleeveMode = "training";
            directives.gangMode = "respect";
            directives.globalPriority = "xp";
            break;
        case "early-mid":
        case "mid":
            directives.sleeveMode = "crime";
            directives.gangMode = "money";
            directives.globalPriority = "money";
            break;
        case "late":
            directives.sleeveMode = "faction";
            directives.gangMode = "money";
            directives.globalPriority = "rep";
            break;
        case "endgame":
            directives.sleeveMode = "faction";
            directives.globalPriority = "prestige";
            break;
    }

    directives.currentPhase = phase;
    directives.hackConfig = { ...config };

    ns.write(DIRECTIVES_FILE, JSON.stringify(directives), "w");
}

function writeConfig(ns) {
    const data = {
        hackPercent: config.hackPercent,
        securityThreshold: config.securityThreshold,
        moneyThreshold: config.moneyThreshold,
        variant: activeVariant,
        timestamp: Date.now(),
    };
    ns.write(CONFIG_FILE, JSON.stringify(data), "w");
}

function updateState(ns, phase) {
    const state = {
        phase,
        priority: phase === "early" ? "xp" : phase === "late" ? "rep" : "money",
        config: { ...config },
        lastUpdate: Date.now(),
    };
    ns.write(STATE_FILE, JSON.stringify(state), "w");
}

function formatMoney(n) {
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "k";
    return "$" + n.toFixed(0);
}
