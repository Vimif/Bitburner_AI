/**
 * Bitburner AI - Stanek Manager
 * Charge automatiquement les fragments de Stanek's Gift
 * 
 * Nécessite: Stanek's Gift (Source-File 13 ou via progression)
 * 
 * Usage: run daemon-stanek.js
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier l'accès
    try {
        ns.stanek.activeFragments();
    } catch (e) {
        ns.tprint("❌ Stanek's Gift non disponible.");
        return;
    }

    ns.print("═══════════════════════════════════════");
    ns.print("  🔷 STANEK MANAGER");
    ns.print("═══════════════════════════════════════");

    while (true) {
        const fragments = ns.stanek.activeFragments();

        if (fragments.length === 0) {
            ns.print("⚠️ Aucun fragment placé.");
            await ns.sleep(60000);
            continue;
        }

        // Trouver le fragment qui a le plus besoin de charge
        // On priorise les boosters de hacking (id 1-30 souvent)
        let target = null;
        let minCharge = Infinity;

        for (const frag of fragments) {
            // On charge tous les fragments
            if (frag.numCharge < minCharge) {
                minCharge = frag.numCharge;
                target = frag;
            }
        }

        if (target) {
            ns.print(`⚡ Charge: Fragment ${target.id} (${target.x}, ${target.y}) - Charges: ${target.numCharge}`);
            // Charger pendant 10 secondes
            try {
                await ns.stanek.chargeFragment(target.x, target.y);
            } catch (e) {
                // Peut échouer si plus de RAM ou autre
            }
        }

        await ns.sleep(100);
    }
}
