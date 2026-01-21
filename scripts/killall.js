/**
 * Bitburner AI - Kill All
 * Tue tous les scripts sur tous les serveurs
 * 
 * Usage: run killall.js
 */

/** @param {NS} ns */
export async function main(ns) {
    const visited = new Set();
    const queue = ["home"];
    let killed = 0;

    while (queue.length > 0) {
        const host = queue.shift();
        if (visited.has(host)) continue;
        visited.add(host);

        if (ns.hasRootAccess(host)) {
            const scripts = ns.ps(host);
            if (scripts.length > 0 && host !== "home") {
                ns.killall(host);
                killed += scripts.length;
            }
        }

        for (const neighbor of ns.scan(host)) {
            if (!visited.has(neighbor)) queue.push(neighbor);
        }
    }

    // Kill sur home sauf ce script
    const homeScripts = ns.ps("home");
    for (const script of homeScripts) {
        if (script.filename !== ns.getScriptName()) {
            ns.kill(script.pid);
            killed++;
        }
    }

    ns.tprint(`🔴 ${killed} scripts tués sur le réseau`);
}
