/**
 * Bitburner AI - Sleeve Daemon
 * Automatisation de la gestion des Sleeves
 * 
 * Fonctionnalités:
 * - Assignation automatique des tâches
 * - Achat d'augmentations
 * - Synchronisation et récupération de choc
 * - Optimisation selon les objectifs
 * 
 * Nécessite: Source-File 10
 * 
 * Usage: run daemon-sleeve.js
 */

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

    ns.print(`👥 ${numSleeves} sleeves détectés`);

    while (true) {
        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  👥 SLEEVE DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: $${formatMoney(ns.getServerMoneyAvailable("home"))}`);
        ns.print(`👥 Sleeves: ${numSleeves}`);
        ns.print("");

        for (let i = 0; i < numSleeves; i++) {
            const sleeve = ns.sleeve.getSleeve(i);
            const task = ns.sleeve.getTask(i);

            ns.print(`🧬 Sleeve ${i}:`);
            ns.print(`   Shock: ${sleeve.shock.toFixed(1)}% | Sync: ${sleeve.sync.toFixed(1)}%`);

            if (task) {
                ns.print(`   Task: ${task.type}`);
            }

            // Logique d'assignation
            const optimalTask = determineOptimalTask(ns, i, sleeve);

            if (optimalTask) {
                try {
                    applyTask(ns, i, optimalTask);
                } catch (e) { }
            }

            // Acheter des augmentations si abordable
            buyAugmentations(ns, i);
        }

        await ns.sleep(30000); // Toutes les 30 secondes
    }
}

/**
 * Déterminer la tâche optimale pour un sleeve
 */
function determineOptimalTask(ns, sleeveIndex, sleeve) {
    // Priorité 1: Récupérer du shock si > 50%
    if (sleeve.shock > 50) {
        return { type: "recovery" };
    }

    // Priorité 2: Synchroniser si < 100%
    if (sleeve.sync < 100) {
        return { type: "sync" };
    }

    // Priorité 3: Bladeburner (Diplomacy si Chaos élevé)
    // Nécessite que le joueur soit dans la division Bladeburner
    try {
        if (ns.bladeburner.inBladeburner()) {
            const city = ns.bladeburner.getCity(); // Ville courante du joueur
            const chaos = ns.bladeburner.getCityChaos(city);
            if (chaos > 50) {
                return { type: "bladeburner", action: "Diplomacy" };
            }
            // Si on veut farmer des contracts/ops, on peut aussi le faire ici
            // return { type: "bladeburner", action: "Infiltrate Synthoids" }; 
        }
    } catch (e) { }

    // Priorité 4: Faction Work (si on a besoin de réputation)
    // On vérifie si le joueur travaille pour une faction
    const playerWork = ns.singularity.getCurrentWork();
    if (playerWork && playerWork.type === "FACTION") {
        // Le sleeve aide le joueur
        // Note: Les sleeves ne peuvent faire que "Field Work", "Security Work", "Hacking Contracts"
        return { type: "faction", faction: playerWork.factionName, workType: "Field Work" };
    }

    // Priorité 5: Actions variées selon l'index
    switch (sleeveIndex % 4) {
        case 0:
            // Crime pour l'argent
            return { type: "crime", crime: "Homicide" };
        case 1:
            // Étudier pour le hack
            return { type: "class", university: "Rothman University", className: "Study Computer Science" };
        case 2:
            // Gym pour le combat
            return { type: "gym", gym: "Powerhouse Gym", stat: "Strength" };
        case 3:
            // Crime alternatif
            return { type: "crime", crime: "Mug" };
        default:
            return { type: "crime", crime: "Shoplift" };
    }
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
                // Fallback si "Field Work" n'est pas dispo (ex: faction de hacking pur)
                ns.sleeve.setToFactionWork(sleeveIndex, task.faction, "Hacking Contracts");
            }
            break;
    }
}

/**
 * Acheter des augmentations pour un sleeve
 */
function buyAugmentations(ns, sleeveIndex) {
    const money = ns.getServerMoneyAvailable("home");

    try {
        const augs = ns.sleeve.getSleevePurchasableAugs(sleeveIndex);

        for (const aug of augs) {
            // Acheter si on a 10x le prix
            if (money > aug.cost * 10) {
                ns.sleeve.purchaseSleeveAug(sleeveIndex, aug.name);
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
