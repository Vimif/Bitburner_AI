/**
 * Bitburner AI - Gang Daemon (Lightweight)
 * RAM: ~5GB
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier gang
    try {
        if (!ns.gang.inGang()) {
            ns.tprint("❌ Pas dans un gang");
            return;
        }
    } catch (e) {
        ns.tprint("❌ Gang API non disponible");
        return;
    }

    const CONFIG = {
        ascensionThreshold: 1.5,
        wantedPenaltyThreshold: 0.9,
        respectForMoney: 5000,
        territoryWinChance: 0.65,
    };

    while (true) {
        const info = ns.gang.getGangInformation();
        const members = ns.gang.getMemberNames();

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🔫 GANG DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Income: ${formatMoney(info.moneyGainRate * 5)}/sec`);
        ns.print(`⭐ Respect: ${formatNum(info.respect)}`);
        ns.print(`💪 Pouvoir: ${info.power.toFixed(0)}`);
        ns.print(`🏴 Territoire: ${(info.territory * 100).toFixed(1)}%`);
        ns.print(`👥 Membres: ${members.length}/12`);
        ns.print(`⚔️ Guerre: ${info.territoryWarfareEngaged ? "ON" : "OFF"}`);
        ns.print("");

        // Recruter
        while (ns.gang.canRecruitMember()) {
            const name = `Member-${members.length}`;
            if (ns.gang.recruitMember(name)) {
                ns.toast(`Recruté: ${name}`, "success");
            }
        }

        // Gérer les membres
        const updatedMembers = ns.gang.getMemberNames();

        for (const member of updatedMembers) {
            // Ascension
            const result = ns.gang.getAscensionResult(member);
            if (result) {
                const mainGain = info.isHacking ? result.hack : result.str;
                if (mainGain >= CONFIG.ascensionThreshold) {
                    ns.gang.ascendMember(member);
                    ns.print(`🆙 Ascension: ${member}`);
                }
            }

            // Task
            const task = findOptimalTask(ns, member, info, CONFIG);
            const memberInfo = ns.gang.getMemberInformation(member);
            if (memberInfo.task !== task) {
                ns.gang.setMemberTask(member, task);
            }
        }

        // Afficher membres
        ns.print("👥 Membres:");
        for (const m of updatedMembers.slice(0, 6)) {
            const mInfo = ns.gang.getMemberInformation(m);
            ns.print(`   ${m}: ${mInfo.task}`);
        }
        if (updatedMembers.length > 6) {
            ns.print(`   ... +${updatedMembers.length - 6} autres`);
        }

        // Guerre de territoire
        manageWar(ns, info, CONFIG);

        // Équipement
        buyEquipment(ns, updatedMembers, info);

        await ns.sleep(10000);
    }
}

function findOptimalTask(ns, member, gangInfo, config) {
    // Wanted penalty
    if (gangInfo.wantedPenalty < config.wantedPenaltyThreshold && gangInfo.wantedLevel > 1) {
        return "Vigilante Justice";
    }

    // Guerre active
    if (gangInfo.territoryWarfareEngaged && gangInfo.territory < 1) {
        return "Territory Warfare";
    }

    // Peu de respect
    if (gangInfo.respect < config.respectForMoney) {
        return gangInfo.isHacking ? "Ransomware" : "Mug People";
    }

    // Money
    return gangInfo.isHacking ? "Money Laundering" : "Human Trafficking";
}

function manageWar(ns, info, config) {
    if (info.territory >= 1) return;

    let minChance = 1;
    try {
        const others = ns.gang.getOtherGangInformation();
        for (const [gang, data] of Object.entries(others)) {
            if (data.territory > 0) {
                minChance = Math.min(minChance, ns.gang.getChanceToWinClash(gang));
            }
        }
    } catch (e) { }

    if (info.territoryWarfareEngaged && minChance < 0.5) {
        ns.gang.setTerritoryWarfare(false);
    } else if (!info.territoryWarfareEngaged && minChance >= config.territoryWinChance) {
        ns.gang.setTerritoryWarfare(true);
        ns.toast("Guerre activée!", "warning");
    }
}

function buyEquipment(ns, members, gangInfo) {
    const money = ns.getServerMoneyAvailable("home");
    if (money < 1e9) return;

    const equipment = ns.gang.getEquipmentNames();

    for (const member of members) {
        const mInfo = ns.gang.getMemberInformation(member);
        const owned = [...mInfo.upgrades, ...mInfo.augmentations];

        for (const eq of equipment) {
            if (owned.includes(eq)) continue;
            const cost = ns.gang.getEquipmentCost(eq);
            if (money > cost * 10) {
                ns.gang.purchaseEquipment(member, eq);
            }
        }
    }
}

function formatMoney(n) {
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "k";
    return "$" + n.toFixed(0);
}

function formatNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
