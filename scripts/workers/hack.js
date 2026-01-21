/**
 * Bitburner AI - Hack Worker
 * Script minimal pour voler de l'argent
 * RAM: ~1.7 GB
 * 
 * Usage: run hack.js [target] [delay]
 */

/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0];
    const delay = ns.args[1] || 0;

    if (delay > 0) {
        await ns.sleep(delay);
    }

    await ns.hack(target);
}
