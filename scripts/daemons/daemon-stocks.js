/**
 * Bitburner AI - Stocks Daemon (Lightweight)
 * RAM: ~6GB (stock API is heavy)
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier API
    try {
        ns.stock.getSymbols();
    } catch (e) {
        ns.tprint("❌ Stock API non disponible");
        return;
    }

    const CONFIG = {
        maxPositions: 6,
        minCash: 1e6,
        stopLoss: 0.08,
        takeProfit: 0.20,
    };

    const positions = {}; // symbol -> { shares, avgPrice }

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const symbols = ns.stock.getSymbols();

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  📈 STOCKS DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Cash: ${formatMoney(money)}`);
        ns.print("");

        // Calculer valeur portfolio
        let portfolioValue = 0;
        let positionCount = 0;

        for (const sym of symbols) {
            const [shares] = ns.stock.getPosition(sym);
            if (shares > 0) {
                positionCount++;
                portfolioValue += shares * ns.stock.getPrice(sym);
            }
        }

        ns.print(`📊 Portfolio: ${formatMoney(portfolioValue)}`);
        ns.print(`📈 Positions: ${positionCount}/${CONFIG.maxPositions}`);
        ns.print("");

        // Analyser et trader
        const analysis = [];

        for (const sym of symbols) {
            const price = ns.stock.getPrice(sym);
            const [shares, avgPrice] = ns.stock.getPosition(sym);

            let forecast = 0.5;
            try { forecast = ns.stock.getForecast(sym); } catch (e) { }

            const volatility = ns.stock.getVolatility(sym);
            const score = (forecast - 0.5) / Math.max(volatility, 0.01);

            analysis.push({ sym, price, shares, avgPrice, forecast, volatility, score });
        }

        // Trier par score
        analysis.sort((a, b) => b.score - a.score);

        // Vendre: stop-loss ou take-profit ou mauvais forecast
        ns.print("💼 Positions:");
        for (const a of analysis) {
            if (a.shares <= 0) continue;

            const profit = (a.price - a.avgPrice) / a.avgPrice;
            const icon = profit >= 0 ? "🟢" : "🔴";
            ns.print(`   ${icon} ${a.sym}: ${a.shares.toFixed(0)} @ ${formatMoney(a.avgPrice)}`);
            ns.print(`      P/L: ${(profit * 100).toFixed(1)}%`);

            // Vendre si stop-loss ou take-profit ou forecast < 0.5
            if (profit <= -CONFIG.stopLoss || profit >= CONFIG.takeProfit || a.forecast < 0.48) {
                const value = ns.stock.sellStock(a.sym, a.shares);
                if (value > 0) {
                    const action = profit >= CONFIG.takeProfit ? "💰 Take-profit" :
                        profit <= -CONFIG.stopLoss ? "🛑 Stop-loss" : "📉 Forecast";
                    ns.print(`      ${action}: ${formatMoney(value)}`);
                    ns.toast(`Vendu ${a.sym}: ${(profit * 100).toFixed(1)}%`, profit >= 0 ? "success" : "warning");
                }
            }
        }
        ns.print("");

        // Acheter: si on a moins de positions max et bon forecast
        if (positionCount < CONFIG.maxPositions && money > CONFIG.minCash) {
            const budget = (money - CONFIG.minCash) / (CONFIG.maxPositions - positionCount);

            for (const a of analysis) {
                if (a.shares > 0) continue; // Déjà une position
                if (a.forecast < 0.55) continue; // Pas assez bullish
                if (a.volatility > 0.05) continue; // Trop volatile

                const sharesToBuy = Math.floor(budget / a.price);
                if (sharesToBuy < 1) continue;

                const cost = ns.stock.buyStock(a.sym, sharesToBuy);
                if (cost > 0) {
                    ns.print(`🛒 Acheté ${a.sym}: ${sharesToBuy} @ ${formatMoney(a.price)}`);
                    ns.toast(`Acheté ${a.sym}`, "success");
                    positionCount++;
                    if (positionCount >= CONFIG.maxPositions) break;
                }
            }
        }

        await ns.sleep(6000); // Toutes les 6 secondes
    }
}

function formatMoney(n) {
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "k";
    return "$" + n.toFixed(0);
}
