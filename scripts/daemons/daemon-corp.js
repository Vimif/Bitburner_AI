/**
 * Bitburner AI - Corporation Daemon
 * Automatisation de la gestion de corporation
 * 
 * Fonctionnalités:
 * - Création et expansion des divisions
 * - Gestion des employés
 * - Achat d'upgrades
 * - Production et vente automatique
 * - Gestion des investisseurs
 * 
 * Nécessite: $150b pour créer une corporation
 * 
 * Usage: run daemon-corp.js
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier si on a une corporation
    let hasCorp = false;
    try {
        ns.corporation.getCorporation();
        hasCorp = true;
    } catch (e) {
        // Pas de corp
    }

    // Créer la corporation si nécessaire
    if (!hasCorp) {
        const money = ns.getServerMoneyAvailable("home");
        if (money >= 150e9) {
            try {
                ns.corporation.createCorporation("BitburnerAI Corp", true);
                ns.toast("🏢 Corporation créée!", "success");
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

    while (true) {
        const corp = ns.corporation.getCorporation();

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🏢 CORPORATION DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Fonds: $${formatMoney(corp.funds)}`);
        ns.print(`📈 Revenus: $${formatMoney(corp.revenue)}/sec`);
        ns.print(`📉 Dépenses: $${formatMoney(corp.expenses)}/sec`);
        ns.print(`💵 Profit: $${formatMoney(corp.revenue - corp.expenses)}/sec`);
        ns.print(`🏭 Divisions: ${corp.divisions.length}`);
        ns.print("");

        // Gérer chaque division
        for (const divisionName of corp.divisions) {
            const division = ns.corporation.getDivision(divisionName);
            ns.print(`📦 ${divisionName} (${division.type})`);

            // Gérer les villes
            for (const city of division.cities) {
                const office = ns.corporation.getOffice(divisionName, city);
                const warehouse = ns.corporation.getWarehouse(divisionName, city);

                // Embaucher si places disponibles
                while (office.numEmployees < office.size) {
                    try {
                        ns.corporation.hireEmployee(divisionName, city);
                    } catch (e) {
                        break;
                    }
                }

                // Assigner les rôles
                try {
                    await ns.corporation.setAutoJobAssignment(divisionName, city, "Research & Development", Math.floor(office.size * 0.3));
                    await ns.corporation.setAutoJobAssignment(divisionName, city, "Engineer", Math.floor(office.size * 0.2));
                    await ns.corporation.setAutoJobAssignment(divisionName, city, "Management", Math.floor(office.size * 0.1));
                    await ns.corporation.setAutoJobAssignment(divisionName, city, "Operations", Math.floor(office.size * 0.2));
                    await ns.corporation.setAutoJobAssignment(divisionName, city, "Business", Math.floor(office.size * 0.2));
                } catch (e) { }

                // Vendre les produits
                try {
                    if (division.products.length > 0) {
                        for (const product of division.products) {
                            ns.corporation.sellProduct(divisionName, city, product, "MAX", "MP", true);
                        }
                    }

                    // Vendre les matériaux
                    // Vendre les matériaux
                    ns.corporation.sellMaterial(divisionName, city, "Food", "MAX", "MP");
                    ns.corporation.sellMaterial(divisionName, city, "Plants", "MAX", "MP");
                    ns.corporation.sellMaterial(divisionName, city, "Hardware", "MAX", "MP");
                } catch (e) { }
            }

            // Gérer la Recherche (Research)
            if (!division.researchPoints) division.researchPoints = 0;
            const researches = [
                { name: "Hi-Tech R&D Laboratory", cost: 5000 },
                { name: "Market-TA.I", cost: 20000 },
                { name: "Market-TA.II", cost: 50000 },
                { name: "Drones", cost: 5000 },
                { name: "Overclock", cost: 15000 },
                { name: "Self-Correcting Assemblers", cost: 25000 },
            ];

            for (const res of researches) {
                if (!ns.corporation.hasResearched(divisionName, res.name)) {
                    if (division.researchPoints >= res.cost) {
                        ns.corporation.research(divisionName, res.name);
                        ns.print(`🧪 Recherche: ${res.name} (@ ${divisionName})`);
                    }
                    // On ne recherche qu'un à la fois par cycle pour garder des points
                    break;
                }
            }
        }

        // Acheter des upgrades
        const upgrades = [
            "FocusWires",
            "Neural Accelerators",
            "Speech Processor Implants",
            "Nuoptimal Nootropic Injector Implants",
            "Smart Factories",
            "Smart Storage",
        ];

        for (const upgrade of upgrades) {
            try {
                const cost = ns.corporation.getUpgradeLevelCost(upgrade);
                if (corp.funds > cost * 3) {
                    ns.corporation.levelUpgrade(upgrade);
                }
            } catch (e) { }
        }

        // Gérer les investissements
        const investmentOffer = ns.corporation.getInvestmentOffer();
        if (investmentOffer.funds > 0 && investmentOffer.round <= 3) {
            ns.print("");
            ns.print(`💼 Offre d'investissement: $${formatMoney(investmentOffer.funds)}`);
            ns.print(`   Round: ${investmentOffer.round}`);
            ns.print(`   Shares: ${(investmentOffer.shares * 100).toFixed(1)}%`);
        }

        // Gérer les produits (Tobacco / Software / etc.)
        const productDivisions = corp.divisions.filter(d => ns.corporation.getDivision(d).makesProducts);

        for (const divName of productDivisions) {
            const division = ns.corporation.getDivision(divName);
            const city = division.cities[0]; // Développement principal dans la 1ère ville (souvent Sector-12 ou Aevum)

            // Constantes produit
            const MAX_PRODUCTS = 3;
            const MIN_BUDGET = 1e9; // 1b minimum pour un bon produit

            // 1. Détecter si on peut créer un nouveau produit
            if (division.products.length < MAX_PRODUCTS) {
                // Si on a assez d'argent (10% du cash actuel ou MIN_BUDGET)
                const budget = Math.max(MIN_BUDGET, corp.funds * 0.1);

                if (corp.funds > budget * 2) {
                    const version = division.products.length + 1 + (division.lastProductVersion || 0);
                    const prodName = `Product-v${version}`;

                    // Design/Marketing investment = 50/50 du budget
                    try {
                        ns.corporation.makeProduct(divName, city, prodName, budget / 2, budget / 2);
                        ns.print(`✨ Nouveau produit: ${prodName} (${divName}) - Budget: $${formatMoney(budget)}`);
                        ns.toast(`Dev Produit: ${prodName}`, "info");

                        // Stocker la version pour incrémentation future (hack simple via propriété custom si possible, sinon on parse le nom)
                        // ns.corporation ne permet pas de stocker de state custom facilement sans fichier externe, 
                        // mais on s'appuie sur products.length pour l'instant.
                    } catch (e) { }
                }
            } else {
                // 2. Discontinuer les vieux produits si un nouveau est prêt
                // On garde toujours les meilleurs. Si on est au max, on retire le pire/plus vieux
                // Mais seulement si le développement du dernier est terminé (progress === 100)

                // Vérifier si tous les produits sont finis
                let allFinished = true;
                for (const pName of division.products) {
                    const prod = ns.corporation.getProduct(divName, pName);
                    if (prod.developmentProgress < 100) {
                        allFinished = false;
                        break;
                    }
                }

                if (allFinished) {
                    // Discontinuer le plus vieux (souvent le premier de la liste)
                    const oldest = division.products[0];
                    ns.corporation.discontinueProduct(divName, oldest);
                    ns.print(`🗑️ Produit arrêté: ${oldest}`);
                    ns.toast(`Discontinue: ${oldest}`, "warning");
                }
            }

            // 3. Gérer le prix des produits et Market-TA
            for (const pName of division.products) {
                const prod = ns.corporation.getProduct(divName, pName);

                if (prod.developmentProgress >= 100) {
                    ns.corporation.sellProduct(divName, city, pName, "MAX", "MP", true);

                    if (ns.corporation.hasResearched(divName, "Market-TA.II")) {
                        ns.corporation.setProductMarketTA1(divName, pName, true);
                        ns.corporation.setProductMarketTA2(divName, pName, true);
                    }
                }
            }
        }

        await ns.sleep(10000);
    }
}

function formatMoney(n) {
    if (n >= 1e15) return (n / 1e15).toFixed(2) + "q";
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(2);
}
