/**
 * Bitburner AI - Prestige Analyzer
 * Analyse le moment optimal pour installer les augmentations (Reset)
 * 
 * Conseils basés sur:
 * - Nombre d'augmentations en attente
 * - Multiplicateur de stats potentiel
 * - Temps de jeu depuis le dernier reset
 * 
 * Usage: run daemon-prestige.js
 */

import { formatMoney, formatTime } from "/lib/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    while (true) {
        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🔄 PRESTIGE ANALYZER");
        ns.print("═══════════════════════════════════════");

        const owned = ns.singularity.getOwnedAugmentations(true);
        const installed = ns.singularity.getOwnedAugmentations(false);
        const queued = owned.length - installed.length;

        ns.print(`📦 Augmentations en attente: ${queued}`);

        // Analyser l'impact
        // Note: C'est complexe de calculer l'impact exact sans hardcoder les stats des augs
        // Mais on peut utiliser une heuristique simple base sur la quantit

        if (queued > 0) {
            // Seuil recommand par défaut: 5-8 augs
            // Plus on avance, plus on peut reset souvent
            let threshold = 5;

            // Si on a Daedalus, on veut peut-être attendre The Red Pill
            if (owned.includes("The Red Pill") && !installed.includes("The Red Pill")) {
                ns.print("💊 THE RED PILL PRÊTE ! RESET PRIORITAIRE !");
                ns.toast("The Red Pill prête ! Reset !", "error", 10000);
            }

            if (queued >= threshold) {
                ns.print("✅ CONSEIL: SOFT RESET RECOMMANDÉ");
                ns.print(`   Vous avez ${queued} nouvelles augmentations.`);
                ns.toast(`Reset Recommandé (${queued} augs)`, "warning", 5000);
            } else {
                ns.print(`⏳ Continuez de farmer. Objectif: ${threshold} augs`);
            }
        } else {
            ns.print("✨ Aucune augmentation en attente.");
        }

        // Analyser le temps depuis reset
        const uptime = ns.getTimeSinceLastAug();
        ns.print(`⏱️ Temps session: ${formatTime(uptime)}`);

        // Analyser la réputation BitNode
        // check faction rep for critical factions (Daedalus)
        const factions = ns.getPlayer().factions;
        if (factions.includes("Daedalus")) {
            const rep = ns.singularity.getFactionRep("Daedalus");
            if (rep >= 2.5e6 && !owned.includes("The Red Pill")) {
                ns.print("⚠️ DAEDALUS REP ATTEINTE ! ACHETEZ RED PILL !");
            }
        }

        await ns.sleep(60000);
    }
}
