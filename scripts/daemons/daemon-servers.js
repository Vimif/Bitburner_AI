/**
 * Bitburner AI - Server Daemon (Lightweight)
 * RAM: ~4GB
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const PREFIX = "pserv-";
    const MAX_SERVERS = 25;
    const COST_MULT = 2;

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const owned = ns.getPurchasedServers();

        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  🖥️ SERVER DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`💰 Argent: ${formatMoney(money)}`);
        ns.print(`🖥️ Serveurs: ${owned.length}/${MAX_SERVERS}`);
        ns.print("");

        // Afficher serveurs
        if (owned.length > 0) {
            const sorted = [...owned].sort((a, b) =>
                ns.getServerMaxRam(b) - ns.getServerMaxRam(a));

            ns.print("📋 Top serveurs:");
            for (const s of sorted.slice(0, 5)) {
                const ram = ns.getServerMaxRam(s);
                ns.print(`   ${s}: ${formatRam(ram)}`);
            }
            if (owned.length > 5) ns.print(`   ... +${owned.length - 5} autres`);
            ns.print("");
        }

        if (owned.length < MAX_SERVERS) {
            // Acheter
            const ram = getOptimalRam(ns, money / COST_MULT);
            if (ram >= 8) {
                const cost = ns.getPurchasedServerCost(ram);
                if (money >= cost * COST_MULT) {
                    const name = `${PREFIX}${owned.length}`;
                    const s = ns.purchaseServer(name, ram);
                    if (s) {
                        ns.print(`✅ Acheté: ${s} (${formatRam(ram)})`);
                        ns.toast(`Serveur: ${s}`, "success");
                        deployWorkers(ns, s);
                    }
                } else {
                    ns.print(`⏳ Prochain: ${formatRam(ram)} = ${formatMoney(cost)}`);
                }
            }
        } else {
            // Upgrader
            let minRam = Infinity, target = null;
            for (const s of owned) {
                const r = ns.getServerMaxRam(s);
                if (r < minRam && r < 1048576) {
                    minRam = r;
                    target = s;
                }
            }

            if (target) {
                const newRam = minRam * 2;
                const cost = ns.getPurchasedServerCost(newRam);

                if (money >= cost * COST_MULT) {
                    ns.killall(target);
                    ns.deleteServer(target);
                    const s = ns.purchaseServer(target, newRam);
                    if (s) {
                        ns.print(`⬆️ Upgrade: ${formatRam(minRam)} → ${formatRam(newRam)}`);
                        ns.toast(`Upgrade: ${s}`, "success");
                        deployWorkers(ns, s);
                    }
                } else {
                    ns.print(`⏳ Upgrade: ${formatRam(newRam)} = ${formatMoney(cost)}`);
                }
            } else {
                ns.print("🎉 Tous les serveurs au max!");
            }
        }

        await ns.sleep(10000);
    }
}

function getOptimalRam(ns, money) {
    let ram = 8;
    while (ram * 2 <= 1048576) {
        if (ns.getPurchasedServerCost(ram * 2) > money) break;
        ram *= 2;
    }
    return ram;
}

function deployWorkers(ns, host) {
    const files = ["/workers/hack.js", "/workers/grow.js", "/workers/weaken.js"];
    ns.scp(files, host, "home");
}

function formatMoney(n) {
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(2) + "k";
    return "$" + n.toFixed(0);
}

function formatRam(gb) {
    if (gb >= 1024) return (gb / 1024).toFixed(0) + "TB";
    return gb + "GB";
}
