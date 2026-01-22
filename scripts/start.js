/**
 * Bitburner AI - Universal Start Script v2.0
 * 
 * Ce script analyse la situation actuelle et lance automatiquement
 * le script le plus approprié avec configuration BitNode-spécifique.
 * 
 * Améliorations v2.0:
 * - Configuration complète pour tous les BitNodes (1-14)
 * - Détection des Source-Files
 * - Initialisation du brain-state
 * - Skip/Priority des daemons selon le BN
 * 
 * Usage: run start.js
 */

/** @param {NS} ns */
export async function main(ns) {
    const ram = ns.getServerMaxRam("home");
    const threshold = 32; // GB

    ns.tprint("╔═══════════════════════════════════════╗");
    ns.tprint("║     🚀 BITBURNER AI v2.0 BOOTSTRAP    ║");
    ns.tprint("╚═══════════════════════════════════════╝");
    ns.tprint("");
    ns.tprint(`💾 RAM Disponible: ${ram}GB`);

    // Détection BitNode et Source-Files
    let bn = 1;
    let sourceFiles = [];

    try {
        const resetInfo = ns.getResetInfo();
        bn = resetInfo.currentNode;
        ns.tprint(`🌍 BitNode: ${bn}`);

        // Détecter les source files
        sourceFiles = detectSourceFiles(ns);
        if (sourceFiles.length > 0) {
            ns.tprint(`📁 Source-Files: ${sourceFiles.length} détectés`);
        }
    } catch (e) {
        ns.tprint("⚠️ Impossible de détecter le BitNode, default à BN1");
    }

    // Générer la config BitNode
    const bnConfig = getBitNodeConfig(bn, sourceFiles);
    ns.tprint(`🎯 Focus: ${bnConfig.focus.toUpperCase()}`);

    // Afficher les daemons prioritaires
    if (bnConfig.priorityDaemons.length > 0) {
        ns.tprint(`⭐ Priorité: ${bnConfig.priorityDaemons.join(", ")}`);
    }

    // Afficher les daemons désactivés
    if (bnConfig.skipDaemons.length > 0) {
        ns.tprint(`⏭️ Skip: ${bnConfig.skipDaemons.join(", ")}`);
    }

    // Sauvegarder la config BitNode
    ns.write("/data/bitnode-config.txt", JSON.stringify(bnConfig, null, 2), "w");
    ns.tprint("💾 Config BitNode sauvegardée");

    // Initialiser le brain-state
    initializeBrainState(ns, bn, sourceFiles, bnConfig);
    ns.tprint("🧠 Brain-state initialisé");

    ns.tprint("");

    // Lancer le script approprié
    if (ram < threshold) {
        ns.tprint("📉 Mode détecté: EARLY GAME");
        ns.tprint("▶️ Lancement de early.js...");
        ns.spawn("early.js");
    } else {
        ns.tprint("📈 Mode détecté: ADVANCED GAME");
        ns.tprint("▶️ Lancement de main.js...");
        ns.spawn("main.js");
    }
}

/**
 * Détecter les Source-Files disponibles
 */
function detectSourceFiles(ns) {
    const sourceFiles = [];

    // Test chaque API pour détecter les SF
    const sfTests = [
        { sf: 1, test: () => ns.getResetInfo() },
        { sf: 2, test: () => ns.gang?.inGang !== undefined },
        { sf: 3, test: () => ns.corporation?.getCorporation !== undefined },
        { sf: 4, test: () => ns.singularity?.getOwnedAugmentations !== undefined },
        { sf: 5, test: () => ns.grafting?.getGraftableAugmentations !== undefined },
        { sf: 6, test: () => ns.bladeburner?.getCurrentAction !== undefined },
        { sf: 7, test: () => ns.bladeburner?.getCurrentAction !== undefined },
        { sf: 9, test: () => ns.hacknet?.hashCapacity !== undefined },
        { sf: 10, test: () => ns.sleeve?.getNumSleeves !== undefined },
        { sf: 12, test: () => true }, // Toujours actif si on peut lancer des scripts
        { sf: 13, test: () => ns.stanek?.activeFragments !== undefined },
    ];

    for (const { sf, test } of sfTests) {
        try {
            if (test()) {
                sourceFiles.push(sf);
            }
        } catch (e) {
            // SF non disponible
        }
    }

    return sourceFiles;
}

/**
 * Configuration spécifique selon le BitNode
 */
