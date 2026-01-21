/**
 * Bitburner AI - Stock Market Daemon
 * Trading algorithmique automatisé
 * 
 * Stratégie:
 * - Achète quand le prix monte (momentum)
 * - Vend quand le prix baisse
 * - Gestion du risque automatique
 * 
 * Nécessite: 4S Market Data TIX API ($25b)
 * 
 * Usage: run daemon-stocks.js
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier si on a accès à l'API
    try {
        ns.stock.getSymbols();
    } catch (e) {
        ns.tprint("❌ API Stock non disponible. Achetez WSE + TIX API.");
        return;
    }

    // Configuration
    const config = {
        maxInvestmentPercent: 0.25,  // Max 25% de l'argent dans un stock
        minCash: 1000000,            // Garder au moins $1m
        buyThreshold: 0.55,          // Acheter si forecast > 55%
        sellThreshold: 0.45,         // Vendre si forecast < 45%
        minSharePercent: 0.05,       // Min 5% des shares disponibles
    };

    // Portfolio
    const portfolio = {};
    let totalProfit = 0;

    ns.print("═══════════════════════════════════════");
    ns.print("  📈 STOCK MARKET AI");
    ns.print("═══════════════════════════════════════");

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const symbols = ns.stock.getSymbols();

        // Analyser chaque action
        const stockData = [];

        for (const sym of symbols) {
            const price = ns.stock.getPrice(sym);
            const forecast = ns.stock.getForecast(sym);
            const volatility = ns.stock.getVolatility(sym);
            const maxShares = ns.stock.getMaxShares(sym);
            const [longShares, longAvgPrice, shortShares, shortAvgPrice] = ns.stock.getPosition(sym);

            stockData.push({
                sym,
                price,
                forecast,
                volatility,
                maxShares,
                longShares,
                longAvgPrice,
                shortShares,
                shortAvgPrice,
                owned: longShares > 0 || shortShares > 0,
                profit: longShares > 0 ? (price - longAvgPrice) * longShares : 0,
            });
        }

        // Trier par forecast (meilleurs d'abord)
        stockData.sort((a, b) => b.forecast - a.forecast);

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  📈 STOCK MARKET AI");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Cash: $${formatMoney(money)}`);
        ns.print(`📊 Profit total: $${formatMoney(totalProfit)}`);
        ns.print("");

        // Optimiser le portfolio
        for (const stock of stockData) {
            // Vente LONG si ça baisse
            if (stock.longShares > 0 && stock.forecast < config.sellThreshold) {
                const salePrice = ns.stock.sellStock(stock.sym, stock.longShares);
                if (salePrice > 0) {
                    const profit = (salePrice - stock.longAvgPrice) * stock.longShares;
                    totalProfit += profit;
                    ns.print(`🔴 VENDU LONG ${stock.sym}: ${profit >= 0 ? '+' : ''}$${formatMoney(profit)}`);
                    ns.toast(`Vendu LONG ${stock.sym}`, profit >= 0 ? "success" : "warning");
                }
            }
            // Vente SHORT si ça remonte (Cover)
            // On couvre si le forecast repasse au neutre ou positif
            else if (stock.shortShares > 0 && stock.forecast > config.buyThreshold) {
                const salePrice = ns.stock.sellShort(stock.sym, stock.shortShares);
                if (salePrice > 0) {
                    // Profit Short = (Prix Vente Initiale - Prix Rachat Actuel)
                    // Note: L'API sellShort retourne le prix de rachat. 
                    // Profit = (AvgShortPrice - CurrentPrice) * Shares
                    const profit = (stock.shortAvgPrice - salePrice) * stock.shortShares;
                    totalProfit += profit;
                    ns.print(`🟢 COVER SHORT ${stock.sym}: ${profit >= 0 ? '+' : ''}$${formatMoney(profit)}`);
                    ns.toast(`Cover SHORT ${stock.sym}`, profit >= 0 ? "success" : "warning");
                }
            }
        }

        // Acheter les actions qui montent
        const cashToInvest = Math.max(0, money - config.minCash);
        const maxPerStock = cashToInvest * config.maxInvestmentPercent;

        for (const stock of stockData) {
            if (stock.forecast > config.buyThreshold && !stock.owned) {
                const sharesToBuy = Math.min(
                    Math.floor(maxPerStock / stock.price),
                    Math.floor(stock.maxShares * config.minSharePercent)
                );

                if (sharesToBuy > 0 && sharesToBuy * stock.price < cashToInvest) {
                    const cost = ns.stock.buyStock(stock.sym, sharesToBuy);
                    if (cost > 0) {
                        ns.print(`🟢 ACHETÉ LONG ${stock.sym}: ${sharesToBuy} @ $${formatMoney(stock.price)}`);
                        ns.toast(`Acheté LONG ${stock.sym}`, "success");
                    }
                }
            }
            // Vente à découvert (Short) - Si forecast trés mauvais
            else if (stock.forecast < config.sellThreshold && !stock.owned) {
                const sharesToBuy = Math.min(
                    Math.floor(maxPerStock / stock.price),
                    Math.floor(stock.maxShares * config.minSharePercent)
                );

                if (sharesToBuy > 0 && sharesToBuy * stock.price < cashToInvest) {
                    try {
                        const cost = ns.stock.buyShort(stock.sym, sharesToBuy);
                        if (cost > 0) {
                            ns.print(`🔴 ACHETÉ SHORT ${stock.sym}: ${sharesToBuy} @ $${formatMoney(stock.price)}`);
                            ns.toast(`Acheté SHORT ${stock.sym}`, "success");
                        }
                    } catch (e) {
                        // Shorting non disponible (Pas BN8)
                    }
                }
            }
        }

        // Afficher le portfolio
        const owned = stockData.filter(s => s.owned);
        if (owned.length > 0) {
            ns.print("");
            ns.print("📋 Portfolio:");
            for (const stock of owned) {
                const profitPercent = ((stock.price / stock.longAvgPrice) - 1) * 100;
                const icon = profitPercent >= 0 ? "📈" : "📉";
                ns.print(`   ${icon} ${stock.sym}: ${stock.longShares} @ $${formatMoney(stock.price)} (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(1)}%)`);
            }
        }

        // Top 5 opportunités
        ns.print("");
        ns.print("🎯 Top opportunités:");
        for (const stock of stockData.slice(0, 5)) {
            const icon = stock.forecast > 0.5 ? "🟢" : "🔴";
            ns.print(`   ${icon} ${stock.sym}: ${(stock.forecast * 100).toFixed(0)}% ${stock.owned ? "(possédé)" : ""}`);
        }

        await ns.sleep(6000); // Toutes les 6 secondes (cycle du marché)
    }
}

function formatMoney(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
