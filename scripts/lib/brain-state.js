/**
 * Bitburner AI - Centralized State Manager
 * Gestion unifiée de l'état pour coordination inter-daemons
 * 
 * Ce module permet à tous les daemons de partager un état global
 * et de coordonner leurs actions efficacement.
 */

const STATE_FILE = "/data/brain-state.txt";
const FEEDBACK_DIR = "/data/feedback/";

/**
 * Obtenir l'état global du système
 * @param {NS} ns
 * @returns {object} État actuel
 */
export function getState(ns) {
    try {
        const data = ns.read(STATE_FILE);
        if (data && data.length > 0) {
            return JSON.parse(data);
        }
    } catch (e) {
        // Fichier corrompu ou inexistant
    }
    return getDefaultState();
}

/**
 * Mettre à jour l'état global
 * @param {NS} ns
 * @param {object} updates - Mises à jour partielles
 * @returns {object} Nouvel état
 */
export function setState(ns, updates) {
    const state = getState(ns);
    const newState = {
        ...state,
        ...updates,
        lastUpdate: Date.now()
    };
    ns.write(STATE_FILE, JSON.stringify(newState, null, 2), "w");
    return newState;
}

/**
 * État par défaut
 */
export function getDefaultState() {
    return {
        // Phase de jeu détectée
        phase: "early", // early, mid, late, endgame

        // Priorité globale
        priority: "money", // money, xp, rep, combat, corp

        // Configuration active
        config: {
            hackPercent: 0.5,
            securityThreshold: 5,
            moneyThreshold: 0.75,
        },

        // Statistiques globales
        stats: {
            totalIncome: 0,
            hackingLevel: 1,
            netWorth: 0,
        },

        // Daemons actifs
        activeDaemons: [],

        // BitNode info
        bitNode: 1,
        sourceFiles: [],

        // Timestamps
        startTime: Date.now(),
        lastUpdate: Date.now(),
    };
}

/**
 * Détecter la phase de jeu actuelle
 * @param {NS} ns
 * @returns {string} Phase actuelle
 */
export function detectPhase(ns) {
    const money = ns.getServerMoneyAvailable("home");
    const hackLevel = ns.getHackingLevel();
    const servers = ns.getPurchasedServers().length;

    if (money > 1e15 && hackLevel > 2000) return "endgame";
    if (money > 1e12 && hackLevel > 1000) return "late";
    if (money > 1e9 && hackLevel > 500) return "mid";
    if (money > 1e6 && hackLevel > 50) return "early-mid";
    return "early";
}

/**
 * Déterminer la priorité optimale
 * @param {NS} ns
 * @param {object} state
 * @returns {string} Priorité recommandée
 */
export function determinePriority(ns, state) {
    const phase = state.phase;
    const bn = state.bitNode;

    // Priorités spécifiques par BitNode
    switch (bn) {
        case 2: return "gang";
        case 3: return "corp";
        case 6:
        case 7: return "combat";
        case 8: return "stocks";
        case 9: return "hacknet";
        case 10: return "sleeve";
    }

    // Priorités par phase
    switch (phase) {
        case "early": return "xp";
        case "early-mid": return "money";
        case "mid": return "money";
        case "late": return "rep";
        case "endgame": return "prestige";
    }

    return "money";
}

// ====== SYSTÈME DE COMMANDES INTER-DAEMONS ======

const COMMAND_FILE = "/data/daemon-commands.txt";

/**
 * Envoyer une commande à un daemon
 * @param {NS} ns
 * @param {string} targetDaemon - ID du daemon cible
 * @param {string} command - Commande à exécuter
 * @param {object} params - Paramètres de la commande
 */
export function sendCommand(ns, targetDaemon, command, params = {}) {
    const commands = getCommands(ns);

    commands.push({
        target: targetDaemon,
        command,
        params,
        timestamp: Date.now(),
        executed: false,
    });

    // Garder seulement les 50 dernières commandes
    while (commands.length > 50) {
        commands.shift();
    }

    ns.write(COMMAND_FILE, JSON.stringify(commands, null, 2), "w");
}

/**
 * Lire les commandes pour un daemon
 * @param {NS} ns
 * @param {string} daemonId - ID du daemon
 * @returns {object[]} Commandes non exécutées
 */
export function getCommandsForDaemon(ns, daemonId) {
    const commands = getCommands(ns);
    return commands.filter(c => c.target === daemonId && !c.executed);
}

/**
 * Marquer une commande comme exécutée
 * @param {NS} ns
 * @param {number} timestamp - Timestamp de la commande
 */
export function markCommandExecuted(ns, timestamp) {
    const commands = getCommands(ns);
    const cmd = commands.find(c => c.timestamp === timestamp);
    if (cmd) {
        cmd.executed = true;
        ns.write(COMMAND_FILE, JSON.stringify(commands, null, 2), "w");
    }
}

/**
 * Obtenir toutes les commandes
 */
function getCommands(ns) {
    try {
        const data = ns.read(COMMAND_FILE);
        if (data && data.length > 0) {
            return JSON.parse(data);
        }
    } catch (e) { }
    return [];
}

// ====== SYSTÈME DE DIRECTIVES GLOBALES ======

const DIRECTIVES_FILE = "/data/ai-directives.txt";

/**
 * Définir une directive globale
 * @param {NS} ns
 * @param {string} key - Clé de la directive
 * @param {any} value - Valeur
 */
export function setDirective(ns, key, value) {
    const directives = getDirectives(ns);
    directives[key] = {
        value,
        timestamp: Date.now(),
    };
    ns.write(DIRECTIVES_FILE, JSON.stringify(directives, null, 2), "w");
}

/**
 * Lire une directive
 * @param {NS} ns
 * @param {string} key
 * @param {any} defaultValue
 * @returns {any}
 */
export function getDirective(ns, key, defaultValue = null) {
    const directives = getDirectives(ns);
    return directives[key]?.value ?? defaultValue;
}

/**
 * Obtenir toutes les directives
 */
export function getDirectives(ns) {
    try {
        const data = ns.read(DIRECTIVES_FILE);
        if (data && data.length > 0) {
            return JSON.parse(data);
        }
    } catch (e) { }
    return {};
}

/**
 * Envoyer du feedback depuis un daemon
 * @param {NS} ns
 * @param {string} daemon - Nom du daemon
 * @param {object} feedback - Données de feedback
 */
export function sendFeedback(ns, daemon, feedback) {
    const file = `/data/feedback-${daemon}.txt`;
    const data = {
        ...feedback,
        timestamp: Date.now(),
    };
    ns.write(file, JSON.stringify(data), "w");
}

/**
 * Lire le feedback d'un daemon
 * @param {NS} ns
 * @param {string} daemon - Nom du daemon
 * @returns {object|null} Feedback ou null
 */
export function readFeedback(ns, daemon) {
    const file = `/data/feedback-${daemon}.txt`;
    try {
        const data = ns.read(file);
        if (data && data.length > 0) {
            return JSON.parse(data);
        }
    } catch (e) { }
    return null;
}

/**
 * Formater un nombre en notation lisible
 * @param {number} n
 * @returns {string}
 */
export function formatNum(n) {
    if (n >= 1e15) return (n / 1e15).toFixed(2) + "q";
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
