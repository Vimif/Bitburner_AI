/**
 * Bitburner AI - Faction & Augmentation Daemon v2.0
 * Automatisation de la gestion des factions et achat d'augmentations
 * 
 * Améliorations v2.0:
 * - Prioritisation des augmentations par stats hacking
 * - Work automatique vers les meilleures augmentations
 * - Backdoor automation amélioré
 * - Reputation tracking
 * - Feedback vers optimizer
 * 
 * Nécessite: Singularity API (BitNode 4 ou Source-File 4)
 * 
 * Usage: run daemon-factions.js
 */

import { findPath, formatMoney } from "../lib/utils.js";
import { getState, sendFeedback } from "../lib/brain-state.js";

// Serveurs importants pour backdoor
const PLOT_SERVERS = [
    { host: "CSEC", faction: "CyberSec" },
    { host: "avmnite-02h", faction: "NiteSec" },
    { host: "I.I.I.I", faction: "The Black Hand" },
    { host: "run4theh111z", faction: "BitRunners" },
];

// Priorité des augmentations par type
const AUG_PRIORITY = {
    hacking: 10,
    hacking_chance: 9,
    hacking_speed: 9,
    hacking_money: 8,
    hacking_grow: 7,
    hacking_exp: 6,
    faction_rep: 5,
    company_rep: 4,
    crime: 3,
    combat: 2,
    charisma: 1,
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier l'accès Singularity
    try {
        ns.singularity.getOwnedAugmentations();
    } catch (e) {
        ns.tprint("❌ Singularity API non disponible.");
        ns.tprint("   Nécessite BitNode 4 ou Source-File 4.");
        return;
    }

    let lastFeedbackTime = 0;
    let totalAugsBought = 0;

    while (true) {
        const state = getState(ns);
        const money = ns.getServerMoneyAvailable("home");

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🧬 FACTION DAEMON v2.0");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: ${formatMoney(money)}`);

        // 1. Rejoindre les factions invitées
        const invites = ns.singularity.checkFactionInvitations();
        for (const faction of invites) {
            if (ns.singularity.joinFaction(faction)) {
                ns.print(`✅ Rejoint: ${faction}`);
                ns.toast(`Rejoint ${faction}`, "success");
            }
        }

        // 2. Collecter les stats
        const myFactions = ns.getPlayer().factions;
        const ownedAugs = ns.singularity.getOwnedAugmentations(true);
        const installedAugs = ns.singularity.getOwnedAugmentations(false);
        const pendingAugs = ownedAugs.length - installedAugs.length;

        ns.print(`🏛️ Factions: ${myFactions.length}`);
        ns.print(`🧬 Augmentations: ${installedAugs.length} (+${pendingAugs} pending)`);
        ns.print("");

        // 3. Trouver les meilleures augmentations disponibles
        const availableAugs = getAvailableAugmentations(ns, myFactions, ownedAugs);
        const sortedAugs = prioritizeAugmentations(ns, availableAugs);

        // 4. Acheter les augmentations
        for (const aug of sortedAugs) {
            if (money >= aug.cost) {
                if (ns.singularity.purchaseAugmentation(aug.faction, aug.name)) {
                    ns.print(`🧬 ACHETÉ: ${aug.name} (${formatMoney(aug.cost)})`);
                    ns.toast(`Acheté ${aug.name}`, "success");
                    totalAugsBought++;
                }
            }
        }

        // 5. NeuroFlux Governor (si on a beaucoup d'argent)
        if (money > 50e9) {
            for (const faction of myFactions) {
                try {
                    if (ns.singularity.purchaseAugmentation(faction, "NeuroFlux Governor")) {
                        ns.print(`🧠 ACHETÉ: NeuroFlux Governor`);
                        totalAugsBought++;
                        break;
                    }
                } catch (e) { }
            }
        }

        // 6. Afficher les meilleures augmentations disponibles
        ns.print("🎯 Meilleures augmentations:");
        for (const aug of sortedAugs.slice(0, 5)) {
            const repStatus = aug.hasRep ? "✅" : `❌ ${formatRep(aug.repNeeded - aug.currentRep)}`;
            const costStatus = money >= aug.cost ? "✅" : `❌ ${formatMoney(aug.cost - money)}`;
            ns.print(`   ${aug.name}`);
            ns.print(`      Rep: ${repStatus} | Cost: ${costStatus}`);
        }
        ns.print("");

        // 7. Travailler pour une faction
        await manageFactionWork(ns, myFactions, ownedAugs, sortedAugs, state);

        // 8. Gérer les backdoors
        await manageBackdoors(ns);

        // 9. Warning si beaucoup d'augs en attente
        if (pendingAugs >= 5) {
            ns.print("⚠️ CONSEIL: Installez les augmentations via Soft Reset!");
        }

        // Feedback
        if (Date.now() - lastFeedbackTime > 60000) {
            sendFeedback(ns, "factions", {
                factions: myFactions.length,
                augsInstalled: installedAugs.length,
                augsPending: pendingAugs,
                augsBought: totalAugsBought,
            });
            lastFeedbackTime = Date.now();
        }

        await ns.sleep(60000); // Check toutes les minutes
    }
}

