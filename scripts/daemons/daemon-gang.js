/**
 * Bitburner AI - Gang Daemon v2.0
 * Gestion optimisée du gang avec timing d'ascension optimal
 * 
 * Améliorations v2.0:
 * - Seuil d'ascension à 1.5x minimum
 * - Task rotation intelligente (respect/money/territory)
 * - Intégration brain-state
 * - Power farming si win chance > 80%
 * - Equipment prioritization
 * 
 * Nécessite: Accès Gang (faction criminelle)
 * 
 * Usage: run daemon-gang.js
 */

import { getState, sendFeedback } from "../lib/brain-state.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier si on a accès au gang
    try {
        if (!ns.gang.inGang()) {
            ns.tprint("❌ Vous n'êtes pas dans un gang.");
            ns.tprint("   Rejoignez Slum Snakes, Tetrads, The Syndicate, etc.");
            return;
        }
    } catch (e) {
        ns.tprint("❌ Gang API non disponible.");
        ns.tprint("   Nécessite BitNode 2 ou Source-File 2.");
        return;
    }

    // Configuration
    const config = {
        ascensionThreshold: 1.5,       // Ascend si gain > 50%
        wantedPenaltyThreshold: 0.9,   // Vigilante si penalty < 90%
        respectForMoney: 5000,          // Switch to money après X respect
        territoryWinChance: 0.65,       // Activer guerre si > 65% chance
        equipmentBuyMultiplier: 5,      // Équipement si argent > coût * 5
    };

    const gangInfo = ns.gang.getGangInformation();
    ns.print(`🔫 Gang: ${gangInfo.faction}`);
    ns.print(`   Type: ${gangInfo.isHacking ? "Hacking" : "Combat"}`);

    let lastFeedbackTime = 0;

    while (true) {
        const info = ns.gang.getGangInformation();
        const members = ns.gang.getMemberNames();
        const state = getState(ns);

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🔫 GANG DAEMON v2.0");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Revenu: $${formatMoney(info.moneyGainRate * 5)}/sec`);
        ns.print(`⭐ Respect: ${formatMoney(info.respect)}`);
        ns.print(`💪 Pouvoir: ${info.power.toFixed(2)}`);
        ns.print(`🏴 Territoire: ${(info.territory * 100).toFixed(1)}%`);
        ns.print(`⚠️ Wanted Penalty: ${(info.wantedPenalty * 100).toFixed(1)}%`);
        ns.print(`👥 Membres: ${members.length}/12`);
        ns.print(`⚔️ Guerre: ${info.territoryWarfareEngaged ? "ON" : "OFF"}`);
        ns.print("");

        // 1. Recruter des nouveaux membres
        while (ns.gang.canRecruitMember()) {
            const name = generateMemberName(members.length);
            const success = ns.gang.recruitMember(name);
            if (success) {
                ns.print(`✅ Recruté: ${name}`);
                ns.toast(`Nouveau membre: ${name}`, "success");
            }
        }

        // 2. Gérer les ascensions (AVANT les tâches)
        const updatedMembers = ns.gang.getMemberNames();
        for (const member of updatedMembers) {
            handleAscension(ns, member, info, config);
        }

        // 3. Assigner les tâches optimales
        for (const member of updatedMembers) {
            const memberInfo = ns.gang.getMemberInformation(member);
            const optimalTask = findOptimalTask(ns, memberInfo, info, state, config);

            if (memberInfo.task !== optimalTask) {
                ns.gang.setMemberTask(member, optimalTask);
            }
        }

        // 4. Acheter l'équipement (priorisé)
        buyEquipment(ns, updatedMembers, info, config);

        // 5. Gérer les guerres de territoire
        manageTerritoryWarfare(ns, info, config);

        // Afficher les membres
        ns.print("👥 Membres:");
        for (const member of updatedMembers.slice(0, 6)) {
            const m = ns.gang.getMemberInformation(member);
            const ascResult = ns.gang.getAscensionResult(member);
            let ascText = "";
            if (ascResult) {
                const mainStat = info.isHacking ? ascResult.hack : ascResult.str;
                if (mainStat >= config.ascensionThreshold) {
                    ascText = ` [🆙 ${(mainStat * 100 - 100).toFixed(0)}%]`;
                }
            }
            ns.print(`   ${member}: ${m.task}${ascText}`);
        }
        if (updatedMembers.length > 6) {
            ns.print(`   ... et ${updatedMembers.length - 6} autres`);
        }

        // Afficher les chances de victoire
        ns.print("");
        ns.print("⚔️ Chances de victoire:");
        const otherGangs = getOtherGangs(ns);
        for (const [gang, data] of Object.entries(otherGangs)) {
            if (data.territory > 0) {
                const chance = ns.gang.getChanceToWinClash(gang);
                const icon = chance >= 0.65 ? "🟢" : chance >= 0.5 ? "🟡" : "🔴";
                ns.print(`   ${icon} ${gang}: ${(chance * 100).toFixed(0)}%`);
            }
        }

        // Feedback
        if (Date.now() - lastFeedbackTime > 30000) {
            sendFeedback(ns, "gang", {
                respect: info.respect,
                power: info.power,
                territory: info.territory,
                members: members.length,
                income: info.moneyGainRate * 5,
            });
            lastFeedbackTime = Date.now();
        }

        await ns.sleep(10000);
    }
}

