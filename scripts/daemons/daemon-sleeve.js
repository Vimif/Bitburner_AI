/**
 * Bitburner AI - Sleeve Daemon v2.0
 * Gestion intelligente des Sleeves avec synergie globale
 * 
 * Améliorations v2.0:
 * - Intégration brain-state pour priorités globales
 * - Assignation synergique selon phase de jeu
 * - Support Bladeburner amélioré
 * - Gestion intelligente du shock/sync
 * - Feedback vers optimizer
 * 
 * Nécessite: Source-File 10
 * 
 * Usage: run daemon-sleeve.js
 */

import { getState, sendFeedback } from "../lib/brain-state.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier l'accès aux sleeves
    let numSleeves = 0;
    try {
        numSleeves = ns.sleeve.getNumSleeves();
    } catch (e) {
        ns.tprint("❌ API Sleeve non disponible.");
        ns.tprint("   Nécessite Source-File 10.");
        return;
    }

    if (numSleeves === 0) {
        ns.tprint("❌ Aucun sleeve disponible.");
        return;
    }

    // Configuration
    const config = {
        shockRecoveryThreshold: 50,   // Récupérer shock si > 50%
        syncThreshold: 95,             // Sync si < 95%
        augBuyMultiplier: 5,           // Acheter si argent > coût * 5
    };

    let lastFeedbackTime = 0;

    ns.print(`👥 ${numSleeves} sleeves détectés`);

    while (true) {
        const state = getState(ns);
        const money = ns.getServerMoneyAvailable("home");

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  👥 SLEEVE DAEMON v2.0");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: $${formatMoney(money)}`);
        ns.print(`🎮 Phase: ${state.phase || "?"}`);
        ns.print(`🎯 Priorité: ${state.priority || "money"}`);
        ns.print(`👥 Sleeves: ${numSleeves}`);
        ns.print("");

        // Collecter les stats pour feedback
        let totalShock = 0;
        let totalSync = 0;

        for (let i = 0; i < numSleeves; i++) {
            const sleeve = ns.sleeve.getSleeve(i);
            const currentTask = ns.sleeve.getTask(i);

            totalShock += sleeve.shock;
            totalSync += sleeve.sync;

            ns.print(`🧬 Sleeve ${i}:`);
            ns.print(`   💫 Shock: ${sleeve.shock.toFixed(1)}% | Sync: ${sleeve.sync.toFixed(1)}%`);

            // Déterminer la tâche optimale
            const optimalTask = determineOptimalTask(ns, i, sleeve, state, config);

            // Afficher la tâche actuelle
            if (currentTask) {
                ns.print(`   📋 Task: ${formatTask(currentTask)}`);
            }

            // Appliquer si différent
            if (optimalTask && shouldChangeTask(currentTask, optimalTask)) {
                try {
                    applyTask(ns, i, optimalTask);
                    ns.print(`   ▶️ Nouvelle: ${optimalTask.type}`);
                } catch (e) {
                    // Fallback silencieux
                }
            }

            // Acheter des augmentations
            buyAugmentations(ns, i, config);
        }

        ns.print("");

        // Feedback
        if (Date.now() - lastFeedbackTime > 30000) {
            sendFeedback(ns, "sleeve", {
                count: numSleeves,
                avgShock: totalShock / numSleeves,
                avgSync: totalSync / numSleeves,
            });
            lastFeedbackTime = Date.now();
        }

        await ns.sleep(30000); // Toutes les 30 secondes
    }
}

/**
 * Déterminer la tâche optimale pour un sleeve
 */