/**
 * Obtenir les augmentations disponibles
 */
function getAvailableAugmentations(ns, factions, ownedAugs) {
    const available = [];

    for (const faction of factions) {
        try {
            const factionRep = ns.singularity.getFactionRep(faction);
            const augs = ns.singularity.getAugmentationsFromFaction(faction);

            for (const augName of augs) {
                if (augName === "NeuroFlux Governor") continue;
                if (ownedAugs.includes(augName)) continue;

                // Vérifier les prérequis
                const prereqs = ns.singularity.getAugmentationPrereq(augName);
                if (prereqs.some(p => !ownedAugs.includes(p))) continue;

                const cost = ns.singularity.getAugmentationPrice(augName);
                const repReq = ns.singularity.getAugmentationRepReq(augName);
                const hasRep = factionRep >= repReq;

                available.push({
                    name: augName,
                    faction,
                    cost,
                    repReq,
                    currentRep: factionRep,
                    repNeeded: repReq,
                    hasRep,
                });
            }
        } catch (e) { }
    }

    return available;
}

/**
 * Prioritiser les augmentations
 */
function prioritizeAugmentations(ns, augs) {
    const scored = augs.map(aug => {
        let score = 0;

        try {
            const stats = ns.singularity.getAugmentationStats(aug.name);

            // Scorer selon les multiplicateurs
            for (const [key, value] of Object.entries(stats)) {
                if (key.includes("hacking") && !key.includes("exp")) {
                    score += (value - 1) * AUG_PRIORITY.hacking * 100;
                }
                if (key.includes("hacking_exp")) {
                    score += (value - 1) * AUG_PRIORITY.hacking_exp * 100;
                }
                if (key.includes("faction_rep")) {
                    score += (value - 1) * AUG_PRIORITY.faction_rep * 100;
                }
            }
        } catch (e) { }

        // Bonus si on a la rep et l'argent
        if (aug.hasRep) score += 50;

        return { ...aug, score };
    });

    // Trier par score puis par coût
    scored.sort((a, b) => {
        // Priorité 1: Ceux qu'on peut acheter maintenant
        if (a.hasRep && !b.hasRep) return -1;
        if (!a.hasRep && b.hasRep) return 1;

        // Priorité 2: Score
        if (b.score !== a.score) return b.score - a.score;

        // Priorité 3: Moins cher d'abord
        return a.cost - b.cost;
    });

    return scored;
}

/**
 * Gérer le travail pour les factions
 */
async function manageFactionWork(ns, factions, ownedAugs, targetAugs, state) {
    const currentWork = ns.singularity.getCurrentWork();

    // Si déjà en train de travailler, afficher
    if (currentWork && currentWork.type === "FACTION") {
        ns.print(`🔨 Travail: ${currentWork.factionName}`);
        return;
    }

    // Si pas de travail, trouver la meilleure faction
    if (!currentWork) {
        // Trouver la faction avec les meilleures augs non débloquées
        let targetFaction = null;
        let bestScore = 0;

        for (const aug of targetAugs) {
            if (!aug.hasRep && aug.score > bestScore) {
                bestScore = aug.score;
                targetFaction = aug.faction;
            }
        }

        if (targetFaction) {
            try {
                // Essayer hacking d'abord
                ns.singularity.workForFaction(targetFaction, "hacking", false);
                ns.print(`🔨 Nouveau travail: ${targetFaction}`);
            } catch (e) {
                try {
                    ns.singularity.workForFaction(targetFaction, "field", false);
                } catch (e2) { }
            }
        }
    }
}

/**
 * Gérer les backdoors automatiques
 */
async function manageBackdoors(ns) {
    for (const { host, faction } of PLOT_SERVERS) {
        try {
            const server = ns.getServer(host);

            if (!server.hasAdminRights) continue;
            if (server.backdoorInstalled) continue;
            if (ns.getHackingLevel() < server.requiredHackingSkill) continue;

            ns.print(`🚪 Backdoor: ${host}...`);

            const path = findPath(ns, host);
            if (path.length === 0) continue;

            // Se connecter
            for (const jump of path) {
                ns.singularity.connect(jump);
            }

            // Installer
            try {
                await ns.singularity.installBackdoor();
                ns.toast(`Backdoor: ${host}`, "success");
                ns.print(`✅ Backdoor installé sur ${host}`);
            } catch (e) {
                ns.print(`❌ Echec backdoor ${host}`);
            }

            // Retour maison
            ns.singularity.connect("home");
            return; // Un backdoor par cycle
        } catch (e) { }
    }
}

function formatRep(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
