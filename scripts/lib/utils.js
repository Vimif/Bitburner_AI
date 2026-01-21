/**
 * Bitburner AI - Utility Functions
 * Fonctions utilitaires partagées par tous les scripts
 */

import { CRACK_PROGRAMS, IGNORED_SERVERS } from "./constants.js";

/**
 * Scanner récursivement tous les serveurs du réseau
 * @param {NS} ns
 * @returns {string[]} Liste de tous les hostnames
 */
export function scanAll(ns) {
    const servers = new Set();
    const queue = ["home"];

    while (queue.length > 0) {
        const current = queue.shift();
        if (servers.has(current)) continue;

        servers.add(current);
        const neighbors = ns.scan(current);

        for (const neighbor of neighbors) {
            if (!servers.has(neighbor)) {
                queue.push(neighbor);
            }
        }
    }

    return Array.from(servers);
}

/**
 * Trouver le chemin vers un serveur
 * @param {NS} ns
 * @param {string} target
 * @returns {string[]} Liste des serveurs à traverser
 */
export function findPath(ns, target) {
    const queue = [["home"]];
    const visited = new Set(["home"]);

    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];

        if (current === target) return path;

        const neighbors = ns.scan(current);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                const newPath = [...path, neighbor];
                queue.push(newPath);
            }
        }
    }
    return [];
}

/**
 * Obtenir des informations détaillées sur un serveur
 * @param {NS} ns
 * @param {string} host
 * @returns {object} Informations du serveur
 */
export function getServerInfo(ns, host) {
    return {
        hostname: host,
        hasRoot: ns.hasRootAccess(host),
        hackLevel: ns.getServerRequiredHackingLevel(host),
        portsRequired: ns.getServerNumPortsRequired(host),
        maxMoney: ns.getServerMaxMoney(host),
        currentMoney: ns.getServerMoneyAvailable(host),
        minSecurity: ns.getServerMinSecurityLevel(host),
        currentSecurity: ns.getServerSecurityLevel(host),
        maxRam: ns.getServerMaxRam(host),
        usedRam: ns.getServerUsedRam(host),
        freeRam: ns.getServerMaxRam(host) - ns.getServerUsedRam(host),
        growthFactor: ns.getServerGrowth(host),
    };
}

/**
 * Vérifier si on peut hacker un serveur
 * @param {NS} ns
 * @param {string} host
 * @returns {boolean}
 */
export function canHack(ns, host) {
    if (IGNORED_SERVERS.includes(host)) return false;
    if (!ns.hasRootAccess(host)) return false;
    if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) return false;
    if (ns.getServerMaxMoney(host) <= 0) return false;
    return true;
}

/**
 * Tenter d'obtenir l'accès root sur un serveur
 * @param {NS} ns
 * @param {string} host
 * @returns {boolean} True si root obtenu
 */
export function getRootAccess(ns, host) {
    if (ns.hasRootAccess(host)) return true;

    // Compter les ports qu'on peut ouvrir
    let portsOpened = 0;

    for (const program of CRACK_PROGRAMS) {
        if (ns.fileExists(program.name, "home")) {
            try {
                ns[program.fn](host);
                portsOpened++;
            } catch (e) {
                // Le programme peut échouer si le port est déjà ouvert
            }
        }
    }

    // Tenter le NUKE si on a assez de ports
    const portsRequired = ns.getServerNumPortsRequired(host);
    if (portsOpened >= portsRequired) {
        try {
            ns.nuke(host);
            return ns.hasRootAccess(host);
        } catch (e) {
            return false;
        }
    }

    return false;
}

/**
 * Calculer le score d'une cible pour le hacking
 * @param {NS} ns
 * @param {string} host
 * @returns {number} Score (plus haut = meilleur)
 */
export function getTargetScore(ns, host) {
    const maxMoney = ns.getServerMaxMoney(host);
    const hackTime = ns.getHackTime(host);
    const hackChance = ns.hackAnalyzeChance(host);
    const security = ns.getServerSecurityLevel(host);

    if (maxMoney <= 0 || hackTime <= 0) return 0;

    // Score = (argent * chance) / (temps * sécurité)
    return (maxMoney * hackChance) / (hackTime * security);
}

/**
 * Trouver la meilleure cible pour le hacking
 * @param {NS} ns
 * @returns {string|null} Hostname de la meilleure cible
 */
export function getBestTarget(ns) {
    const servers = scanAll(ns);
    let bestTarget = null;
    let bestScore = 0;

    for (const host of servers) {
        if (!canHack(ns, host)) continue;

        const score = getTargetScore(ns, host);
        if (score > bestScore) {
            bestScore = score;
            bestTarget = host;
        }
    }

    return bestTarget;
}

/**
 * Obtenir tous les serveurs avec de la RAM disponible
 * @param {NS} ns
 * @returns {object[]} Liste des serveurs avec leur RAM libre
 */
export function getAvailableRam(ns) {
    const servers = scanAll(ns);
    const result = [];

    for (const host of servers) {
        if (!ns.hasRootAccess(host)) continue;

        const maxRam = ns.getServerMaxRam(host);
        const usedRam = ns.getServerUsedRam(host);
        const freeRam = maxRam - usedRam;

        if (freeRam > 0) {
            result.push({ host, freeRam, maxRam });
        }
    }

    // Trier par RAM disponible (plus grand d'abord)
    result.sort((a, b) => b.freeRam - a.freeRam);

    return result;
}

/**
 * Calculer la RAM totale disponible sur le réseau
 * @param {NS} ns
 * @returns {number} RAM totale en GB
 */
export function getTotalFreeRam(ns) {
    const servers = getAvailableRam(ns);
    return servers.reduce((total, s) => total + s.freeRam, 0);
}

/**
 * Formater un nombre en argent lisible
 * @param {number} n
 * @returns {string}
 */
export function formatMoney(n) {
    if (n >= 1e15) return `$${(n / 1e15).toFixed(2)}q`;
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}t`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}b`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}m`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}k`;
    return `$${n.toFixed(2)}`;
}

/**
 * Formater un temps en millisecondes en format lisible
 * @param {number} ms
 * @returns {string}
 */
export function formatTime(ms) {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Formater la RAM en format lisible
 * @param {number} gb
 * @returns {string}
 */
export function formatRam(gb) {
    if (gb >= 1024) return `${(gb / 1024).toFixed(1)}TB`;
    return `${gb.toFixed(1)}GB`;
}

/**
 * Attendre un certain temps
 * @param {number} ms Millisecondes
 * @returns {Promise}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
