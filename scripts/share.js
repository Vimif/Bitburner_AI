/**
 * Bitburner AI - Share Script
 * Partage la RAM pour augmenter la réputation des factions
 * 
 * Ce script utilise share() pour booster le gain de réputation
 * quand vous travaillez pour une faction.
 * 
 * Usage: run share.js [threads]
 * Exemple: run share.js 100
 */

/** @param {NS} ns */
export async function main(ns) {
    while (true) {
        await ns.share();
    }
}
