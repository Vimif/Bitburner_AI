/**
 * Bitburner AI - Stock Market Daemon v2.0
 * Trading algorithmique avec gestion des risques avancée
 * 
 * Améliorations v2.0:
 * - Position sizing dynamique basé sur la volatilité
 * - Stop-loss et take-profit automatiques
 * - Diversification enforced (max positions)
 * - Trend detection avec momentum
 * - Short selling amélioré
 * - Feedback vers l'optimizer
 * 
 * Nécessite: WSE + TIX API ($5b) + 4S Market Data ($1b)
 * Optional: 4S Market Data TIX API ($25b) pour forecast
 * 
 * Usage: run daemon-stocks.js
 */

import { sendFeedback } from "../lib/brain-state.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    // Vérifier si on a accès à l'API
    let hasForecasting = false;
    try {
        ns.stock.getSymbols();
    } catch (e) {
        ns.tprint("❌ API Stock non disponible. Achetez WSE + TIX API.");
        return;
    }

    // Vérifier l'accès au forecast
    try {
        const symbols = ns.stock.getSymbols();
        ns.stock.getForecast(symbols[0]);
        hasForecasting = true;
    } catch (e) {
        ns.tprint("⚠️ 4S Market Data non disponible. Trading limité.");
    }

    // Configuration avancée
    const config = {
        maxInvestmentPercent: 0.20,  // Max 20% par position
        minCash: 10000000,           // Garder au moins $10m
        buyThreshold: 0.55,          // Acheter si forecast > 55%
        sellThreshold: 0.48,         // Vendre si forecast < 48%
        stopLossPercent: 0.08,       // Stop-loss à -8%
        takeProfitPercent: 0.20,     // Take-profit à +20%
        maxPositions: 6,             // Max 6 positions simultanées
        minVolatility: 0.01,         // Ignorer les stocks trop stables
        maxVolatility: 0.05,         // Éviter les stocks trop volatils
    };

    // Historique des prix pour trend analysis
    const priceHistory = {};
    const HISTORY_LENGTH = 20;

    // Statistiques
    let totalProfit = 0;
    let tradesCount = 0;
    let winCount = 0;
    let lastFeedbackTime = 0;

    ns.print("═══════════════════════════════════════");
    ns.print("  📈 STOCK MARKET AI v2.0");
    ns.print("═══════════════════════════════════════");

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const symbols = ns.stock.getSymbols();

        // Collecter les données de marché
        const stockData = [];

        for (const sym of symbols) {
            const price = ns.stock.getPrice(sym);
            const maxShares = ns.stock.getMaxShares(sym);
            const [longShares, longAvgPrice, shortShares, shortAvgPrice] = ns.stock.getPosition(sym);

            // Mettre à jour l'historique des prix
            if (!priceHistory[sym]) priceHistory[sym] = [];
            priceHistory[sym].push(price);
            if (priceHistory[sym].length > HISTORY_LENGTH) {
                priceHistory[sym].shift();
            }

            // Données de base
            const data = {
                sym,
                price,
                maxShares,
                longShares,
                longAvgPrice,
                shortShares,
                shortAvgPrice,
                owned: longShares > 0 || shortShares > 0,
                longValue: longShares * price,
                shortValue: shortShares * price,
                forecast: 0.5,
                volatility: 0.02,
                trend: 0,
            };

            // Données avancées si disponibles
            if (hasForecasting) {
                data.forecast = ns.stock.getForecast(sym);
                data.volatility = ns.stock.getVolatility(sym);
            }

            // Calculer le trend depuis l'historique
            data.trend = calculateTrend(priceHistory[sym]);

            // Calculer le profit/perte actuel
            if (longShares > 0) {
                data.longProfit = (price - longAvgPrice) * longShares;
                data.longProfitPercent = (price - longAvgPrice) / longAvgPrice;
            }
            if (shortShares > 0) {
                data.shortProfit = (shortAvgPrice - price) * shortShares;
                data.shortProfitPercent = (shortAvgPrice - price) / shortAvgPrice;
            }

            stockData.push(data);
        }

        // Trier par score combiné (forecast + trend)
        stockData.sort((a, b) => {
            const scoreA = a.forecast + a.trend * 0.5;
            const scoreB = b.forecast + b.trend * 0.5;
            return scoreB - scoreA;
        });

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  📈 STOCK MARKET AI v2.0");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Cash: $${formatMoney(money)}`);
        ns.print(`📊 Profit total: $${formatMoney(totalProfit)}`);
        ns.print(`🎯 Trades: ${tradesCount} (${winCount} gagnants)`);
        ns.print(`📡 Forecasting: ${hasForecasting ? "✅" : "❌"}`);
        ns.print("");

        // Compter les positions actuelles
        const currentPositions = stockData.filter(s => s.owned).length;

        // PHASE 1: Gestion des positions existantes (Stop-loss & Take-profit)
        for (const stock of stockData) {
            // Gestion LONG
            if (stock.longShares > 0) {
                let shouldSell = false;
                let reason = "";

                // Stop-loss
                if (stock.longProfitPercent <= -config.stopLossPercent) {
                    shouldSell = true;
                    reason = "STOP-LOSS";
                }
                // Take-profit
                else if (stock.longProfitPercent >= config.takeProfitPercent) {
                    shouldSell = true;
                    reason = "TAKE-PROFIT";
                }
                // Signal de vente (forecast + trend baissier)
                else if (hasForecasting && stock.forecast < config.sellThreshold && stock.trend < 0) {
                    shouldSell = true;
                    reason = "SIGNAL";
                }

                if (shouldSell) {
                    const salePrice = ns.stock.sellStock(stock.sym, stock.longShares);
                    if (salePrice > 0) {
                        const profit = stock.longProfit;
                        totalProfit += profit;
                        tradesCount++;
                        if (profit > 0) winCount++;
                        ns.print(`🔴 VENDU ${stock.sym} [${reason}]: ${profit >= 0 ? '+' : ''}$${formatMoney(profit)}`);
                        ns.toast(`Vendu ${stock.sym} (${reason})`, profit >= 0 ? "success" : "warning");
                    }
                }
            }

            // Gestion SHORT
            if (stock.shortShares > 0) {
                let shouldCover = false;
                let reason = "";

                // Stop-loss pour short (le prix monte)
                if (stock.shortProfitPercent <= -config.stopLossPercent) {
                    shouldCover = true;
                    reason = "STOP-LOSS";
                }
                // Take-profit pour short
                else if (stock.shortProfitPercent >= config.takeProfitPercent) {
                    shouldCover = true;
                    reason = "TAKE-PROFIT";
                }
                // Signal de couverture
                else if (hasForecasting && stock.forecast > config.buyThreshold && stock.trend > 0) {
                    shouldCover = true;
                    reason = "SIGNAL";
                }

                if (shouldCover) {
                    const salePrice = ns.stock.sellShort(stock.sym, stock.shortShares);
                    if (salePrice > 0) {
                        const profit = stock.shortProfit;
                        totalProfit += profit;
                        tradesCount++;
                        if (profit > 0) winCount++;
                        ns.print(`🟢 COVER ${stock.sym} [${reason}]: ${profit >= 0 ? '+' : ''}$${formatMoney(profit)}`);
                        ns.toast(`Cover ${stock.sym} (${reason})`, profit >= 0 ? "success" : "warning");
                    }
                }
            }
        }

        // PHASE 2: Nouvelles positions
        const cashToInvest = Math.max(0, money - config.minCash);
        const maxPerStock = cashToInvest * config.maxInvestmentPercent;

        // Recalculer les positions après les ventes
        const updatedPositions = stockData.filter(s =>
            ns.stock.getPosition(s.sym)[0] > 0 || ns.stock.getPosition(s.sym)[2] > 0
        ).length;

        for (const stock of stockData) {
            // Vérifier la limite de positions
            if (updatedPositions >= config.maxPositions) break;

            // Skip si déjà possédé
            const [currentLong, , currentShort] = ns.stock.getPosition(stock.sym);
            if (currentLong > 0 || currentShort > 0) continue;

            // Filtrer par volatilité
            if (stock.volatility < config.minVolatility || stock.volatility > config.maxVolatility) {
                continue;
            }

            // ACHAT LONG si forecast & trend haussiers
            if (hasForecasting && stock.forecast > config.buyThreshold && stock.trend >= 0) {
                // Position sizing basé sur la volatilité (moins volatile = plus de shares)
                const volatilityFactor = 1 - (stock.volatility / config.maxVolatility);
                const adjustedMax = maxPerStock * (0.5 + volatilityFactor * 0.5);

                const sharesToBuy = Math.min(
                    Math.floor(adjustedMax / stock.price),
                    Math.floor(stock.maxShares * 0.1) // Max 10% des shares dispo
                );

                if (sharesToBuy > 10 && sharesToBuy * stock.price < cashToInvest * 0.5) {
                    const cost = ns.stock.buyStock(stock.sym, sharesToBuy);
                    if (cost > 0) {
                        ns.print(`🟢 LONG ${stock.sym}: ${sharesToBuy} @ $${formatMoney(stock.price)}`);
                        ns.toast(`Acheté ${stock.sym}`, "success");
                    }
                }
            }
            // VENTE SHORT si forecast & trend très baissiers
            else if (hasForecasting && stock.forecast < config.sellThreshold - 0.05 && stock.trend < 0) {
                const volatilityFactor = 1 - (stock.volatility / config.maxVolatility);
                const adjustedMax = maxPerStock * (0.3 + volatilityFactor * 0.3); // Plus conservateur pour short

                const sharesToShort = Math.min(
                    Math.floor(adjustedMax / stock.price),
                    Math.floor(stock.maxShares * 0.05) // Max 5% des shares dispo
                );

                if (sharesToShort > 10 && sharesToShort * stock.price < cashToInvest * 0.3) {
                    try {
                        const cost = ns.stock.buyShort(stock.sym, sharesToShort);
                        if (cost > 0) {
                            ns.print(`🔴 SHORT ${stock.sym}: ${sharesToShort} @ $${formatMoney(stock.price)}`);
                            ns.toast(`Short ${stock.sym}`, "warning");
                        }
                    } catch (e) {
                        // Shorting non disponible
                    }
                }
            }
        }

        // Afficher le portfolio
        const portfolio = stockData.filter(s => {
            const [l, , sh] = ns.stock.getPosition(s.sym);
            return l > 0 || sh > 0;
        });

        if (portfolio.length > 0) {
            ns.print("");
            ns.print("📋 Portfolio:");
            let totalValue = 0;
            let totalUnrealizedPL = 0;

            for (const stock of portfolio) {
                const [longShares, longAvg, shortShares, shortAvg] = ns.stock.getPosition(stock.sym);

                if (longShares > 0) {
                    const value = longShares * stock.price;
                    const pl = (stock.price - longAvg) * longShares;
                    const plPercent = ((stock.price / longAvg) - 1) * 100;
                    totalValue += value;
                    totalUnrealizedPL += pl;
                    const icon = pl >= 0 ? "📈" : "📉";
                    ns.print(`   ${icon} ${stock.sym} LONG: $${formatMoney(value)} (${plPercent >= 0 ? '+' : ''}${plPercent.toFixed(1)}%)`);
                }
                if (shortShares > 0) {
                    const value = shortShares * stock.price;
                    const pl = (shortAvg - stock.price) * shortShares;
                    const plPercent = ((shortAvg / stock.price) - 1) * 100;
                    totalValue += value;
                    totalUnrealizedPL += pl;
                    const icon = pl >= 0 ? "📈" : "📉";
                    ns.print(`   ${icon} ${stock.sym} SHORT: $${formatMoney(value)} (${plPercent >= 0 ? '+' : ''}${plPercent.toFixed(1)}%)`);
                }
            }

            ns.print(`   ─────────────────────────`);
            ns.print(`   💼 Valeur: $${formatMoney(totalValue)}`);
            ns.print(`   📊 P/L non-réalisé: ${totalUnrealizedPL >= 0 ? '+' : ''}$${formatMoney(totalUnrealizedPL)}`);
        }

        // Top opportunités
        ns.print("");
        ns.print("🎯 Top opportunités:");
        for (const stock of stockData.slice(0, 5)) {
            const trendIcon = stock.trend > 0.01 ? "↗️" : stock.trend < -0.01 ? "↘️" : "➡️";
            const forecastText = hasForecasting ? `${(stock.forecast * 100).toFixed(0)}%` : "?";
            ns.print(`   ${trendIcon} ${stock.sym}: ${forecastText} (vol: ${(stock.volatility * 100).toFixed(1)}%)`);
        }

        // Feedback vers optimizer
        if (Date.now() - lastFeedbackTime > 30000) {
            sendFeedback(ns, "stocks", {
                profit: totalProfit,
                trades: tradesCount,
                winRate: tradesCount > 0 ? winCount / tradesCount : 0,
                positions: portfolio.length,
            });
            lastFeedbackTime = Date.now();
        }

        await ns.sleep(6000); // Cycle du marché = 6 secondes
    }
}

/**
 * Calculer le trend depuis l'historique des prix
 */
function calculateTrend(history) {
    if (!history || history.length < 4) return 0;

    const half = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, half);
    const secondHalf = history.slice(half);

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (avgFirst === 0) return 0;
    return (avgSecond - avgFirst) / avgFirst;
}

function formatMoney(n) {
    if (n >= 1e15) return (n / 1e15).toFixed(2) + "q";
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(0);
}
