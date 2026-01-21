/**
 * Bitburner AI - Faction & Augmentation Daemon
 * Automatisation de la gestion des factions et achat d'augmentations
 * 
 * Fonctionnalités:
 * - Rejoint automatiquement les factions invitées
 * - Travaille pour les factions pour gagner de la réputation
 * - Achète automatiquement les augmentations disponibles
 * - Achète les augmentations NeuroFlux Governor en boucle
 * 
 * Nécessite: Singularity API (BitNode 4 ou Source-File 4)
 * 
 * Usage: run daemon-factions.js
 */

import { findPath } from "/lib/utils.js";

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

    const FACTION_WORK_TYPE = "hacking"; // ou "field" ou "security"

    while (true) {
        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🧬 FACTION DAEMON");
        ns.print("═══════════════════════════════════════");

        // 1. Rejoindre les factions
        const invites = ns.singularity.checkFactionInvitations();
        for (const faction of invites) {
            // Liste d'exclusion optionnelle (ex: ne pas rejoindre les villes rivales si on veut se focaliser)
            // Pour l'instant on rejoint tout
            if (ns.singularity.joinFaction(faction)) {
                ns.print(`✅ Rejoint: ${faction}`);
                ns.toast(`Rejoint ${faction}`, "success");
            }
        }

        // 2. Gestion des augmentations
        const myFactions = ns.getPlayer().factions;
        const ownedAugs = ns.singularity.getOwnedAugmentations(true); // true = inclure celles achetées mais pas installées
        const money = ns.getServerMoneyAvailable("home");

        let bestAug = null;

        for (const faction of myFactions) {
            const augs = ns.singularity.getAugmentationsFromFaction(faction);

            for (const augName of augs) {
                if (ownedAugs.includes(augName)) continue;

                // Prérequis
                const prereqs = ns.singularity.getAugmentationPrereq(augName);
                if (prereqs.some(p => !ownedAugs.includes(p))) continue;

                const cost = ns.singularity.getAugmentationPrice(augName);
                const repReq = ns.singularity.getAugmentationRepReq(augName);
                const factionRep = ns.singularity.getFactionRep(faction);

                // Si on a assez de réputation
                if (factionRep >= repReq) {
                    // Si on a assez d'argent
                    if (money >= cost) {
                        // Priorité aux augmentations de hacking
                        const stats = ns.singularity.getAugmentationStats(augName);
                        let isHacking = false;
                        if (stats.hacking_chance_mult || stats.hacking_speed_mult || stats.hacking_money_mult || stats.hacking_grow_mult) {
                            isHacking = true;
                        }

                        // Acheter immédiatement si c'est important ou si on a beaucoup d'argent
                        if (isHacking || money > cost * 10) {
                            if (ns.singularity.purchaseAugmentation(faction, augName)) {
                                ns.print(`🧬 ACHETÉ: ${augName} ($${formatMoney(cost)})`);
                                ns.toast(`Acheté ${augName}`, "success");
                                // Recalculer l'argent
                            }
                        }
                    }
                } else {
                    // Candidat pour le travail : on veut cette augmentation mais pas assez de rep
                    // On choisit celui qui demande le moins de temps restant
                    /* 
                       Ceci est une logique simplifiée. Pour une vraie opti, il faudrait prioriser 
                       les factions qui ont les augs les plus puissantes. 
                       Pour l'instant, on travaille pour la faction qui a une aug achetable "bientôt". 
                    */
                }
            }
        }

        // 3. NeuroFlux Governor (si on a de l'argent en trop)
        if (money > 100e9) { // Garder un buffer
            for (const faction of myFactions) {
                if (ns.singularity.purchaseAugmentation(faction, "NeuroFlux Governor")) {
                    ns.print(`🧠 ACHETÉ: NeuroFlux Governor chez ${faction}`);
                    break; // Un par cycle pour ne pas drainer tout l'argent
                }
            }
        }

        // 4. Travailler pour une faction (logique simple)
        // Si on ne fait rien d'autre (pas de crime, pas d'étude), on travaille
        const currentWork = ns.singularity.getCurrentWork();

        if (!currentWork) {
            // Trouver une faction pour laquelle travailler
            // Priorité: Factions avec augs non achetées
            let targetFaction = null;

            for (const faction of myFactions) {
                const augs = ns.singularity.getAugmentationsFromFaction(faction);
                const unowned = augs.filter(a => !ownedAugs.includes(a) && a !== "NeuroFlux Governor");
                if (unowned.length > 0) {
                    targetFaction = faction;
                    break;
                }
            }

            if (targetFaction) {
                try {
                    ns.singularity.workForFaction(targetFaction, FACTION_WORK_TYPE, false);
                    ns.print(`🔨 Travail: ${targetFaction}`);
                } catch (e) {
                    ns.singularity.workForFaction(targetFaction, "field", false);
                }
            }
        }

        // Afficher l'état
        const installed = ns.singularity.getOwnedAugmentations(false).length;
        const queued = ownedAugs.length - installed;

        ns.print("");
        ns.print(`🧬 Augmentations: ${installed} installées`);
        ns.print(`📦 En attente: ${queued} (Reset requis)`);

        if (queued > 5) {
            ns.print("⚠️ CONSEIL: Installez les augmentations via Soft Reset");
        }

        // 5. Backdoor automatique (Story / Factions)
        await manageBackdoors(ns);

        await ns.sleep(60000); // 1 minute
    }
}

/**
 * Gérer les backdoors pour les factions
 * @param {NS} ns
 */
async function manageBackdoors(ns) {
    const PLOT_SERVERS = [
        "CSEC",         // CyberSec
        "avmnite-0xh",  // NiteSec
        "I.I.I.I",      // The Black Hand
        "run4theh111z", // BitRunners
    ];

    for (const host of PLOT_SERVERS) {
        const server = ns.getServer(host);

        // Si non rooté, on ne peut pas backdoor
        if (!server.hasAdminRights) continue;

        // Si déjà backdoored, skip
        if (server.backdoorInstalled) continue;

        // Si niveau insuffisant, skip
        if (ns.getHackingLevel() < server.requiredHackingSkill) continue;

        ns.print(`🚪 Backdoor: ${host}...`);

        // Trouver le chemin
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
            ns.print(`❌ Echec backdoor ${host}: ${e}`);
        }

        // Retour maison
        ns.singularity.connect("home");
    }
}

function formatMoney(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
