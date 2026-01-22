/**
 * Bitburner AI - Corporation Daemon (Lightweight)
 * RAM: ~8GB (Corp API is heavy)
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    let hasCorp = false;
    try {
        ns.corporation.getCorporation();
        hasCorp = true;
    } catch (e) { }

    if (!hasCorp) {
        const money = ns.getServerMoneyAvailable("home");
        if (money < 150e9) {
            ns.tprint("❌ Besoin de $150b pour créer une corporation");
            return;
        }
        try {
            ns.corporation.createCorporation("NexusCorp", true);
            hasCorp = true;
            ns.toast("Corporation créée!", "success");
        } catch (e) {
            ns.tprint("❌ Impossible de créer la corporation");
            return;
        }
    }

    const CITIES = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

    while (true) {
        const corp = ns.corporation.getCorporation();

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🏢 CORPORATION DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Funds: ${formatMoney(corp.funds)}`);
        ns.print(`📈 Revenue: ${formatMoney(corp.revenue)}/sec`);
        ns.print(`📉 Expenses: ${formatMoney(corp.expenses)}/sec`);
        ns.print(`💵 Profit: ${formatMoney(corp.revenue - corp.expenses)}/sec`);
        ns.print(`🏭 Divisions: ${corp.divisions.length}`);
        ns.print("");

        // Créer division si aucune
        if (corp.divisions.length === 0) {
            try {
                ns.corporation.expandIndustry("Agriculture", "Agri-Div");
                ns.toast("Division créée!", "success");
            } catch (e) { }
        }

        // Gérer chaque division
        for (const divName of corp.divisions) {
            const div = ns.corporation.getDivision(divName);
            ns.print(`📦 ${divName} (${div.type})`);

            // Expand cities
            for (const city of CITIES) {
                if (!div.cities.includes(city)) {
                    try {
                        ns.corporation.expandCity(divName, city);
                        ns.print(`   🌍 Expansion: ${city}`);
                    } catch (e) { }
                }
            }

            // Warehouse
            for (const city of div.cities) {
                if (!ns.corporation.hasWarehouse(divName, city)) {
                    try { ns.corporation.purchaseWarehouse(divName, city); } catch (e) { }
                }

                // Office
                try {
                    const office = ns.corporation.getOffice(divName, city);
                    while (office.numEmployees < office.size) {
                        try { ns.corporation.hireEmployee(divName, city); } catch (e) { break; }
                    }
                } catch (e) { }

                // Smart supply
                try { ns.corporation.setSmartSupply(divName, city, true); } catch (e) { }

                // Sell
                try {
                    ns.corporation.sellMaterial(divName, city, "Food", "MAX", "MP");
                    ns.corporation.sellMaterial(divName, city, "Plants", "MAX", "MP");
                } catch (e) { }
            }

            // Products
            if (div.makesProducts && div.products.length < 3) {
                try {
                    const budget = Math.max(1e9, corp.funds * 0.1);
                    ns.corporation.makeProduct(divName, div.cities[0], `Prod-${Date.now() % 1000}`, budget / 2, budget / 2);
                } catch (e) { }
            }

            for (const prod of div.products) {
                try {
                    const p = ns.corporation.getProduct(divName, div.cities[0], prod);
                    if (p.developmentProgress >= 100) {
                        ns.corporation.sellProduct(divName, div.cities[0], prod, "MAX", "MP", true);
                    }
                } catch (e) { }
            }
        }

        // Upgrades
        const upgrades = ["Smart Factories", "Smart Storage", "FocusWires"];
        for (const up of upgrades) {
            try {
                const cost = ns.corporation.getUpgradeLevelCost(up);
                if (corp.funds > cost * 3) {
                    ns.corporation.levelUpgrade(up);
                }
            } catch (e) { }
        }

        await ns.sleep(10000);
    }
}

function formatMoney(n) {
    if (n >= 1e15) return "$" + (n / 1e15).toFixed(2) + "q";
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "m";
    return "$" + n.toFixed(0);
}
