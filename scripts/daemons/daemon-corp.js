/**
 * Bitburner AI - Corporation Daemon v2.0
 * Automatisation avancée de la gestion de corporation
 * 
 * Améliorations v2.0:
 * - Industry selection AI
 * - Expansion automatique
 * - Product lifecycle management
 * - Investment rounds optimization
 * - Research prioritization
 * 
 * Nécessite: $150b pour créer une corporation
 * 
 * Usage: run daemon-corp.js
 */

import { getState, sendFeedback } from "../lib/brain-state.js";

// Configuration
const CONFIG = {
    minFundsMultiplier: 3,      // Acheter si funds > cost * 3
    investmentThreshold: 0.1,   // Accepter si < 10% shares
    productBudgetPercent: 0.15, // 15% des funds pour nouveaux produits
    maxProducts: 3,             // Max produits par division
};

// Industries recommandées par phase
const INDUSTRY_PRIORITY = {
    early: ["Agriculture", "Tobacco"],
    mid: ["Tobacco", "Software", "Healthcare"],
    late: ["Software", "Robotics", "Healthcare"],
};

// Villes pour l'expansion
const CITIES = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier si on a une corporation
    let hasCorp = false;
    try {
        ns.corporation.getCorporation();
        hasCorp = true;
    } catch (e) { }

    // Créer la corporation si nécessaire
    if (!hasCorp) {
        const money = ns.getServerMoneyAvailable("home");
        if (money >= 150e9) {
            try {
                // Essayer d'abord sans self-fund (si on a les prérequis)
                const corpName = generateCorpName();
                try {
                    ns.corporation.createCorporation(corpName, false);
                } catch (e) {
                    ns.corporation.createCorporation(corpName, true);
                }
                ns.toast(`🏢 Corporation créée: ${corpName}`, "success");
                hasCorp = true;
            } catch (e) {
                ns.tprint("❌ Impossible de créer la corporation.");
                return;
            }
        } else {
            ns.tprint(`❌ Pas assez d'argent pour créer une corporation.`);
            ns.tprint(`   Requis: $150b, Actuel: $${formatMoney(money)}`);
            return;
        }
    }

    let lastFeedbackTime = 0;

    while (true) {
        const corp = ns.corporation.getCorporation();
        const state = getState(ns);

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🏢 CORPORATION DAEMON v2.0");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Fonds: $${formatMoney(corp.funds)}`);
        ns.print(`📈 Revenus: $${formatMoney(corp.revenue)}/sec`);
        ns.print(`📉 Dépenses: $${formatMoney(corp.expenses)}/sec`);
        ns.print(`💵 Profit: $${formatMoney(corp.revenue - corp.expenses)}/sec`);
        ns.print(`🏭 Divisions: ${corp.divisions.length}`);
        ns.print(`📊 Public: ${corp.public ? "Oui" : "Non"}`);
        ns.print("");

        // 1. Vérifier/créer la première division
        if (corp.divisions.length === 0) {
            await createFirstDivision(ns, corp, state);
        }

        // 2. Gérer chaque division
        for (const divisionName of corp.divisions) {
            await manageDivision(ns, divisionName, corp);
        }

        // 3. Acheter des upgrades corporation
        await buyUpgrades(ns, corp);

        // 4. Gérer les investissements
        manageInvestments(ns, corp);

        // 5. Expansion (nouvelles divisions)
        if (corp.divisions.length < 3 && corp.funds > 100e9) {
            await expandToDivision(ns, corp, state);
        }

        // Feedback
        if (Date.now() - lastFeedbackTime > 30000) {
            sendFeedback(ns, "corp", {
                funds: corp.funds,
                revenue: corp.revenue,
                profit: corp.revenue - corp.expenses,
                divisions: corp.divisions.length,
                public: corp.public,
            });
            lastFeedbackTime = Date.now();
        }

        await ns.sleep(10000);
    }
}

/**
 * Créer la première division
 */
async function createFirstDivision(ns, corp, state) {
    const phase = state.phase || "early";
    const industries = INDUSTRY_PRIORITY[phase] || INDUSTRY_PRIORITY.early;

    for (const industry of industries) {
        try {
            const divName = `${industry}-Div`;
            ns.corporation.expandIndustry(industry, divName);
            ns.print(`🏭 Nouvelle division: ${divName}`);
            ns.toast(`Division créée: ${divName}`, "success");

            // Expand to first city
            const division = ns.corporation.getDivision(divName);
            if (division.cities.length === 0) {
                ns.corporation.expandCity(divName, "Sector-12");
            }

            // Buy warehouse
            if (!ns.corporation.hasWarehouse(divName, "Sector-12")) {
                ns.corporation.purchaseWarehouse(divName, "Sector-12");
            }

            return;
        } catch (e) {
            // Essayer l'industrie suivante
        }
    }
}

