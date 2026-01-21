/**
 * Bitburner AI - Constants
 * Configuration centralisée pour tout le système
 */

// Ports de communication inter-scripts
export const PORTS = {
    HACK_CONTROL: 1,
    SERVER_CONTROL: 2,
    STATS: 3,
    LOGS: 4,
};

// Configuration du hacking
export const HACK_CONFIG = {
    // Pourcentage de l'argent max à voler par batch
    HACK_PERCENT: 0.5,
    // Seuil de sécurité acceptable (au-dessus du minimum)
    SECURITY_THRESHOLD: 5,
    // Seuil d'argent acceptable (pourcentage du max)
    // Pourcentage d'argent min avant le hack (pour éviter de hacker serveurs vides)
    MONEY_THRESHOLD: 0.8,
    // Délai entre les batches (ms) - Optimisé
    BATCH_DELAY: 100,
    // Délai entre les opérations HWGW (ms)
    STEP_DELAY: 40,
};

// Configuration des serveurs personnels
export const SERVER_CONFIG = {
    // Préfixe pour les noms de serveurs
    PREFIX: "pserv-",
    // Nombre max de serveurs (limite du jeu)
    MAX_SERVERS: 25,
    // RAM minimale pour un nouveau serveur
    MIN_RAM: 8,
    // RAM maximale (limite du jeu)
    MAX_RAM: 1048576, // 2^20
    // Multiplier le coût par ce facteur avant d'acheter
    COST_MULTIPLIER: 2,
};

// Configuration Hacknet
export const HACKNET_CONFIG = {
    // Temps de ROI maximum acceptable (en secondes)
    MAX_ROI_TIME: 3600, // 1 heure
    // Pourcentage max de l'argent à investir
    MAX_INVESTMENT_PERCENT: 0.1,
};

// Liste des programmes de crack
export const CRACK_PROGRAMS = [
    { name: "BruteSSH.exe", fn: "brutessh" },
    { name: "FTPCrack.exe", fn: "ftpcrack" },
    { name: "relaySMTP.exe", fn: "relaysmtp" },
    { name: "HTTPWorm.exe", fn: "httpworm" },
    { name: "SQLInject.exe", fn: "sqlinject" },
];

// Serveurs à ignorer pour le hacking
export const IGNORED_SERVERS = [
    "home",
    "darkweb",
];

// RAM des workers
export const WORKER_RAM = {
    hack: 1.7,
    grow: 1.75,
    weaken: 1.75,
};
