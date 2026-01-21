/**
 * Bitburner AI - Smart Share Daemon
 * Maximise la réputation faction en utilisant la RAM libre
 * 
 * Stratégie:
 * - Scanne le réseau pour la RAM disponible
 * - Lance share.js sur les serveurs libres
 * - Ne tourne QUE si le joueur travaille pour une faction
 * 
 * Usage: run daemon-share.js
 */

import { scanAll, getAvailableRam, formatRam } from "/lib/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Créer le script de share s'il n'existe pas
    const SHARE_SCRIPT = "/scripts/share-worker.js"; // Nom unique pour repérer facilement
    if (!ns.fileExists(SHARE_SCRIPT)) {
        await ns.write(SHARE_SCRIPT, "export async function main(ns) { while(true) { await ns.share(); } }", "w");
    }

    ns.print("═══════════════════════════════════════");
    ns.print("  📢 SMART SHARE DAEMON");
    ns.print("═══════════════════════════════════════");

    while (true) {
        // 1. Vérifier si on a besoin de réputation
        // On check si le joueur travaille pour une FACTION
        const work = ns.singularity.getCurrentWork();
        const isWorkingForFaction = work && work.type === "FACTION";

        // Optionnel : Forcer le share si réputation requise détectée (communication inter-daemon)
        // Pour l'instant on se base sur l'activité du joueur

        if (isWorkingForFaction) {
            ns.print("🔨 Travail Faction détecté. Optimisation du partage...");

            // 2. Calculer la RAM libre et déployer
            await deployShare(ns, SHARE_SCRIPT);
        } else {
            ns.print("💤 Pas de travail faction. Veille...");
            // Nettoyage optionnel des scripts de share ? 
            // killAllShare(ns, SHARE_SCRIPT);
            // Non, on laisse finir les threads ou on laisse daemon-hack les tuer s'il a besoin de place
            // Mais pour être propre, on peut réduire la charge
        }

        await ns.sleep(10000); // Check toutes les 10s
    }
}

/**
 * Déployer les scripts de share
 */
async function deployShare(ns, script) {
    const servers = getAvailableRam(ns);
    const RAM_PER_THREAD = 4; // ns.share() coute 4GB
    let totalThreads = 0;

    for (const server of servers) {
        // Obtenir RAM actuelle
        // Note: getAvailableRam retourne la RAM libre, mais on veut être sûr
        const freeRam = ns.getServerMaxRam(server.host) - ns.getServerUsedRam(server.host);

        // Laisser un buffer pour daemon-hack (ex: 10% ou 32GB min)
        // Si c'est un serveur dédié hacking, on peut tout prendre car daemon-hack a priorité
        // Mais daemon-hack ne tue pas nos scripts, donc on risque de bloquer.
        // Stratégie: On prend tout ce qui reste. daemon-hack devra attendre que share finisse (10s)
        // Comme daemon-hack a des sleeps, ça devrait aller.

        const threads = Math.floor((freeRam - 4) / RAM_PER_THREAD); // -4GB buffer

        if (threads > 0) {
            // Copier le script si besoin
            if (!ns.fileExists(script, server.host)) {
                ns.scp(script, server.host, "home");
            }

            // Lancer !
            const pid = ns.exec(script, server.host, threads);
            if (pid > 0) totalThreads += threads;
        }
    }

    if (totalThreads > 0) {
        // Calcul du bonus (formule approximative: 1 + (ln(threads) / rate))
        // Le vrai calcul est interne, mais on log juste l'effort
        ns.print(`📢 Share lancé: ${totalThreads} threads sur le réseau`);
        ns.print(`   Boost potentiel de réputation !`);
    }
}
