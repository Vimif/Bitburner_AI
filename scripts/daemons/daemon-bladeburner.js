/**
 * Bitburner AI - Bladeburner Daemon
 * Automatisation des opérations Bladeburner
 * 
 * Fonctionnalités:
 * - Exécution automatique des actions
 * - Gestion du stamina
 * - Upgrade des skills
 * - Analyse de la population
 * 
 * Nécessite: Accès Bladeburner (BitNode 6/7 ou Source-File)
 * 
 * Usage: run daemon-bladeburner.js
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier l'accès Bladeburner
    try {
        ns.bladeburner.getCurrentAction();
    } catch (e) {
        ns.tprint("❌ Bladeburner non disponible.");
        ns.tprint("   Nécessite BitNode 6/7 ou Source-File 6/7.");
        return;
    }

    if (!ns.bladeburner.joinBladeburnerDivision()) {
        ns.tprint("❌ Impossible de rejoindre Bladeburner.");
        return;
    }

    while (true) {
        const stamina = ns.bladeburner.getStamina();
        const staminaPercent = stamina[0] / stamina[1];
        const rank = ns.bladeburner.getRank();
        const skillPoints = ns.bladeburner.getSkillPoints();

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  ⚔️ BLADEBURNER DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`🎖️ Rang: ${rank.toFixed(0)}`);
        ns.print(`⚡ Stamina: ${(staminaPercent * 100).toFixed(0)}%`);
        ns.print(`💠 Skill Points: ${skillPoints}`);
        ns.print("");

        // Afficher l'action en cours
        const currentAction = ns.bladeburner.getCurrentAction();
        if (currentAction) {
            ns.print(`🎯 Action: ${currentAction.type} - ${currentAction.name}`);
        }

        // Upgrade les skills
        upgradeSkills(ns, skillPoints);

        // Choisir l'action optimale
        const action = chooseAction(ns, staminaPercent);

        if (action) {
            const [type, name] = action;

            // Vérifier si on fait déjà cette action
            if (!currentAction || currentAction.type !== type || currentAction.name !== name) {
                ns.bladeburner.startAction(type, name);
                ns.print(`▶️ Nouvelle action: ${type} - ${name}`);
            }
        }

        // Afficher les statistiques des opérations
        ns.print("");
        ns.print("📊 Opérations disponibles:");

        const ops = ["Investigation", "Undercover Operation", "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination"];

        for (const op of ops) {
            try {
                const count = ns.bladeburner.getActionCountRemaining("Operation", op);
                const chance = ns.bladeburner.getActionEstimatedSuccessChance("Operation", op);
                const avgChance = (chance[0] + chance[1]) / 2;

                if (count > 0) {
                    ns.print(`   ${op}: ${count}x (${(avgChance * 100).toFixed(0)}%)`);
                }
            } catch (e) { }
        }

        await ns.sleep(5000);
    }
}

/**
 * Choisir l'action optimale
 */
