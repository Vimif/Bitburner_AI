/**
 * Bitburner AI - Gang Daemon
 * Automatisation complète de la gestion de gang
 * 
 * Fonctionnalités:
 * - Recrutement automatique de membres
 * - Assignation optimale des tâches
 * - Achat d'équipement
 * - Gestion du territoire
 * - Évite les conflits perdants
 * 
 * Nécessite: Accès Gang (rejoindre une faction criminelle)
 * 
 * Usage: run daemon-gang.js
 */

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

    const gangInfo = ns.gang.getGangInformation();
    ns.print(`🔫 Gang: ${gangInfo.faction}`);
    ns.print(`   Type: ${gangInfo.isHacking ? "Hacking" : "Combat"}`);

    while (true) {
        const info = ns.gang.getGangInformation();
        const members = ns.gang.getMemberNames();

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🔫 GANG DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: $${formatMoney(info.moneyGainRate * 5)}/sec`);
        ns.print(`⭐ Respect: ${formatMoney(info.respect)}`);
        ns.print(`💪 Pouvoir: ${info.power.toFixed(2)}`);
        ns.print(`🏴 Territoire: ${(info.territory * 100).toFixed(1)}%`);
        ns.print(`👥 Membres: ${members.length}/12`);
        ns.print("");

        // 1. Recruter des nouveaux membres
        while (ns.gang.canRecruitMember()) {
            const name = `Gangster-${members.length + 1}`;
            const success = ns.gang.recruitMember(name);
            if (success) {
                ns.print(`✅ Recruté: ${name}`);
                ns.toast(`Nouveau membre: ${name}`, "success");
            }
        }

        // 2. Assigner les tâches optimales
        const tasks = ns.gang.getTaskNames();
        const updatedMembers = ns.gang.getMemberNames();

        for (const member of updatedMembers) {
            const memberInfo = ns.gang.getMemberInformation(member);
            const optimalTask = findOptimalTask(ns, memberInfo, info);

            if (memberInfo.task !== optimalTask) {
                ns.gang.setMemberTask(member, optimalTask);
            }
        }

        // 3. Acheter l'équipement
        const equipment = ns.gang.getEquipmentNames();
        for (const member of updatedMembers) {
            const memberInfo = ns.gang.getMemberInformation(member);

            for (const equip of equipment) {
                if (!memberInfo.upgrades.includes(equip) && !memberInfo.augmentations.includes(equip)) {
                    const cost = ns.gang.getEquipmentCost(equip);
                    const money = ns.getServerMoneyAvailable("home");

                    // Acheter si on a 10x le coût
                    if (money > cost * 10) {
                        ns.gang.purchaseEquipment(member, equip);
                    }
                }
            }
        }

        // 4. Gérer les guerres de territoire
        if (info.territoryWarfareEngaged) {
            // Vérifier si on peut gagner
            const otherGangs = getOtherGangs(ns);
            let canWin = true;

            for (const [gang, data] of Object.entries(otherGangs)) {
                if (data.territory > 0) {
                    const winChance = ns.gang.getChanceToWinClash(gang);
                    if (winChance < 0.55) {
                        canWin = false;
                        break;
                    }
                }
            }

            if (!canWin) {
                ns.gang.setTerritoryWarfare(false);
                ns.print("⚠️ Guerre désactivée (trop risqué)");
            }
        } else {
            // Activer si on peut gagner
            const otherGangs = getOtherGangs(ns);
            let shouldFight = true;

            for (const [gang, data] of Object.entries(otherGangs)) {
                if (data.territory > 0) {
                    const winChance = ns.gang.getChanceToWinClash(gang);
                    if (winChance < 0.6) {
                        shouldFight = false;
                        break;
                    }
                }
            }

            if (shouldFight && info.territory < 1) {
                ns.gang.setTerritoryWarfare(true);
                ns.print("⚔️ Guerre de territoire activée!");
            }
        }

        // 5. Ascension (Reset pour multiplicateurs)
        for (const member of updatedMembers) {
            const result = ns.gang.getAscensionResult(member);
            if (result) {
                // Seuil d'ascension: 1.1x (10% boost)
                const threshold = 1.1;
                let shouldAscend = false;

                if (info.isHacking) {
                    if (result.hack > threshold) shouldAscend = true;
                } else {
                    if (result.str > threshold) shouldAscend = true;
                }

                if (shouldAscend) {
                    ns.gang.ascendMember(member);
                    ns.print(`🆙 Ascension: ${member}`);
                    ns.toast(`Ascension: ${member}`, "info");
                }
            }
        }

        // Afficher les membres
        ns.print("👥 Membres:");
        for (const member of updatedMembers.slice(0, 6)) {
            const m = ns.gang.getMemberInformation(member);
            ns.print(`   ${member}: ${m.task}`);
        }
        if (updatedMembers.length > 6) {
            ns.print(`   ... et ${updatedMembers.length - 6} autres`);
        }

        await ns.sleep(10000);
    }
}

/**
 * Trouver la tâche optimale pour un membre
 */
function findOptimalTask(ns, member, gangInfo) {
    const respect = gangInfo.respect;
    const wantedLevel = gangInfo.wantedLevel;
    const wantedPenalty = gangInfo.wantedPenalty;

    // Si le wanted penalty est trop élevé, réduire
    if (wantedPenalty < 0.9 && wantedLevel > 1) {
        return "Vigilante Justice";
    }

    // Si peu de respect, farm le respect
    if (respect < 1000) {
        return gangInfo.isHacking ? "Ransomware" : "Mug People";
    }

    // Sinon, faire de l'argent
    if (member.hack > member.str) {
        // Hacking member
        if (member.hack > 500) return "Money Laundering";
        if (member.hack > 200) return "Phishing";
        return "Ransomware";
    } else {
        // Combat member
        if (member.str > 500) return "Human Trafficking";
        if (member.str > 200) return "Armed Robbery";
        return "Mug People";
    }
}

/**
 * Obtenir les informations des autres gangs
 */
function getOtherGangs(ns) {
    const gangs = {};
    const allGangs = ["Slum Snakes", "Tetrads", "The Syndicate", "The Dark Army", "Speakers for the Dead", "NiteSec", "The Black Hand"];

    for (const gang of allGangs) {
        try {
            const info = ns.gang.getOtherGangInformation();
            if (info[gang]) {
                gangs[gang] = info[gang];
            }
        } catch (e) { }
    }

    return gangs;
}

function formatMoney(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(2);
}