/**
 * Générer un nom de membre stylé
 */
function generateMemberName(index) {
    const prefixes = ["Shadow", "Cyber", "Blade", "Ghost", "Neon", "Zero", "Hex", "Byte", "Rogue", "Omega"];
    const suffixes = ["X", "Prime", "V2", "Neo", "Zeta", "Core", "Alpha", "Beta"];

    const prefix = prefixes[index % prefixes.length];
    const suffix = suffixes[Math.floor(index / prefixes.length) % suffixes.length];

    return `${prefix}-${suffix}`;
}

/**
 * Gérer l'ascension d'un membre
 */
function handleAscension(ns, member, gangInfo, config) {
    const result = ns.gang.getAscensionResult(member);
    if (!result) return;

    // Déterminer le stat principal
    const mainStatGain = gangInfo.isHacking ? result.hack : result.str;
    const secondaryGain = gangInfo.isHacking ?
        Math.max(result.cha, result.str) :
        Math.max(result.agi, result.dex, result.def);

    // Ascend si le gain principal dépasse le seuil
    // OU si le gain combiné est significatif
    if (mainStatGain >= config.ascensionThreshold ||
        (mainStatGain >= 1.3 && secondaryGain >= 1.3)) {
        ns.gang.ascendMember(member);
        ns.print(`🆙 Ascension: ${member} (+${((mainStatGain - 1) * 100).toFixed(0)}%)`);
        ns.toast(`Ascension: ${member}`, "info");
    }
}

/**
 * Trouver la tâche optimale pour un membre
 */
function findOptimalTask(ns, member, gangInfo, state, config) {
    // 1. Si wanted penalty trop bas, nettoyer
    if (gangInfo.wantedPenalty < config.wantedPenaltyThreshold && gangInfo.wantedLevel > 1) {
        return "Vigilante Justice";
    }

    // 2. Si guerre de territoire active et on peut gagner, focus territoire
    if (gangInfo.territoryWarfareEngaged && gangInfo.territory < 1) {
        // Les membres forts font du territory warfare
        const power = gangInfo.isHacking ? member.hack : member.str;
        if (power > 100) {
            return "Territory Warfare";
        }
    }

    // 3. Si peu de respect, farm le respect
    if (gangInfo.respect < config.respectForMoney) {
        return getBestRespectTask(member, gangInfo);
    }

    // 4. Priorité globale du système
    if (state.priority === "rep" || state.priority === "gang") {
        return getBestRespectTask(member, gangInfo);
    }

    // 5. Sinon, faire de l'argent
    return getBestMoneyTask(member, gangInfo);
}

/**
 * Meilleure tâche pour le respect
 */