function chooseAction(ns, staminaPercent) {
    // Si stamina faible, se reposer
    if (staminaPercent < 0.5) {
        return ["General", "Hyperbolic Regeneration Chamber"];
    }

    // Priorité aux opérations
    const operations = [
        "Assassination",
        "Stealth Retirement Operation",
        "Raid",
        "Sting Operation",
        "Undercover Operation",
        "Investigation"
    ];

    for (const op of operations) {
        try {
            const count = ns.bladeburner.getActionCountRemaining("Operation", op);
            if (count <= 0) continue;

            const chance = ns.bladeburner.getActionEstimatedSuccessChance("Operation", op);
            const avgChance = (chance[0] + chance[1]) / 2;

            // Exécuter si chance > 80%
            if (avgChance >= 0.8) {
                return ["Operation", op];
            }
        } catch (e) { }
    }

    // Sinon, faire des contrats
    const contracts = ["Bounty Hunter", "Retirement", "Tracking"];

    for (const contract of contracts) {
        try {
            const count = ns.bladeburner.getActionCountRemaining("Contract", contract);
            if (count <= 0) continue;

            const chance = ns.bladeburner.getActionEstimatedSuccessChance("Contract", contract);
            const avgChance = (chance[0] + chance[1]) / 2;

            if (avgChance >= 0.7) {
                return ["Contract", contract];
            }
        } catch (e) { }
    }

    // 0. Gérer le Chaos / Ville
    const currentCity = ns.bladeburner.getCity();
    const chaos = ns.bladeburner.getCityChaos(currentCity);

    // Si chaos > 50, on essaie de bouger
    if (chaos > 50) {
        ns.print(`⚠️ Chaos élevé (${chaos.toFixed(1)}). Recherche de déménagement...`);
        const cities = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];
        let bestCity = currentCity;
        let minChaos = chaos;

        for (const city of cities) {
            const cityChaos = ns.bladeburner.getCityChaos(city);
            if (cityChaos < minChaos) {
                minChaos = cityChaos;
                bestCity = city;
            }
        }

        if (bestCity !== currentCity) {
            ns.bladeburner.switchCity(bestCity);
            ns.print(`✈️ Déménagement: ${currentCity} -> ${bestCity}`);
            return; // On attend le prochain tick
        }
    }

    // 1. BlackOps (Priorité Absolue si faisable > 90%)
    // Nécessite un rang suffisant
    const blackOps = ns.bladeburner.getBlackOpNames();
    for (const op of blackOps) {
        // Vérifier si déjà complété (rank required augmentera si complété ?)
        // L'API ne dit pas explicitement "completed", mais si on a le rank requis et qu'on peut le faire...
        // Astuce: getBlackOpRank(op) > rank actuel = on ne peut pas le faire
        // Si on peut le faire, on check la success chance

        const reqRank = ns.bladeburner.getBlackOpRank(op);
        const myRank = ns.bladeburner.getRank();

        if (myRank >= reqRank) {
            // Vérifier si l'opération est disponible (pas encore complétée)
            if (ns.bladeburner.getActionCountRemaining("BlackOp", op) < 1) continue;

            // Check si déjà fait ? (action count remaining = 1 pour les blackops ?)
            // getActionCountRemaining ne marche pas pour BlackOps.
            // On tente d'analyser la chance. Si chance === 0 ou "fail", c'est peut-être déjà fait ou infaisable.
            // Mais généralement les blackops disparaissent de la liste ou restent mais ne sont plus "current".
            // En fait, on check juste le premier de la liste qui est faisable.

            // Note: Simplification -> On tente le dernier débloqué
            // Mais comment savoir lequel est le "prochain" ?
            // L'API retourne tous les noms. Le prochain executable est celui dont le rank <= myRank
            // et qui n'est pas encore fait.
            // Malheureusement l'API ns.bladeburner ne donne pas "isCompleted".
            // On itère et on check success chance.

            // Pour simplifier: Faire le BlackOp si success > 90%
            const chance = ns.bladeburner.getActionEstimatedSuccessChance("BlackOp", op);
            const avgChance = (chance[0] + chance[1]) / 2;

            if (avgChance >= 0.9) {
                return ["BlackOp", op];
                // Si c'est déjà fait, startAction retournera false ou avertissement, pas grave.
                // Mieux: On check si on le fait déjà
            }
        }
    }

    // Par défaut, s'entraîner
    if (staminaPercent > 0.8) {
        return ["General", "Field Analysis"];
    }

    return ["General", "Training"];
}

/**
 * Upgrader les skills
 */
function upgradeSkills(ns, skillPoints) {
    // Priorité des skills
    const skills = [
        { name: "Blade's Intuition", priority: 1 },
        { name: "Overclock", priority: 2 },
        { name: "Digital Observer", priority: 3 },
        { name: "Tracer", priority: 4 },
        { name: "Reaper", priority: 5 },
        { name: "Evasive System", priority: 6 },
    ];

    for (const skill of skills) {
        try {
            const cost = ns.bladeburner.getSkillUpgradeCost(skill.name);
            if (skillPoints >= cost * 2) {
                ns.bladeburner.upgradeSkill(skill.name);
            }
        } catch (e) { }
    }
}
