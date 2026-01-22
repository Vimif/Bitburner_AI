/**
 * Bitburner AI - Utility Functions v2.0
 * Fonctions utilitaires partagées par tous les scripts
 * 
 * Améliorations v2.0:
 * - Cache pour scanAll avec TTL
 * - Score de cible avancé avec préparation
 * - Fonctions d'aide supplémentaires
 */

import { CRACK_PROGRAMS, IGNORED_SERVERS } from "./constants.js";

// Cache pour scanAll (performance)
let serverCache = { data: [], timestamp: 0 };
const CACHE_TTL = 10000; // 10 secondes

/**
 * Scanner récursivement tous les serveurs du réseau (avec cache)
 * @param {NS} ns
 * @param {boolean} useCache - Utiliser le cache (default: true)
 * @returns {string[]} Liste de tous les hostnames
 */
export function scanAll(ns, useCache = true) {
    // Vérifier le cache
    if (useCache && Date.now() - serverCache.timestamp < CACHE_TTL) {
        return serverCache.data;
    }

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

    const result = Array.from(servers);

    // Mettre en cache
    serverCache.data = result;
    serverCache.timestamp = Date.now();

    return result;
}

/**
 * Invalider le cache des serveurs
 */
export function invalidateServerCache() {
    serverCache.timestamp = 0;
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
 * Calculer le score d'une cible pour le hacking (version simple)
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
 * Calculer le score avancé d'une cible (avec préparation)
 * @param {NS} ns
 * @param {string} host
 * @returns {number} Score ajusté
 */
export function getTargetScoreAdvanced(ns, host) {
    const maxMoney = ns.getServerMaxMoney(host);
    const hackTime = ns.getHackTime(host);
    const hackChance = ns.hackAnalyzeChance(host);
    const security = ns.getServerSecurityLevel(host);
    const minSec = ns.getServerMinSecurityLevel(host);
    const money = ns.getServerMoneyAvailable(host);

    if (maxMoney <= 0 || hackTime <= 0) return 0;

    // Pénalités pour serveurs non préparés
    const securityPenalty = 1 + (security - minSec) * 0.15;
    const moneyPenalty = 1 + (1 - money / maxMoney) * 0.3;

    // Bonus pour serveurs déjà préparés
    const isPrepared = security <= minSec + 5 && money >= maxMoney * 0.75;
    const prepBonus = isPrepared ? 2 : 1;

    return (maxMoney * hackChance * prepBonus) / (hackTime * securityPenalty * moneyPenalty);
}

/**
 * Trouver la meilleure cible pour le hacking
 * @param {NS} ns
 * @param {boolean} useAdvancedScore - Utiliser le score avancé
 * @returns {string|null} Hostname de la meilleure cible
 */
export function getBestTarget(ns, useAdvancedScore = false) {
    const servers = scanAll(ns);
    let bestTarget = null;
    let bestScore = 0;

    for (const host of servers) {
        if (!canHack(ns, host)) continue;

        const score = useAdvancedScore ?
            getTargetScoreAdvanced(ns, host) :
            getTargetScore(ns, host);

        if (score > bestScore) {
            bestScore = score;
            bestTarget = host;
        }
    }

    return bestTarget;
}

/**
 * Obtenir les N meilleures cibles
 * @param {NS} ns
 * @param {number} count - Nombre de cibles
 * @returns {Array} Liste des meilleures cibles avec scores
 */
export function getBestTargets(ns, count = 5) {
    const servers = scanAll(ns);
    const targets = [];

    for (const host of servers) {
        if (!canHack(ns, host)) continue;

        const score = getTargetScoreAdvanced(ns, host);
        if (score > 0) {
            targets.push({ host, score });
        }
    }

    return targets
        .sort((a, b) => b.score - a.score)
        .slice(0, count);
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
 * Calculer la RAM totale du réseau
 * @param {NS} ns
 * @returns {object} { total, used, free }
 */
export function getNetworkRamStats(ns) {
    const servers = scanAll(ns);
    let total = 0;
    let used = 0;

    for (const host of servers) {
        if (!ns.hasRootAccess(host)) continue;
        total += ns.getServerMaxRam(host);
        used += ns.getServerUsedRam(host);
    }

    return { total, used, free: total - used };
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
    if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
    return `${(ms / 86400000).toFixed(1)}d`;
}

/**
 * Formater la RAM en format lisible
 * @param {number} gb
 * @returns {string}
 */
export function formatRam(gb) {
    if (gb >= 1024 * 1024) return `${(gb / (1024 * 1024)).toFixed(1)}PB`;
    if (gb >= 1024) return `${(gb / 1024).toFixed(1)}TB`;
    return `${gb.toFixed(1)}GB`;
}

/**
 * Formater un nombre quelconque
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
    if (n >= 1e15) return (n / 1e15).toFixed(2) + "q";
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}

/**
 * Attendre un certain temps
 * @param {number} ms Millisecondes
 * @returns {Promise}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Lire un fichier JSON de façon sécurisée
 * @param {NS} ns
 * @param {string} file
 * @returns {object|null}
 */
export function readJSON(ns, file) {
    try {
        const data = ns.read(file);
        if (data && data.length > 0) {
            return JSON.parse(data);
        }
    } catch (e) { }
    return null;
}

/**
 * Écrire un fichier JSON
 * @param {NS} ns
 * @param {string} file
 * @param {object} data
 */
export function writeJSON(ns, file, data) {
    ns.write(file, JSON.stringify(data, null, 2), "w");
}

/**
 * Calculer le pourcentage de progression
 * @param {number} current
 * @param {number} max
 * @returns {number} Pourcentage (0-100)
 */
export function getPercent(current, max) {
    if (max <= 0) return 0;
    return Math.min(100, Math.max(0, (current / max) * 100));
}

/**
 * Créer une barre de progression
 * @param {number} percent - Pourcentage (0-100)
 * @param {number} length - Longueur de la barre
 * @returns {string}
 */
export function getProgressBar(percent, length = 10) {
    const filled = Math.floor((percent / 100) * length);
    const empty = length - filled;
    return "█".repeat(filled) + "░".repeat(empty);
}
