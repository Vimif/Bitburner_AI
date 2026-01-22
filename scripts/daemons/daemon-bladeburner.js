/**
 * Bitburner AI - Bladeburner Daemon v2.0
 * Automatisation avancée des opérations Bladeburner
 * 
 * Améliorations v2.0:
 * - Intégration brain-state
 * - Gestion intelligente du chaos par ville
 * - Skill prioritization optimisée
 * - BlackOps automation
 * - Stamina management amélioré
 * 
 * Nécessite: Accès Bladeburner (BitNode 6/7 ou Source-File)
 * 
 * Usage: run daemon-bladeburner.js
 */

import { getState, sendFeedback } from "../lib/brain-state.js";

// Configuration
const CONFIG = {
    minStaminaPercent: 0.5,     // Repos si stamina < 50%
    minSuccessChance: 0.7,       // Minimum 70% pour contracts
    opSuccessChance: 0.85,       // Minimum 85% pour opérations
    blackOpSuccessChance: 0.95,  // Minimum 95% pour BlackOps
    chaosThreshold: 50,          // Changer de ville si chaos > 50
    skillBuffer: 2,              // Acheter skill si on a 2x le coût
};

// Priorité des skills
const SKILL_PRIORITY = [
    "Blade's Intuition",      // Success chance
    "Overclock",              // Speed
    "Digital Observer",       // Intel
    "Cloak",                  // Stealth
    "Reaper",                 // Damage
    "Evasive System",         // Defense
    "Short-Circuit",          // Crowd control
    "Tracer",                 // Tracking
    "Hyperdrive",             // Speed bonus
];

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

    // Rejoindre si pas encore fait
    if (!ns.bladeburner.inBladeburner()) {
        if (!ns.bladeburner.joinBladeburnerDivision()) {
            ns.tprint("❌ Impossible de rejoindre Bladeburner.");
            ns.tprint("   Stats de combat trop bas?");
            return;
        }
    }

    let lastFeedbackTime = 0;

    while (true) {
        const stamina = ns.bladeburner.getStamina();
        const staminaPercent = stamina[0] / stamina[1];
        const rank = ns.bladeburner.getRank();
        const skillPoints = ns.bladeburner.getSkillPoints();
        const currentCity = ns.bladeburner.getCity();
        const chaos = ns.bladeburner.getCityChaos(currentCity);

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  ⚔️ BLADEBURNER DAEMON v2.0");
        ns.print("═══════════════════════════════════════");
        ns.print(`🎖️ Rang: ${formatNumber(rank)}`);
        ns.print(`⚡ Stamina: ${(staminaPercent * 100).toFixed(0)}%`);
        ns.print(`💠 Skill Points: ${skillPoints}`);
        ns.print(`🏙️ Ville: ${currentCity} (Chaos: ${chaos.toFixed(1)})`);
        ns.print("");

        // Afficher l'action en cours
        const currentAction = ns.bladeburner.getCurrentAction();
        if (currentAction && currentAction.type !== "Idle") {
            const remaining = ns.bladeburner.getActionTime(currentAction.type, currentAction.name) -
                ns.bladeburner.getActionCurrentTime();
            ns.print(`🎯 Action: ${currentAction.name}`);
            ns.print(`   Temps restant: ${(remaining / 1000).toFixed(1)}s`);
        }

        // 1. Gestion des villes (chaos)
        await manageCities(ns, currentCity, chaos);

        // 2. Upgrade les skills
        upgradeSkills(ns, skillPoints);

        // 3. Choisir et exécuter l'action optimale
        const action = chooseOptimalAction(ns, staminaPercent);
        if (action) {
            executeAction(ns, action, currentAction);
        }

        // 4. Afficher les stats
        printStats(ns);

        // 5. Feedback
        if (Date.now() - lastFeedbackTime > 30000) {
            sendFeedback(ns, "bladeburner", {
                rank,
                stamina: staminaPercent,
                chaos,
                city: currentCity,
            });
            lastFeedbackTime = Date.now();
        }

        await ns.sleep(5000);
    }
}

/**
 * Gérer le changement de ville selon le chaos
 */
async function manageCities(ns, currentCity, currentChaos) {
    if (currentChaos <= CONFIG.chaosThreshold) return;

    const cities = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];
    let bestCity = currentCity;
    let lowestChaos = currentChaos;

    for (const city of cities) {
        const chaos = ns.bladeburner.getCityChaos(city);
        const pop = ns.bladeburner.getCityEstimatedPopulation(city);

        // Préférer les villes avec peu de chaos ET assez de population
        if (chaos < lowestChaos && pop > 1e9) {
            lowestChaos = chaos;
            bestCity = city;
        }
    }

    if (bestCity !== currentCity) {
        ns.bladeburner.switchCity(bestCity);
        ns.print(`✈️ Déménagement: ${currentCity} → ${bestCity}`);
    }
}

/**
 * Upgrader les skills par priorité
 */