/**
 * Gérer une division
 */
async function manageDivision(ns, divisionName, corp) {
    const division = ns.corporation.getDivision(divisionName);
    ns.print(`📦 ${divisionName} (${division.type})`);

    // Expand to all cities
    for (const city of CITIES) {
        if (!division.cities.includes(city)) {
            try {
                const cost = ns.corporation.getConstants().officeInitialCost;
                if (corp.funds > cost * CONFIG.minFundsMultiplier) {
                    ns.corporation.expandCity(divisionName, city);
                    ns.print(`   🌍 Expansion: ${city}`);
                }
            } catch (e) { }
        }
    }

    // Gérer chaque ville
    for (const city of division.cities) {
        await manageOffice(ns, divisionName, city, corp);
        await manageWarehouse(ns, divisionName, city);
    }

    // Gérer les produits (si applicable)
    if (division.makesProducts) {
        await manageProducts(ns, divisionName, division, corp);
    }

    // Recherche
    await manageResearch(ns, divisionName, division);
}

/**
 * Gérer un bureau
 */
async function manageOffice(ns, divisionName, city, corp) {
    try {
        const office = ns.corporation.getOffice(divisionName, city);

        // Embaucher si places disponibles
        while (office.numEmployees < office.size) {
            try {
                ns.corporation.hireEmployee(divisionName, city);
            } catch (e) {
                break;
            }
        }

        // Assigner les rôles optimalement
        const size = office.size;
        const assignments = {
            "Research & Development": Math.floor(size * 0.25),
            "Engineer": Math.floor(size * 0.25),
            "Management": Math.floor(size * 0.10),
            "Operations": Math.floor(size * 0.20),
            "Business": Math.floor(size * 0.20),
        };

        for (const [role, count] of Object.entries(assignments)) {
            try {
                await ns.corporation.setAutoJobAssignment(divisionName, city, role, count);
            } catch (e) { }
        }

        // Upgrade office size si profitable
        if (corp.revenue > corp.expenses * 1.5) {
            try {
                const upgradeCost = ns.corporation.getOfficeSizeUpgradeCost(divisionName, city, 3);
                if (corp.funds > upgradeCost * CONFIG.minFundsMultiplier) {
                    ns.corporation.upgradeOfficeSize(divisionName, city, 3);
                }
            } catch (e) { }
        }
    } catch (e) { }
}

/**
 * Gérer un entrepôt
 */
async function manageWarehouse(ns, divisionName, city) {
    // Acheter warehouse si nécessaire
    if (!ns.corporation.hasWarehouse(divisionName, city)) {
        try {
            ns.corporation.purchaseWarehouse(divisionName, city);
        } catch (e) {
            return;
        }
    }

    try {
        const warehouse = ns.corporation.getWarehouse(divisionName, city);

        // Enable smart supply
        try {
            ns.corporation.setSmartSupply(divisionName, city, true);
        } catch (e) { }

        // Vendre les produits à MP
        try {
            ns.corporation.sellMaterial(divisionName, city, "Food", "MAX", "MP");
            ns.corporation.sellMaterial(divisionName, city, "Plants", "MAX", "MP");
            ns.corporation.sellMaterial(divisionName, city, "Hardware", "MAX", "MP");
            ns.corporation.sellMaterial(divisionName, city, "Robots", "MAX", "MP");
            ns.corporation.sellMaterial(divisionName, city, "AI Cores", "MAX", "MP");
            ns.corporation.sellMaterial(divisionName, city, "Real Estate", "MAX", "MP");
        } catch (e) { }
    } catch (e) { }
}

/**
 * Gérer les produits
 */
async function manageProducts(ns, divisionName, division, corp) {
    const city = division.cities[0]; // Dev dans la première ville

    // Vérifier les produits existants
    const products = division.products;
    let developingProduct = false;

    for (const productName of products) {
        try {
            const product = ns.corporation.getProduct(divisionName, city, productName);

            // Vendre si développement terminé
            if (product.developmentProgress >= 100) {
                for (const c of division.cities) {
                    ns.corporation.sellProduct(divisionName, c, productName, "MAX", "MP", true);
                }

                // Market-TA
                if (ns.corporation.hasResearched(divisionName, "Market-TA.II")) {
                    ns.corporation.setProductMarketTA1(divisionName, productName, true);
                    ns.corporation.setProductMarketTA2(divisionName, productName, true);
                }
            } else {
                developingProduct = true;
            }
        } catch (e) { }
    }

    // Créer nouveau produit si possible
    if (!developingProduct && products.length < CONFIG.maxProducts) {
        const budget = Math.max(1e9, corp.funds * CONFIG.productBudgetPercent);
        if (corp.funds > budget * 2) {
            try {
                const productName = `Product-${Date.now() % 10000}`;
                ns.corporation.makeProduct(divisionName, city, productName, budget / 2, budget / 2);
                ns.print(`   ✨ Nouveau produit: ${productName}`);
            } catch (e) { }
        }
    }

    // Discontinuer vieux produits si on est au max
    if (products.length >= CONFIG.maxProducts && !developingProduct) {
        try {
            const oldest = products[0];
            ns.corporation.discontinueProduct(divisionName, oldest);
            ns.print(`   🗑️ Arrêté: ${oldest}`);
        } catch (e) { }
    }
}

