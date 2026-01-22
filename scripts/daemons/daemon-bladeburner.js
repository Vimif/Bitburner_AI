/**
 * Bitburner AI - Bladeburner Daemon (Lightweight)
 * RAM: ~5GB
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    try {
        ns.bladeburner.getCurrentAction();
    } catch (e) {
        ns.tprint("❌ Bladeburner API non disponible");
        return;
    }

    if (!ns.bladeburner.inBladeburner()) {
        if (!ns.bladeburner.joinBladeburnerDivision()) {
            ns.tprint("❌ Impossible de rejoindre Bladeburner");
            return;
        }
    }

    const SKILLS = ["Blade's Intuition", "Overclock", "Digital Observer", "Cloak", "Reaper"];

    while (true) {
        const stamina = ns.bladeburner.getStamina();
        const staminaPct = stamina[0] / stamina[1];
        const rank = ns.bladeburner.getRank();
        const sp = ns.bladeburner.getSkillPoints();
        const city = ns.bladeburner.getCity();
        const chaos = ns.bladeburner.getCityChaos(city);

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  ⚔️ BLADEBURNER DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`🎖️ Rang: ${formatNum(rank)}`);
        ns.print(`⚡ Stamina: ${(staminaPct * 100).toFixed(0)}%`);
        ns.print(`💠 SP: ${sp}`);
        ns.print(`🏙️ ${city} (Chaos: ${chaos.toFixed(1)})`);
        ns.print("");

        // Gestion ville
        if (chaos > 50) {
            const cities = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];
            let best = city, minChaos = chaos;
            for (const c of cities) {
                const ch = ns.bladeburner.getCityChaos(c);
                if (ch < minChaos) { minChaos = ch; best = c; }
            }
            if (best !== city) {
                ns.bladeburner.switchCity(best);
                ns.print(`✈️ → ${best}`);
            }
        }

        // Skills
        for (const skill of SKILLS) {
            try {
                const cost = ns.bladeburner.getSkillUpgradeCost(skill);
                if (sp >= cost * 2) {
                    ns.bladeburner.upgradeSkill(skill);
                    ns.print(`🆙 ${skill}`);
                    break;
                }
            } catch (e) { }
        }

        // Action
        let action = null;

        if (staminaPct < 0.5) {
            action = { type: "General", name: "Hyperbolic Regeneration Chamber" };
        } else {
            // Chercher opération/contrat avec bonne chance
            const ops = ["Assassination", "Raid", "Stealth Retirement Operation"];
            for (const op of ops) {
                try {
                    const count = ns.bladeburner.getActionCountRemaining("Operation", op);
                    if (count <= 0) continue;
                    const [min, max] = ns.bladeburner.getActionEstimatedSuccessChance("Operation", op);
                    if ((min + max) / 2 >= 0.8) {
                        action = { type: "Operation", name: op };
                        break;
                    }
                } catch (e) { }
            }

            if (!action) {
                const contracts = ["Bounty Hunter", "Retirement", "Tracking"];
                for (const c of contracts) {
                    try {
                        const count = ns.bladeburner.getActionCountRemaining("Contract", c);
                        if (count <= 0) continue;
                        const [min, max] = ns.bladeburner.getActionEstimatedSuccessChance("Contract", c);
                        if ((min + max) / 2 >= 0.7) {
                            action = { type: "Contract", name: c };
                            break;
                        }
                    } catch (e) { }
                }
            }

            if (!action) {
                action = { type: "General", name: "Training" };
            }
        }

        // Exécuter
        const current = ns.bladeburner.getCurrentAction();
        if (!current || current.type !== action.type || current.name !== action.name) {
            ns.bladeburner.startAction(action.type, action.name);
            ns.print(`▶️ ${action.name}`);
        } else {
            ns.print(`🔄 ${action.name}`);
        }

        await ns.sleep(5000);
    }
}

function formatNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