function determineOptimalTask(ns, sleeveIndex, sleeve, state, config) {
    // Priorité 1: Récupérer du shock si élevé
    if (sleeve.shock > config.shockRecoveryThreshold) {
        return { type: "recovery" };
    }

    // Priorité 2: Synchroniser si < seuil
    if (sleeve.sync < config.syncThreshold) {
        return { type: "sync" };
    }

    // Priorité 3: Bladeburner si disponible et prioritaire
    if (state.priority === "combat" || state.priority === "bladeburner") {
        try {
            if (ns.bladeburner.inBladeburner()) {
                const city = ns.bladeburner.getCity();
                const chaos = ns.bladeburner.getCityChaos(city);

                // Diplomacy si chaos élevé
                if (chaos > 50) {
                    return { type: "bladeburner", action: "Diplomacy" };
                }

                // Sinon, aider avec les contracts
                return { type: "bladeburner", action: "Infiltrate Synthoids" };
            }
        } catch (e) { }
    }

    // Priorité 4: Faction Work si priorité = rep
    if (state.priority === "rep") {
        try {
            const playerWork = ns.singularity.getCurrentWork();
            if (playerWork && playerWork.type === "FACTION") {
                return {
                    type: "faction",
                    faction: playerWork.factionName,
                    workType: "Field Work"
                };
            }
        } catch (e) { }
    }

    // Priorité 5: Actions selon la priorité globale et l'index
    switch (state.priority) {
        case "xp":
            // XP hacking rapide
            return { type: "crime", crime: "Shoplift" }; // XP rapide

        case "money":
            // Crimes pour l'argent
            if (sleeveIndex % 2 === 0) {
                return { type: "crime", crime: "Homicide" };
            }
            return { type: "crime", crime: "Mug" };

        case "combat":
            // Entraînement combat
            const stats = ["Strength", "Defense", "Dexterity", "Agility"];
            const stat = stats[sleeveIndex % stats.length];
            return { type: "gym", gym: "Powerhouse Gym", stat };

        case "gang":
            // Si on a un gang, les sleeves font du crime
            return { type: "crime", crime: "Homicide" };

        default:
            // Rotation équilibrée par défaut
            switch (sleeveIndex % 4) {
                case 0:
                    return { type: "crime", crime: "Homicide" };
                case 1:
                    return { type: "class", university: "Rothman University", className: "Study Computer Science" };
                case 2:
                    return { type: "gym", gym: "Powerhouse Gym", stat: "Strength" };
                case 3:
                    return { type: "crime", crime: "Mug" };
            }
    }

    return { type: "crime", crime: "Shoplift" };
}

/**
 * Vérifier si on doit changer de tâche
 */
function shouldChangeTask(current, optimal) {
    if (!current) return true;
    if (current.type !== optimal.type) return true;

    // Comparaison spécifique par type
    if (optimal.type === "crime" && current.crimeType !== optimal.crime) return true;
    if (optimal.type === "faction" && current.factionName !== optimal.faction) return true;
    if (optimal.type === "gym" && (current.gymName !== optimal.gym || current.stat !== optimal.stat)) return true;
    if (optimal.type === "class" && current.classType !== optimal.className) return true;

    return false;
}

/**
 * Appliquer une tâche à un sleeve
 */
function applyTask(ns, sleeveIndex, task) {
    switch (task.type) {
        case "recovery":
            ns.sleeve.setToShockRecovery(sleeveIndex);
            break;
        case "sync":
            ns.sleeve.setToSynchronize(sleeveIndex);
            break;
        case "crime":
            ns.sleeve.setToCommitCrime(sleeveIndex, task.crime);
            break;
        case "class":
            ns.sleeve.setToUniversityCourse(sleeveIndex, task.university, task.className);
            break;
        case "gym":
            ns.sleeve.setToGymWorkout(sleeveIndex, task.gym, task.stat);
            break;
        case "bladeburner":
            ns.sleeve.setToBladeburnerAction(sleeveIndex, "General", task.action);
            break;
        case "faction":
            try {
                ns.sleeve.setToFactionWork(sleeveIndex, task.faction, task.workType);
            } catch (e) {
                // Fallback
                try {
                    ns.sleeve.setToFactionWork(sleeveIndex, task.faction, "Hacking Contracts");
                } catch (e2) {
                    ns.sleeve.setToFactionWork(sleeveIndex, task.faction, "Security Work");
                }
            }
            break;
    }
}

/**
 * Formater une tâche pour affichage
 */
function formatTask(task) {
    if (!task) return "Idle";

    switch (task.type) {
        case "CRIME": return `Crime: ${task.crimeType}`;
        case "CLASS": return `Study: ${task.classType}`;
        case "GYM": return `Gym: ${task.stat}`;
        case "FACTION": return `Faction: ${task.factionName}`;
        case "BLADEBURNER": return `BB: ${task.actionName}`;
        case "SYNCHRO": return "Synchronizing";
        case "RECOVERY": return "Shock Recovery";
        default: return task.type;
    }
}

/**
 * Acheter des augmentations pour un sleeve
 */
function buyAugmentations(ns, sleeveIndex, config) {
    const money = ns.getServerMoneyAvailable("home");

    try {
        const augs = ns.sleeve.getSleevePurchasableAugs(sleeveIndex);

        // Trier par coût (moins cher d'abord)
        augs.sort((a, b) => a.cost - b.cost);

        for (const aug of augs) {
            if (money > aug.cost * config.augBuyMultiplier) {
                if (ns.sleeve.purchaseSleeveAug(sleeveIndex, aug.name)) {
                    ns.print(`   🧬 Acheté: ${aug.name}`);
                }
            }
        }
    } catch (e) { }
}

function formatMoney(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
