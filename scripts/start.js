/**
 * Bitburner AI - Universal Start Script
 * 
 * Ce script analyse la situation actuelle (RAM disponible) et lance
 * automatiquement le script le plus approprié :
 * - `early.js` si < 32GB RAM (optimisé pour faible mémoire)
 * - `main.js` si >= 32GB RAM (orchestrateur complet)
 * 
 * Usage: run start.js
 */

/** @param {NS} ns */
export async function main(ns) {
    const ram = ns.getServerMaxRam("home");
    const threshold = 32; // GB

    ns.tprint("═══════════════════════════════════════");
    ns.tprint("  🚀 BITBURNER AI BOOTSTRAP");
    ns.tprint("═══════════════════════════════════════");
    ns.tprint(`💾 RAM Disponible: ${ram}GB`);

    // Détection BitNode
    try {
        const resetInfo = ns.getResetInfo();
        const bn = resetInfo.currentNode;
        ns.tprint(`🌍 BitNode: ${bn}`);
        // Sauvegarder la config BitNode pour les autres daemons
        const bnConfig = getBitNodeConfig(bn);
        ns.write("/data/bitnode-config.txt", JSON.stringify(bnConfig), "w");
        ns.tprint(`💾 Config BitNode chargée pour BN${bn}`);
    } catch (e) {
        // Fallback pour vieilles versions
        ns.write("/data/bitnode-config.txt", JSON.stringify({ multiplier: 1, focus: "balanced" }), "w");
    }

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
 * Configuration spécifique selon le BitNode
 */
function getBitNodeConfig(bn) {
    const config = {
        multiplier: 1,
        focus: "balanced", // "hacking", "combat", "corporation", "balanced"
        canHack: true,
        canBuyServers: true,
    };

    switch (bn) {
        case 1: // Source-File 1 (Genesis): Standard
            break;
        case 8: // Ghost of Wall Street: Trading only
            config.focus = "trading";
            config.canHack = false;
            break;
        case 9: // Hacktocracy: Hacknet only
            config.focus = "hacknet";
            break;
        case 13: // The Stanek: Stanek focus
            config.focus = "stanek";
            break;
        default:
            config.focus = "balanced";
            break;
    }

    return config;
}