function getBestRespectTask(member, gangInfo) {
    if (gangInfo.isHacking) {
        if (member.hack > 500) return "Cyberterrorism";
        if (member.hack > 200) return "Money Laundering";
        if (member.hack > 50) return "Phishing";
        return "Ransomware";
    } else {
        if (member.str > 500) return "Human Trafficking";
        if (member.str > 200) return "Terrorism";
        if (member.str > 50) return "Armed Robbery";
        return "Mug People";
    }
}

/**
 * Meilleure tâche pour l'argent
 */
function getBestMoneyTask(member, gangInfo) {
    if (gangInfo.isHacking) {
        if (member.hack > 500) return "Money Laundering";
        if (member.hack > 200) return "Fraud";
        if (member.hack > 50) return "Phishing";
        return "Ransomware";
    } else {
        if (member.str > 500) return "Human Trafficking";
        if (member.str > 200) return "Armed Robbery";
        if (member.str > 50) return "Strongarm Civilians";
        return "Mug People";
    }
}

/**
 * Acheter l'équipement (priorisé par utilité)
 */
function buyEquipment(ns, members, gangInfo, config) {
    const money = ns.getServerMoneyAvailable("home");
    const equipment = ns.gang.getEquipmentNames();

    // Prioriser par type: Armes > Armures > Véhicules > Rootkits > Augmentations
    const priorityOrder = gangInfo.isHacking ?
        ["Rootkit", "Weapon", "Armor", "Vehicle", "Augmentation"] :
        ["Weapon", "Armor", "Vehicle", "Rootkit", "Augmentation"];

    // Trier l'équipement par priorité et coût
    const sortedEquip = equipment.map(e => ({
        name: e,
        cost: ns.gang.getEquipmentCost(e),
        type: ns.gang.getEquipmentType(e),
    })).sort((a, b) => {
        const aPrio = priorityOrder.indexOf(a.type);
        const bPrio = priorityOrder.indexOf(b.type);
        if (aPrio !== bPrio) return aPrio - bPrio;
        return a.cost - b.cost;
    });

    for (const member of members) {
        const memberInfo = ns.gang.getMemberInformation(member);
        const owned = [...memberInfo.upgrades, ...memberInfo.augmentations];

        for (const equip of sortedEquip) {
            if (owned.includes(equip.name)) continue;

            if (money > equip.cost * config.equipmentBuyMultiplier) {
                ns.gang.purchaseEquipment(member, equip.name);
            }
        }
    }
}

/**
 * Gérer les guerres de territoire
 */
function manageTerritoryWarfare(ns, info, config) {
    const otherGangs = getOtherGangs(ns);

    // Calculer la chance minimale contre tous les gangs avec du territoire
    let minWinChance = 1;
    let hasOpponents = false;

    for (const [gang, data] of Object.entries(otherGangs)) {
        if (data.territory > 0) {
            hasOpponents = true;
            const chance = ns.gang.getChanceToWinClash(gang);
            minWinChance = Math.min(minWinChance, chance);
        }
    }

    // Décision d'activer/désactiver la guerre
    if (info.territoryWarfareEngaged) {
        // Désactiver si on ne peut plus gagner facilement
        if (minWinChance < 0.5) {
            ns.gang.setTerritoryWarfare(false);
            ns.print("⚠️ Guerre désactivée (risque élevé)");
        }
    } else {
        // Activer si on peut gagner et qu'on n'a pas 100% du territoire
        if (hasOpponents && info.territory < 1 && minWinChance >= config.territoryWinChance) {
            ns.gang.setTerritoryWarfare(true);
            ns.print("⚔️ Guerre activée!");
            ns.toast("Guerre de territoire activée!", "warning");
        }
    }
}

/**
 * Obtenir les informations des autres gangs
 */
function getOtherGangs(ns) {
    const result = {};
    try {
        const info = ns.gang.getOtherGangInformation();
        for (const [gang, data] of Object.entries(info)) {
            result[gang] = data;
        }
    } catch (e) { }
    return result;
}

function formatMoney(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(2);
}
