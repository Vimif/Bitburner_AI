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
    } catch (e) {
        // Fallback pour vieilles versions
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
