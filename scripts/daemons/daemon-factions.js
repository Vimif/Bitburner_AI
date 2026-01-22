/**
 * Bitburner AI - Factions Daemon (Lightweight)
 * RAM: ~8GB (Singularity API)
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    try {
        ns.singularity.getOwnedAugmentations();
    } catch (e) {
        ns.tprint("❌ Singularity API non disponible");
        return;
    }

    let augsBought = 0;

    while (true) {
        const money = ns.getServerMoneyAvailable("home");

        // Rejoindre invitations
        for (const f of ns.singularity.checkFactionInvitations()) {
            ns.singularity.joinFaction(f);
            ns.toast(`Rejoint ${f}`, "success");
        }

        const factions = ns.getPlayer().factions;
        const owned = ns.singularity.getOwnedAugmentations(true);
        const installed = ns.singularity.getOwnedAugmentations(false);

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🧬 FACTIONS DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: ${formatMoney(money)}`);
        ns.print(`🏛️ Factions: ${factions.length}`);
        ns.print(`🧬 Augs: ${installed.length} (+${owned.length - installed.length} pending)`);
        ns.print("");

        // Trouver les meilleures augmentations
        const available = [];

        for (const faction of factions) {
            try {
                const rep = ns.singularity.getFactionRep(faction);
                const augs = ns.singularity.getAugmentationsFromFaction(faction);

                for (const aug of augs) {
                    if (aug === "NeuroFlux Governor") continue;
                    if (owned.includes(aug)) continue;

                    const prereqs = ns.singularity.getAugmentationPrereq(aug);
                    if (prereqs.some(p => !owned.includes(p))) continue;

                    const cost = ns.singularity.getAugmentationPrice(aug);
                    const reqRep = ns.singularity.getAugmentationRepReq(aug);
                    const hasRep = rep >= reqRep;

                    available.push({ name: aug, faction, cost, hasRep, reqRep, rep });
                }
            } catch (e) { }
        }

        // Trier: d'abord ceux qu'on peut acheter
        available.sort((a, b) => {
            if (a.hasRep !== b.hasRep) return a.hasRep ? -1 : 1;
            return a.cost - b.cost;
        });

        // Acheter
        for (const aug of available) {
            if (!aug.hasRep) continue;
            if (money < aug.cost) continue;

            if (ns.singularity.purchaseAugmentation(aug.faction, aug.name)) {
                ns.print(`🧬 ACHETÉ: ${aug.name}`);
                ns.toast(`Acheté ${aug.name}`, "success");
                augsBought++;
            }
        }

        // NeuroFlux si beaucoup d'argent
        if (money > 50e9) {
            for (const f of factions) {
                try {
                    if (ns.singularity.purchaseAugmentation(f, "NeuroFlux Governor")) {
                        ns.print("🧠 NeuroFlux Governor!");
                        augsBought++;
                        break;
                    }
                } catch (e) { }
            }
        }

        // Afficher meilleures
        ns.print("🎯 Augs disponibles:");
        for (const aug of available.slice(0, 5)) {
            const status = aug.hasRep ? "✅" : `❌ ${formatNum(aug.reqRep - aug.rep)} rep`;
            ns.print(`   ${aug.name}`);
            ns.print(`      ${status} | ${formatMoney(aug.cost)}`);
        }

        // Warning pending
        if (owned.length - installed.length >= 5) {
            ns.print("");
            ns.print("⚠️ Installez vos augmentations!");
        }

        await ns.sleep(60000);
    }
}

function formatMoney(n) {
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "m";
    return "$" + n.toFixed(0);
}

function formatNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
