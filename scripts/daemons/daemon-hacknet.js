/**
 * Bitburner AI - Hacknet Daemon (Lightweight)
 * RAM: ~4GB
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const MAX_ROI = 3600; // 1 heure max ROI
    const MAX_INVEST = 0.3; // 30% du cash

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const nodes = ns.hacknet.numNodes();
        const maxInvest = money * MAX_INVEST;

        // Calculer production
        let totalProd = 0;
        for (let i = 0; i < nodes; i++) {
            totalProd += ns.hacknet.getNodeStats(i).production;
        }

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🌐 HACKNET DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: ${formatMoney(money)}`);
        ns.print(`🌐 Nodes: ${nodes}`);
        ns.print(`📈 Production: ${formatMoney(totalProd)}/sec`);
        ns.print("");

        // Collecter les actions possibles
        const actions = [];

        // Nouveau node
        const nodeCost = ns.hacknet.getPurchaseNodeCost();
        if (nodeCost <= maxInvest && nodeCost < Infinity) {
            const estProd = 1; // Production estimée d'un nouveau node
            const roi = nodeCost / estProd;
            if (roi < MAX_ROI) {
                actions.push({ type: "buy", cost: nodeCost, roi, desc: `Node #${nodes}` });
            }
        }

        // Upgrades
        for (let i = 0; i < nodes; i++) {
            const stats = ns.hacknet.getNodeStats(i);
            const prod = stats.production;

            // Level
            const lCost = ns.hacknet.getLevelUpgradeCost(i, 1);
            if (lCost <= maxInvest && lCost < Infinity) {
                const gain = prod * 0.016;
                const roi = gain > 0 ? lCost / gain : Infinity;
                if (roi < MAX_ROI) {
                    actions.push({
                        type: "level", node: i, cost: lCost, roi,
                        desc: `Node ${i} Level ${stats.level + 1}`
                    });
                }
            }

            // RAM
            const rCost = ns.hacknet.getRamUpgradeCost(i, 1);
            if (rCost <= maxInvest && rCost < Infinity) {
                const gain = prod * 0.07;
                const roi = gain > 0 ? rCost / gain : Infinity;
                if (roi < MAX_ROI) {
                    actions.push({
                        type: "ram", node: i, cost: rCost, roi,
                        desc: `Node ${i} RAM ${stats.ram * 2}GB`
                    });
                }
            }

            // Core
            const cCost = ns.hacknet.getCoreUpgradeCost(i, 1);
            if (cCost <= maxInvest && cCost < Infinity) {
                const gain = prod * 0.1;
                const roi = gain > 0 ? cCost / gain : Infinity;
                if (roi < MAX_ROI) {
                    actions.push({
                        type: "core", node: i, cost: cCost, roi,
                        desc: `Node ${i} Core ${stats.cores + 1}`
                    });
                }
            }
        }

        // Trier par ROI
        actions.sort((a, b) => a.roi - b.roi);

        // Afficher top actions
        if (actions.length > 0) {
            ns.print("📊 Meilleures options:");
            for (const a of actions.slice(0, 3)) {
                ns.print(`   ${a.desc}: ${formatMoney(a.cost)}`);
            }
            ns.print("");

            // Exécuter la meilleure
            const best = actions[0];
            if (money >= best.cost) {
                let success = false;
                switch (best.type) {
                    case "buy": success = ns.hacknet.purchaseNode() !== -1; break;
                    case "level": success = ns.hacknet.upgradeLevel(best.node, 1); break;
                    case "ram": success = ns.hacknet.upgradeRam(best.node, 1); break;
                    case "core": success = ns.hacknet.upgradeCore(best.node, 1); break;
                }
                if (success) {
                    ns.print(`✅ ${best.desc}`);
                    ns.toast(`Hacknet: ${best.desc}`, "success", 2000);
                }
            }
        } else {
            ns.print("⏳ Aucune action rentable");
        }

        await ns.sleep(5000);
    }
}

function formatMoney(n) {
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "k";
    return "$" + n.toFixed(0);
}
