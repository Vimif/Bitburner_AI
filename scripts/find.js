/**
 * Bitburner AI - Find Server
 * Trouve le chemin vers n'importe quel serveur
 * 
 * Usage: run find.js [servername]
 * Exemple: run find.js CSEC
 */

/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0];

    if (!target) {
        ns.tprint("Usage: run find.js [servername]");
        return;
    }

    const path = findPath(ns, "home", target, []);

    if (path) {
        ns.tprint(`\n📍 Chemin vers ${target}:`);
        ns.tprint(`   ${path.join(" → ")}`);
        ns.tprint("");
        ns.tprint("📋 Commande à copier:");

        // Générer la commande connect
        let cmd = path.slice(1).map(s => `connect ${s}`).join("; ");
        ns.tprint(`   ${cmd}`);
    } else {
        ns.tprint(`❌ Serveur "${target}" non trouvé`);
    }
}

function findPath(ns, current, target, visited) {
    if (current === target) return [current];
    if (visited.includes(current)) return null;

    visited.push(current);

    for (const neighbor of ns.scan(current)) {
        const path = findPath(ns, neighbor, target, visited);
        if (path) return [current, ...path];
    }

    return null;
}
