/**
 * Bitburner AI - Start Script (Lightweight)
 * RAM optimisé: ~3GB
 * 
 * Usage: run start.js
 */

/** @param {NS} ns */
export async function main(ns) {
    const totalRam = ns.getServerMaxRam("home");
    const usedRam = ns.getServerUsedRam("home");
    const freeRam = totalRam - usedRam;

    ns.tprint("╔═══════════════════════════════════════╗");
    ns.tprint("║     🚀 BITBURNER AI v3.0 BOOTSTRAP    ║");
    ns.tprint("╚═══════════════════════════════════════╝");
    ns.tprint("");
    ns.tprint(`💾 RAM Total: ${totalRam}GB | Libre: ${freeRam.toFixed(1)}GB`);

    // Détection BitNode
    let bn = 1;
    try {
        bn = ns.getResetInfo().currentNode;
        ns.tprint(`🌍 BitNode: ${bn}`);
    } catch (e) {
        ns.tprint("⚠️ BitNode: 1 (default)");
    }

    // Config BitNode simplifiée
    const bnConfig = {
        bitNode: bn,
        focus: "balanced",
        canHack: bn !== 8,
        skipDaemons: [],
        priorityDaemons: [],
    };

    // Ajuster selon le BitNode
    switch (bn) {
        case 2: bnConfig.focus = "gang"; bnConfig.priorityDaemons = ["gang"]; break;
        case 3: bnConfig.focus = "corp"; bnConfig.priorityDaemons = ["corp"]; break;
        case 6: case 7: bnConfig.focus = "bladeburner"; break;
        case 8: bnConfig.focus = "stocks"; bnConfig.skipDaemons = ["hack"]; break;
        case 9: bnConfig.focus = "hacknet"; break;
    }

    ns.tprint(`🎯 Focus: ${bnConfig.focus.toUpperCase()}`);

    // Sauvegarder config
    ns.write("/data/bitnode-config.txt", JSON.stringify(bnConfig), "w");

    // Initialiser brain-state
    const state = {
        bitNode: bn,
        phase: "early",
        priority: "money",
        config: { hackPercent: 0.5 },
        startTime: Date.now(),
    };
    ns.write("/data/brain-state.txt", JSON.stringify(state), "w");

    ns.tprint("");

    // Calculer RAM après spawn (on libère notre RAM)
    const selfRam = ns.getScriptRam(ns.getScriptName());
    const ramAfterSpawn = freeRam + selfRam;

    // Choisir le script approprié
    if (totalRam >= 32) {
        const mainRam = ns.getScriptRam("main.js");
        if (mainRam <= ramAfterSpawn) {
            ns.tprint(`📈 Lancement main.js (${mainRam.toFixed(1)}GB)...`);
            ns.spawn("main.js");
            return;
        }
    }

    const earlyRam = ns.getScriptRam("early.js");
    if (earlyRam <= ramAfterSpawn) {
        ns.tprint(`📉 Lancement early.js (${earlyRam.toFixed(1)}GB)...`);
        ns.spawn("early.js");
        return;
    }

    ns.tprint("❌ Pas assez de RAM!");
    ns.tprint(`   Disponible: ${ramAfterSpawn.toFixed(1)}GB`);
}