function getBitNodeConfig(bn, sourceFiles) {
    const config = {
        bitNode: bn,
        multiplier: 1,
        focus: "balanced",
        canHack: true,
        canBuyServers: true,
        skipDaemons: [],
        priorityDaemons: [],
        description: "",
    };

    switch (bn) {
        case 1: // Source Genesis
            config.focus = "hacking";
            config.description = "Standard - Focus hacking et serveurs";
            config.priorityDaemons = ["hack", "servers", "hacknet"];
            break;

        case 2: // Rise of the Underworld
            config.focus = "gang";
            config.description = "Gang focus - Crime et territoire";
            config.priorityDaemons = ["gang", "hack", "sleeve"];
            break;

        case 3: // Corporatocracy
            config.focus = "corporation";
            config.description = "Corporation focus - Économie et gestion";
            config.priorityDaemons = ["corp", "hack", "stocks"];
            break;

        case 4: // The Singularity
            config.focus = "hacking";
            config.description = "Singularity - APIs coûteuses, hacking pur";
            config.multiplier = 0.8;
            // Skip factions car les APIs sont très chères au début
            config.skipDaemons = ["factions"];
            config.priorityDaemons = ["hack", "servers"];
            break;

        case 5: // Artificial Intelligence
            config.focus = "intelligence";
            config.description = "Intelligence focus - Stats et optimisation";
            config.priorityDaemons = ["hack", "optimizer", "contracts"];
            break;

        case 6: // Bladeburners
            config.focus = "bladeburner";
            config.description = "Bladeburner focus - Combat et missions";
            config.priorityDaemons = ["bladeburner", "sleeve", "gang"];
            config.skipDaemons = ["hacknet"]; // Moins utile ici
            break;

        case 7: // Bladeburners 2054
            config.focus = "bladeburner";
            config.description = "Bladeburner avancé - Stats combat réduites";
            config.multiplier = 0.6;
            config.priorityDaemons = ["bladeburner", "sleeve"];
            config.skipDaemons = ["hacknet", "corp"];
            break;

        case 8: // Ghost of Wall Street
            config.focus = "stocks";
            config.description = "Trading only - Pas de hacking";
            config.canHack = false;
            config.priorityDaemons = ["stocks"];
            config.skipDaemons = ["hack", "servers", "hacknet", "contracts"];
            break;

        case 9: // Hacktocracy
            config.focus = "hacknet";
            config.description = "Hacknet focus - Hashes et serveurs";
            config.priorityDaemons = ["hacknet", "hack"];
            config.skipDaemons = ["stocks"]; // API très chère
            break;

        case 10: // Digital Carbon
            config.focus = "sleeve";
            config.description = "Sleeve focus - Clones et parallélisme";
            config.priorityDaemons = ["sleeve", "hack", "gang"];
            break;

        case 11: // The Big Crash
            config.focus = "balanced";
            config.description = "Crash - Tous les stats réduits";
            config.multiplier = 0.5;
            config.priorityDaemons = ["hack", "stocks"];
            // Tout est plus difficile, on garde les essentiels
            config.skipDaemons = ["corp", "bladeburner"];
            break;

        case 12: // The Recursion
            config.focus = "hacking";
            config.description = "Recursion - Pénalités cumulatives";
            config.multiplier = 0.8;
            config.priorityDaemons = ["hack", "servers", "factions"];
            // Focus sur les augmentations pour contre les pénalités
            break;

        case 13: // They're lunatics (Stanek's Gift)
            config.focus = "stanek";
            config.description = "Stanek focus - Fragments et boost";
            config.priorityDaemons = ["stanek", "hack"];
            break;

        case 14: // They're lunatics
            config.focus = "balanced";
            config.description = "Sociétés secrètes - Exploration";
            config.priorityDaemons = ["hack", "factions", "contracts"];
            break;

        default:
            config.focus = "balanced";
            config.description = "Mode équilibré";
            config.priorityDaemons = ["hack", "servers", "hacknet"];
            break;
    }

    // Ajuster selon les Source-Files disponibles
    if (!sourceFiles.includes(2) && !config.skipDaemons.includes("gang")) {
        config.skipDaemons.push("gang");
    }
    if (!sourceFiles.includes(3) && !config.skipDaemons.includes("corp")) {
        config.skipDaemons.push("corp");
    }
    if (!sourceFiles.includes(4) && !config.skipDaemons.includes("factions")) {
        config.skipDaemons.push("factions");
    }
    if (!sourceFiles.includes(6) && !sourceFiles.includes(7) && !config.skipDaemons.includes("bladeburner")) {
        config.skipDaemons.push("bladeburner");
    }
    if (!sourceFiles.includes(10) && !config.skipDaemons.includes("sleeve")) {
        config.skipDaemons.push("sleeve");
    }
    if (!sourceFiles.includes(13) && !config.skipDaemons.includes("stanek")) {
        config.skipDaemons.push("stanek");
    }

    return config;
}

/**
 * Initialiser le brain-state
 */
function initializeBrainState(ns, bn, sourceFiles, bnConfig) {
    const state = {
        bitNode: bn,
        sourceFiles,
        phase: "early",
        priority: bnConfig.focus,
        config: {
            hackPercent: 0.5,
            securityThreshold: 5,
            moneyThreshold: 0.75,
        },
        stats: {
            hackingLevel: ns.getHackingLevel(),
            netWorth: ns.getServerMoneyAvailable("home"),
        },
        activeDaemons: [],
        startTime: Date.now(),
        lastUpdate: Date.now(),
    };

    ns.write("/data/brain-state.txt", JSON.stringify(state, null, 2), "w");
}
