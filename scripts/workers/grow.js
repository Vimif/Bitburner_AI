/**
 * Bitburner AI - Grow Worker
 * Script minimal pour augmenter l'argent
 * RAM: ~1.75 GB
 * 
 * Usage: run grow.js [target] [delay]
 */

/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0];
    const delay = ns.args[1] || 0;

    if (delay > 0) {
        await ns.sleep(delay);
    }

    await ns.grow(target);
}
