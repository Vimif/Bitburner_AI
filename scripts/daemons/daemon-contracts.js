/**
 * Bitburner AI - Contracts Daemon (Lightweight)
 * RAM: ~5GB
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    let solved = 0;
    let failed = 0;

    while (true) {
        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  📝 CONTRACTS DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`✅ Résolus: ${solved} | ❌ Échecs: ${failed}`);
        ns.print("");

        // Scanner les serveurs
        const contracts = findContracts(ns);

        if (contracts.length > 0) {
            ns.print(`📋 Contrats trouvés: ${contracts.length}`);
            ns.print("");

            for (const c of contracts) {
                ns.print(`   📄 ${c.file} sur ${c.host}`);
                ns.print(`      Type: ${c.type}`);

                const answer = solveContract(ns, c.type, c.data);

                if (answer !== null) {
                    const result = ns.codingcontract.attempt(answer, c.file, c.host);
                    if (result) {
                        ns.print(`      ✅ Résolu! Récompense: ${result}`);
                        ns.toast(`Contract résolu: ${c.type}`, "success");
                        solved++;
                    } else {
                        ns.print(`      ❌ Mauvaise réponse`);
                        failed++;
                    }
                } else {
                    ns.print(`      ⏭️ Type non supporté`);
                }
            }
        } else {
            ns.print("🔍 Aucun contrat trouvé");
        }

        await ns.sleep(60000); // Check toutes les minutes
    }
}

function findContracts(ns) {
    const contracts = [];
    const visited = new Set();
    const queue = ["home"];

    while (queue.length > 0) {
        const host = queue.shift();
        if (visited.has(host)) continue;
        visited.add(host);

        const files = ns.ls(host, ".cct");
        for (const file of files) {
            contracts.push({
                file,
                host,
                type: ns.codingcontract.getContractType(file, host),
                data: ns.codingcontract.getData(file, host),
            });
        }

        for (const n of ns.scan(host)) {
            if (!visited.has(n)) queue.push(n);
        }
    }

    return contracts;
}

function solveContract(ns, type, data) {
    switch (type) {
        case "Find Largest Prime Factor":
            return largestPrimeFactor(data);
        case "Subarray with Maximum Sum":
            return maxSubarray(data);
        case "Total Ways to Sum":
            return waysToSum(data);
        case "Spiralize Matrix":
            return spiralize(data);
        case "Array Jumping Game":
            return arrayJump(data) ? 1 : 0;
        case "Merge Overlapping Intervals":
            return mergeIntervals(data);
        case "Generate IP Addresses":
            return generateIPs(data);
        case "Algorithmic Stock Trader I":
            return stockTrader1(data);
        case "Algorithmic Stock Trader II":
            return stockTrader2(data);
        case "Algorithmic Stock Trader III":
            return stockTrader3(data);
        case "Algorithmic Stock Trader IV":
            return stockTrader4(data[0], data[1]);
        case "Minimum Path Sum in a Triangle":
            return minPathTriangle(data);
        case "Unique Paths in a Grid I":
            return uniquePaths1(data[0], data[1]);
        case "Unique Paths in a Grid II":
            return uniquePaths2(data);
        case "Sanitize Parentheses in Expression":
            return sanitizeParens(data);
        case "Find All Valid Math Expressions":
            return findMathExpr(data[0], data[1]);
        default:
            return null;
    }
}

// Solver implementations
function largestPrimeFactor(n) {
    let factor = 2;
    while (factor * factor <= n) {
        while (n % factor === 0) n /= factor;
        factor++;
    }
    return n;
}

function maxSubarray(arr) {
    let max = arr[0], curr = arr[0];
    for (let i = 1; i < arr.length; i++) {
        curr = Math.max(arr[i], curr + arr[i]);
        max = Math.max(max, curr);
    }
    return max;
}

function waysToSum(n) {
    const dp = new Array(n + 1).fill(0);
    dp[0] = 1;
    for (let i = 1; i < n; i++) {
        for (let j = i; j <= n; j++) {
            dp[j] += dp[j - i];
        }
    }
    return dp[n];
}

function spiralize(matrix) {
    const result = [];
    while (matrix.length > 0) {
        result.push(...matrix.shift());
        for (const row of matrix) {
            if (row.length > 0) result.push(row.pop());
        }
        if (matrix.length > 0) result.push(...matrix.pop().reverse());
        for (let i = matrix.length - 1; i >= 0; i--) {
            if (matrix[i].length > 0) result.push(matrix[i].shift());
        }
    }
    return result;
}

function arrayJump(arr) {
    let max = 0;
    for (let i = 0; i < arr.length; i++) {
        if (i > max) return false;
        max = Math.max(max, i + arr[i]);
        if (max >= arr.length - 1) return true;
    }
    return max >= arr.length - 1;
}

function mergeIntervals(intervals) {
    intervals.sort((a, b) => a[0] - b[0]);
    const result = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
        const last = result[result.length - 1];
        if (intervals[i][0] <= last[1]) {
            last[1] = Math.max(last[1], intervals[i][1]);
        } else {
            result.push(intervals[i]);
        }
    }
    return result;
}

function generateIPs(s) {
    const result = [];
    for (let a = 1; a <= 3; a++) {
        for (let b = 1; b <= 3; b++) {
            for (let c = 1; c <= 3; c++) {
                const d = s.length - a - b - c;
                if (d < 1 || d > 3) continue;
                const parts = [s.slice(0, a), s.slice(a, a + b), s.slice(a + b, a + b + c), s.slice(a + b + c)];
                if (parts.every(p => parseInt(p) <= 255 && (p.length === 1 || p[0] !== "0"))) {
                    result.push(parts.join("."));
                }
            }
        }
    }
    return result;
}

function stockTrader1(prices) {
    let min = Infinity, max = 0;
    for (const p of prices) {
        min = Math.min(min, p);
        max = Math.max(max, p - min);
    }
    return max;
}

function stockTrader2(prices) {
    let profit = 0;
    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
    }
    return profit;
}

function stockTrader3(prices) {
    return stockTrader4(2, prices);
}

function stockTrader4(k, prices) {
    const n = prices.length;
    if (n === 0) return 0;
    if (k >= n / 2) return stockTrader2(prices);

    const dp = Array(k + 1).fill(0).map(() => Array(n).fill(0));
    for (let i = 1; i <= k; i++) {
        let max = -prices[0];
        for (let j = 1; j < n; j++) {
            dp[i][j] = Math.max(dp[i][j - 1], prices[j] + max);
            max = Math.max(max, dp[i - 1][j - 1] - prices[j]);
        }
    }
    return dp[k][n - 1];
}

function minPathTriangle(triangle) {
    const dp = [...triangle[triangle.length - 1]];
    for (let i = triangle.length - 2; i >= 0; i--) {
        for (let j = 0; j <= i; j++) {
            dp[j] = triangle[i][j] + Math.min(dp[j], dp[j + 1]);
        }
    }
    return dp[0];
}

function uniquePaths1(m, n) {
    const dp = Array(n).fill(1);
    for (let i = 1; i < m; i++) {
        for (let j = 1; j < n; j++) {
            dp[j] += dp[j - 1];
        }
    }
    return dp[n - 1];
}

function uniquePaths2(grid) {
    const m = grid.length, n = grid[0].length;
    const dp = Array(n).fill(0);
    dp[0] = 1;
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            if (grid[i][j] === 1) dp[j] = 0;
            else if (j > 0) dp[j] += dp[j - 1];
        }
    }
    return dp[n - 1];
}

function sanitizeParens(s) {
    let left = 0, right = 0;
    for (const c of s) {
        if (c === "(") left++;
        else if (c === ")") {
            if (left > 0) left--;
            else right++;
        }
    }

    const result = new Set();
    function dfs(idx, l, r, lrem, rrem, curr) {
        if (idx === s.length) {
            if (l === 0 && r === 0 && lrem === 0 && rrem === 0) result.add(curr);
            return;
        }
        const c = s[idx];
        if (c === "(") {
            if (lrem > 0) dfs(idx + 1, l, r, lrem - 1, rrem, curr);
            dfs(idx + 1, l + 1, r, lrem, rrem, curr + c);
        } else if (c === ")") {
            if (rrem > 0) dfs(idx + 1, l, r, lrem, rrem - 1, curr);
            if (l > 0) dfs(idx + 1, l - 1, r, lrem, rrem, curr + c);
        } else {
            dfs(idx + 1, l, r, lrem, rrem, curr + c);
        }
    }
    dfs(0, 0, 0, left, right, "");
    return [...result];
}

function findMathExpr(digits, target) {
    const result = [];
    function dfs(idx, expr, val, prev) {
        if (idx === digits.length) {
            if (val === target) result.push(expr);
            return;
        }
        for (let i = idx; i < digits.length; i++) {
            const str = digits.slice(idx, i + 1);
            if (str.length > 1 && str[0] === "0") break;
            const num = parseInt(str);
            if (idx === 0) {
                dfs(i + 1, str, num, num);
            } else {
                dfs(i + 1, expr + "+" + str, val + num, num);
                dfs(i + 1, expr + "-" + str, val - num, -num);
                dfs(i + 1, expr + "*" + str, val - prev + prev * num, prev * num);
            }
        }
    }
    dfs(0, "", 0, 0);
    return result;
}
