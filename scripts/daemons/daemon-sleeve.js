/**
 * Bitburner AI - Sleeve Daemon (Lightweight)
 * RAM: ~5GB
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    let numSleeves = 0;
    try {
        numSleeves = ns.sleeve.getNumSleeves();
    } catch (e) {
        ns.tprint("❌ Sleeve API non disponible");
        return;
    }

    if (numSleeves === 0) {
        ns.tprint("❌ Aucun sleeve");
        return;
    }

    const CONFIG = {
        shockThreshold: 50,
        syncThreshold: 95,
    };

    while (true) {
        // Lire directives
        let sleeveMode = null;
        try {
            const data = ns.read("/data/ai-directives.txt");
            if (data) sleeveMode = JSON.parse(data).sleeveMode;
        } catch (e) { }

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  👥 SLEEVE DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`👥 Sleeves: ${numSleeves}`);
        ns.print(`📋 Mode: ${sleeveMode || "auto"}`);
        ns.print("");

        for (let i = 0; i < numSleeves; i++) {
            const sleeve = ns.sleeve.getSleeve(i);
            const task = ns.sleeve.getTask(i);

            ns.print(`🧬 Sleeve ${i}: Shock ${sleeve.shock.toFixed(0)}% | Sync ${sleeve.sync.toFixed(0)}%`);
            if (task) ns.print(`   Task: ${formatTask(task)}`);

            // Déterminer la tâche optimale
            let newTask = null;

            if (sleeve.shock > CONFIG.shockThreshold) {
                newTask = { type: "recovery" };
            } else if (sleeve.sync < CONFIG.syncThreshold) {
                newTask = { type: "sync" };
            } else if (sleeveMode === "training") {
                newTask = i % 2 === 0 ?
                    { type: "class", uni: "Rothman University", course: "Study Computer Science" } :
                    { type: "gym", gym: "Powerhouse Gym", stat: "Strength" };
            } else if (sleeveMode === "crime") {
                newTask = { type: "crime", crime: "Homicide" };
            } else if (sleeveMode === "faction") {
                try {
                    const work = ns.singularity.getCurrentWork();
                    if (work && work.type === "FACTION") {
                        newTask = { type: "faction", faction: work.factionName };
                    }
                } catch (e) { }
                if (!newTask) newTask = { type: "crime", crime: "Mug" };
            } else {
                // Auto: rotation
                switch (i % 4) {
                    case 0: newTask = { type: "crime", crime: "Homicide" }; break;
                    case 1: newTask = { type: "class", uni: "Rothman University", course: "Study Computer Science" }; break;
                    case 2: newTask = { type: "gym", gym: "Powerhouse Gym", stat: "Strength" }; break;
                    case 3: newTask = { type: "crime", crime: "Mug" }; break;
                }
            }

            // Appliquer
            applyTask(ns, i, newTask);

            // Acheter augs
            buyAugs(ns, i);
        }

        await ns.sleep(30000);
    }
}

function applyTask(ns, idx, task) {
    if (!task) return;
    try {
        switch (task.type) {
            case "recovery":
                ns.sleeve.setToShockRecovery(idx);
                break;
            case "sync":
                ns.sleeve.setToSynchronize(idx);
                break;
            case "crime":
                ns.sleeve.setToCommitCrime(idx, task.crime);
                break;
            case "class":
                ns.sleeve.setToUniversityCourse(idx, task.uni, task.course);
                break;
            case "gym":
                ns.sleeve.setToGymWorkout(idx, task.gym, task.stat);
                break;
            case "faction":
                try {
                    ns.sleeve.setToFactionWork(idx, task.faction, "Field Work");
                } catch (e) {
                    ns.sleeve.setToFactionWork(idx, task.faction, "Hacking Contracts");
                }
                break;
        }
    } catch (e) { }
}

function buyAugs(ns, idx) {
    const money = ns.getServerMoneyAvailable("home");
    if (money < 1e9) return;

    try {
        const augs = ns.sleeve.getSleevePurchasableAugs(idx);
        augs.sort((a, b) => a.cost - b.cost);

        for (const aug of augs) {
            if (money > aug.cost * 5) {
                ns.sleeve.purchaseSleeveAug(idx, aug.name);
            }
        }
    } catch (e) { }
}

function formatTask(task) {
    if (!task) return "Idle";
    switch (task.type) {
        case "CRIME": return `Crime: ${task.crimeType}`;
        case "CLASS": return `Study: ${task.classType}`;
        case "GYM": return `Gym: ${task.stat}`;
        case "FACTION": return `Faction: ${task.factionName}`;
        case "SYNCHRO": return "Syncing";
        case "RECOVERY": return "Recovery";
        default: return task.type;
    }
}