/**
 * Gérer la recherche
 */
async function manageResearch(ns, divisionName, division) {
    const researchPriority = [
        { name: "Hi-Tech R&D Laboratory", cost: 5000 },
        { name: "Market-TA.I", cost: 20000 },
        { name: "Market-TA.II", cost: 50000 },
        { name: "uPgrade: Fulcrum", cost: 10000 },
        { name: "uPgrade: Capacity.I", cost: 20000 },
        { name: "Drones", cost: 5000 },
        { name: "Drones - Assembly", cost: 25000 },
        { name: "Self-Correcting Assemblers", cost: 25000 },
    ];

    for (const res of researchPriority) {
        try {
            if (!ns.corporation.hasResearched(divisionName, res.name)) {
                if (division.researchPoints >= res.cost * 1.5) {
                    ns.corporation.research(divisionName, res.name);
                    ns.print(`   🧪 Recherche: ${res.name}`);
                    return; // Une recherche par cycle
                }
            }
        } catch (e) { }
    }
}

/**
 * Acheter des upgrades corporation
 */
async function buyUpgrades(ns, corp) {
    const upgrades = [
        "Smart Factories",
        "Smart Storage",
        "FocusWires",
        "Neural Accelerators",
        "Speech Processor Implants",
        "Nuoptimal Nootropic Injector Implants",
        "DreamSense",
        "Wilson Analytics",
        "ABC SalesBots",
        "Project Insight",
    ];

    for (const upgrade of upgrades) {
        try {
            const cost = ns.corporation.getUpgradeLevelCost(upgrade);
            if (corp.funds > cost * CONFIG.minFundsMultiplier) {
                ns.corporation.levelUpgrade(upgrade);
            }
        } catch (e) { }
    }
}

/**
 * Gérer les investissements
 */
function manageInvestments(ns, corp) {
    try {
        const offer = ns.corporation.getInvestmentOffer();

        if (offer.funds > 0 && offer.round <= 4) {
            ns.print("");
            ns.print(`💼 Offre investissement Round ${offer.round}:`);
            ns.print(`   Fonds: $${formatMoney(offer.funds)}`);
            ns.print(`   Shares: ${(offer.shares * 100).toFixed(1)}%`);

            // Accepter si:
            // Round 1-2: Toujours accepter pour le capital
            // Round 3-4: Accepter si < 10% shares
            if (offer.round <= 2 || offer.shares < CONFIG.investmentThreshold) {
                // Note: La décision finale est laissée à l'utilisateur
                ns.print(`   ✅ Recommandé: ACCEPTER`);
            } else {
                ns.print(`   ⚠️ Recommandé: REFUSER (trop de shares)`);
            }
        }
    } catch (e) { }
}

/**
 * Expansion vers nouvelle division
 */
async function expandToDivision(ns, corp, state) {
    const phase = state.phase || "mid";
    const existingTypes = corp.divisions.map(d => {
        try {
            return ns.corporation.getDivision(d).type;
        } catch (e) {
            return null;
        }
    });

    const industries = INDUSTRY_PRIORITY[phase] || INDUSTRY_PRIORITY.mid;

    for (const industry of industries) {
        if (existingTypes.includes(industry)) continue;

        try {
            const cost = ns.corporation.getConstants().industryCost[industry];
            if (corp.funds > cost * CONFIG.minFundsMultiplier) {
                const divName = `${industry}-Div`;
                ns.corporation.expandIndustry(industry, divName);
                ns.print(`🏭 Expansion: ${divName}`);
                ns.toast(`Nouvelle division: ${divName}`, "success");
                return;
            }
        } catch (e) { }
    }
}

/**
 * Générer un nom de corporation
 */
function generateCorpName() {
    const prefixes = ["Nexus", "Quantum", "Cyber", "Neural", "Omega", "Alpha"];
    const suffixes = ["Corp", "Industries", "Systems", "Technologies", "Dynamics"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${prefix} ${suffix}`;
}

function formatMoney(n) {
    if (n >= 1e15) return (n / 1e15).toFixed(2) + "q";
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(2);
}