function upgradeSkills(ns, availablePoints) {
    for (const skillName of SKILL_PRIORITY) {
        try {
            const cost = ns.bladeburner.getSkillUpgradeCost(skillName);
            const currentLevel = ns.bladeburner.getSkillLevel(skillName);

            // Overclock a un max level de 90
            if (skillName === "Overclock" && currentLevel >= 90) continue;

            if (availablePoints >= cost * CONFIG.skillBuffer) {
                ns.bladeburner.upgradeSkill(skillName);
                ns.print(`🆙 Skill: ${skillName} → Lv${currentLevel + 1}`);
                return; // Un skill par cycle
            }
        } catch (e) { }
    }
}

/**
 * Choisir l'action optimale
 */
function chooseOptimalAction(ns, staminaPercent) {
    // Repos si stamina trop basse
    if (staminaPercent < CONFIG.minStaminaPercent) {
        return { type: "General", name: "Hyperbolic Regeneration Chamber" };
    }

    // 1. Vérifier les BlackOps disponibles
    const blackOp = findBestBlackOp(ns);
    if (blackOp) {
        return { type: "BlackOp", name: blackOp };
    }

    // 2. Vérifier les opérations
    const operation = findBestOperation(ns);
    if (operation) {
        return { type: "Operation", name: operation };
    }

    // 3. Vérifier les contrats
    const contract = findBestContract(ns);
    if (contract) {
        return { type: "Contract", name: contract };
    }

    // 4. Actions générales selon stamina
    if (staminaPercent > 0.9) {
        return { type: "General", name: "Field Analysis" };
    }

    return { type: "General", name: "Training" };
}

/**
 * Trouver le meilleur BlackOp disponible
 */
function findBestBlackOp(ns) {
    const blackOps = ns.bladeburner.getBlackOpNames();
    const myRank = ns.bladeburner.getRank();

    for (const op of blackOps) {
        const reqRank = ns.bladeburner.getBlackOpRank(op);
        if (myRank < reqRank) continue;

        // Vérifier si déjà complété (count = 0)
        try {
            const count = ns.bladeburner.getActionCountRemaining("BlackOp", op);
            if (count <= 0) continue;
        } catch (e) {
            continue;
        }

        const chance = ns.bladeburner.getActionEstimatedSuccessChance("BlackOp", op);
        const avgChance = (chance[0] + chance[1]) / 2;

        if (avgChance >= CONFIG.blackOpSuccessChance) {
            return op;
        }
    }

    return null;
}

/**
 * Trouver la meilleure opération
 */
function findBestOperation(ns) {
    const operations = [
        "Assassination",
        "Stealth Retirement Operation",
        "Raid",
        "Sting Operation",
        "Undercover Operation",
        "Investigation",
    ];

    for (const op of operations) {
        try {
            const count = ns.bladeburner.getActionCountRemaining("Operation", op);
            if (count <= 0) continue;

            const chance = ns.bladeburner.getActionEstimatedSuccessChance("Operation", op);
            const avgChance = (chance[0] + chance[1]) / 2;

            if (avgChance >= CONFIG.opSuccessChance) {
                return op;
            }
        } catch (e) { }
    }

    return null;
}

/**
 * Trouver le meilleur contrat
 */
function findBestContract(ns) {
    const contracts = ["Bounty Hunter", "Retirement", "Tracking"];

    for (const contract of contracts) {
        try {
            const count = ns.bladeburner.getActionCountRemaining("Contract", contract);
            if (count <= 0) continue;

            const chance = ns.bladeburner.getActionEstimatedSuccessChance("Contract", contract);
            const avgChance = (chance[0] + chance[1]) / 2;

            if (avgChance >= CONFIG.minSuccessChance) {
                return contract;
            }
        } catch (e) { }
    }

    return null;
}

/**
 * Exécuter une action
 */
function executeAction(ns, action, currentAction) {
    // Ne pas interrompre si c'est la même action
    if (currentAction &&
        currentAction.type === action.type &&
        currentAction.name === action.name) {
        return;
    }

    ns.bladeburner.startAction(action.type, action.name);
    ns.print(`▶️ Nouvelle action: ${action.name}`);
}

/**
 * Afficher les statistiques
 */
function printStats(ns) {
    ns.print("");
    ns.print("📊 Opérations disponibles:");

    const ops = ["Assassination", "Stealth Retirement Operation", "Raid", "Investigation"];
    for (const op of ops) {
        try {
            const count = ns.bladeburner.getActionCountRemaining("Operation", op);
            if (count <= 0) continue;

            const chance = ns.bladeburner.getActionEstimatedSuccessChance("Operation", op);
            const avgChance = (chance[0] + chance[1]) / 2;
            const icon = avgChance >= 0.85 ? "🟢" : avgChance >= 0.7 ? "🟡" : "🔴";

            ns.print(`   ${icon} ${op}: ${count}x (${(avgChance * 100).toFixed(0)}%)`);
        } catch (e) { }
    }

    ns.print("");
    ns.print("📋 Contrats:");
    const contracts = ["Bounty Hunter", "Retirement", "Tracking"];
    for (const c of contracts) {
        try {
            const count = ns.bladeburner.getActionCountRemaining("Contract", c);
            const chance = ns.bladeburner.getActionEstimatedSuccessChance("Contract", c);
            const avgChance = (chance[0] + chance[1]) / 2;
            ns.print(`   ${c}: ${count}x (${(avgChance * 100).toFixed(0)}%)`);
        } catch (e) { }
    }
}

function formatNumber(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
