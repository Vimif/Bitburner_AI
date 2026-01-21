/**
 * Bitburner AI - Weaken Worker
 * Script minimal pour réduire la sécurité
 * RAM: ~1.75 GB
 * 
 * Usage: run weaken.js [target] [delay]
 */

/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0];
    const delay = ns.args[1] || 0;

    if (delay > 0) {
        await ns.sleep(delay);
    }

    await ns.weaken(target);
}
