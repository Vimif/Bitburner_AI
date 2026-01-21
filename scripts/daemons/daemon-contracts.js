/**
 * Bitburner AI - Contracts Daemon
 * Résolution automatique des Coding Contracts
 * 
 * Scanne tous les serveurs pour trouver et résoudre les contrats
 * 
 * Usage: run daemon-contracts.js
 */

import { scanAll, formatMoney } from "../lib/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    let contractsSolved = 0;
    let rewardsEarned = [];

    while (true) {
        ns.clearLog();
        ns.print("═══════════════════════════════════════");
        ns.print("  📝 CONTRACTS DAEMON");
        ns.print("═══════════════════════════════════════");
        ns.print(`✅ Contrats résolus: ${contractsSolved}`);
        ns.print("");

        // Scanner tous les serveurs pour trouver des contrats
        const servers = scanAll(ns);
        const contracts = [];

        for (const host of servers) {
            const files = ns.ls(host, ".cct");
            for (const file of files) {
                contracts.push({ host, file });
            }
        }

        ns.print(`🔍 Contrats trouvés: ${contracts.length}`);
        ns.print("");

        if (contracts.length === 0) {
            ns.print("⏳ Aucun contrat disponible");
            ns.print("   Prochaine vérification dans 60s...");
            await ns.sleep(60000);
            continue;
        }

        // Traiter chaque contrat
        for (const contract of contracts) {
            const type = ns.codingcontract.getContractType(contract.file, contract.host);
            const data = ns.codingcontract.getData(contract.file, contract.host);
            const tries = ns.codingcontract.getNumTriesRemaining(contract.file, contract.host);

            ns.print(`📄 ${contract.file} @ ${contract.host}`);
            ns.print(`   Type: ${type}`);
            ns.print(`   Essais restants: ${tries}`);

            // Résoudre le contrat
            const solution = solveContract(type, data);

            if (solution !== null) {
                const reward = ns.codingcontract.attempt(solution, contract.file, contract.host);

                if (reward) {
                    ns.print(`   ✅ Résolu! Récompense: ${reward}`);
                    ns.toast(`Contrat résolu: ${type}`, "success", 5000);
                    contractsSolved++;
                    rewardsEarned.push(reward);
                } else {
                    ns.print(`   ❌ Solution incorrecte`);
                }
            } else {
                ns.print(`   ⚠️ Type non supporté`);
            }
            ns.print("");
        }

        await ns.sleep(30000);
    }
}

/**
 * Résoudre un contrat selon son type
 */
function solveContract(type, data) {
    switch (type) {
        case "Find Largest Prime Factor":
            return largestPrimeFactor(data);

        case "Subarray with Maximum Sum":
            return maxSubarraySum(data);

        case "Total Ways to Sum":
            return totalWaysToSum(data);

        case "Total Ways to Sum II":
            return totalWaysToSumII(data);

        case "Spiralize Matrix":
            return spiralizeMatrix(data);

        case "Array Jumping Game":
            return arrayJumpingGame(data);

        case "Array Jumping Game II":
            return arrayJumpingGameII(data);

        case "Merge Overlapping Intervals":
            return mergeIntervals(data);

        case "Generate IP Addresses":
            return generateIPs(data);

        case "Algorithmic Stock Trader I":
            return stockTraderI(data);

        case "Algorithmic Stock Trader II":
            return stockTraderII(data);

        case "Algorithmic Stock Trader III":
            return stockTraderIII(data);

        case "Algorithmic Stock Trader IV":
            return stockTraderIV(data);

        case "Minimum Path Sum in a Triangle":
            return minPathTriangle(data);

        case "Unique Paths in a Grid I":
            return uniquePathsI(data);

        case "Unique Paths in a Grid II":
            return uniquePathsII(data);

        case "Shortest Path in a Grid":
            return shortestPath(data);

        case "Sanitize Parentheses in Expression":
            return sanitizeParentheses(data);

        case "Find All Valid Math Expressions":
            return validMathExpressions(data);

        case "HammingCodes: Integer to Encoded Binary":
            return hammingEncode(data);

        case "HammingCodes: Encoded Binary to Integer":
            return hammingDecode(data);

        case "Proper 2-Coloring of a Graph":
            return twoColorGraph(data);

        case "Compression I: RLE Compression":
            return rleCompress(data);

        case "Compression II: LZ Decompression":
            return lzDecompress(data);

        case "Compression III: LZ Compression":
            return lzCompress(data);

        case "Encryption I: Caesar Cipher":
            return caesarCipher(data);

        case "Encryption II: Vigenère Cipher":
            return vigenereCipher(data);

        default:
            return null;
    }
}

// ==================== SOLUTIONS ====================

function largestPrimeFactor(n) {
    let factor = 2;
    while (factor * factor <= n) {
        while (n % factor === 0) {
            n /= factor;
        }
        factor++;
    }
    return n;
}

function maxSubarraySum(arr) {
    let maxSum = arr[0];
    let currentSum = arr[0];

    for (let i = 1; i < arr.length; i++) {
        currentSum = Math.max(arr[i], currentSum + arr[i]);
        maxSum = Math.max(maxSum, currentSum);
    }

    return maxSum;
}

function totalWaysToSum(n) {
    const dp = new Array(n + 1).fill(0);
    dp[0] = 1;

    for (let i = 1; i < n; i++) {
        for (let j = i; j <= n; j++) {
            dp[j] += dp[j - i];
        }
    }

    return dp[n];
}

function totalWaysToSumII([n, nums]) {
    const dp = new Array(n + 1).fill(0);
    dp[0] = 1;

    for (const num of nums) {
        for (let j = num; j <= n; j++) {
            dp[j] += dp[j - num];
        }
    }

    return dp[n];
}

function spiralizeMatrix(matrix) {
    const result = [];
    if (matrix.length === 0) return result;

    let top = 0, bottom = matrix.length - 1;
    let left = 0, right = matrix[0].length - 1;

    while (top <= bottom && left <= right) {
        for (let i = left; i <= right; i++) result.push(matrix[top][i]);
        top++;

        for (let i = top; i <= bottom; i++) result.push(matrix[i][right]);
        right--;

        if (top <= bottom) {
            for (let i = right; i >= left; i--) result.push(matrix[bottom][i]);
            bottom--;
        }

        if (left <= right) {
            for (let i = bottom; i >= top; i--) result.push(matrix[i][left]);
            left++;
        }
    }

    return result;
}

function arrayJumpingGame(arr) {
    let maxReach = 0;

    for (let i = 0; i < arr.length && i <= maxReach; i++) {
        maxReach = Math.max(maxReach, i + arr[i]);
        if (maxReach >= arr.length - 1) return 1;
    }

    return 0;
}

function arrayJumpingGameII(arr) {
    if (arr.length <= 1) return 0;

    let jumps = 0;
    let currentEnd = 0;
    let farthest = 0;

    for (let i = 0; i < arr.length - 1; i++) {
        farthest = Math.max(farthest, i + arr[i]);

        if (i === currentEnd) {
            jumps++;
            currentEnd = farthest;

            if (currentEnd >= arr.length - 1) return jumps;
        }
    }

    return 0;
}

function mergeIntervals(intervals) {
    if (intervals.length === 0) return [];

    intervals.sort((a, b) => a[0] - b[0]);

    const result = [intervals[0]];

    for (let i = 1; i < intervals.length; i++) {
        const last = result[result.length - 1];
        const current = intervals[i];

        if (current[0] <= last[1]) {
            last[1] = Math.max(last[1], current[1]);
        } else {
            result.push(current);
        }
    }

    return result;
}

function generateIPs(str) {
    const result = [];

    function isValid(s) {
        if (s.length > 1 && s[0] === '0') return false;
        const num = parseInt(s);
        return num >= 0 && num <= 255;
    }

    for (let i = 1; i <= 3 && i < str.length; i++) {
        for (let j = i + 1; j <= i + 3 && j < str.length; j++) {
            for (let k = j + 1; k <= j + 3 && k < str.length; k++) {
                const p1 = str.slice(0, i);
                const p2 = str.slice(i, j);
                const p3 = str.slice(j, k);
                const p4 = str.slice(k);

                if (p4.length > 3) continue;

                if (isValid(p1) && isValid(p2) && isValid(p3) && isValid(p4)) {
                    result.push(`${p1}.${p2}.${p3}.${p4}`);
                }
            }
        }
    }

    return result;
}

function stockTraderI(prices) {
    let maxProfit = 0;
    let minPrice = prices[0];

    for (let i = 1; i < prices.length; i++) {
        maxProfit = Math.max(maxProfit, prices[i] - minPrice);
        minPrice = Math.min(minPrice, prices[i]);
    }

    return maxProfit;
}

function stockTraderII(prices) {
    let profit = 0;

    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > prices[i - 1]) {
            profit += prices[i] - prices[i - 1];
        }
    }

    return profit;
}

function stockTraderIII(prices) {
    const n = prices.length;
    if (n === 0) return 0;

    const dp = Array(3).fill(0).map(() => Array(n).fill(0));

    for (let k = 1; k <= 2; k++) {
        let maxDiff = -prices[0];
        for (let i = 1; i < n; i++) {
            dp[k][i] = Math.max(dp[k][i - 1], prices[i] + maxDiff);
            maxDiff = Math.max(maxDiff, dp[k - 1][i] - prices[i]);
        }
    }

    return dp[2][n - 1];
}

function stockTraderIV([k, prices]) {
    const n = prices.length;
    if (n === 0 || k === 0) return 0;

    if (k >= n / 2) return stockTraderII(prices);

    const dp = Array(k + 1).fill(0).map(() => Array(n).fill(0));

    for (let t = 1; t <= k; t++) {
        let maxDiff = -prices[0];
        for (let i = 1; i < n; i++) {
            dp[t][i] = Math.max(dp[t][i - 1], prices[i] + maxDiff);
            maxDiff = Math.max(maxDiff, dp[t - 1][i] - prices[i]);
        }
    }

    return dp[k][n - 1];
}

function minPathTriangle(triangle) {
    const n = triangle.length;
    const dp = [...triangle[n - 1]];

    for (let i = n - 2; i >= 0; i--) {
        for (let j = 0; j <= i; j++) {
            dp[j] = triangle[i][j] + Math.min(dp[j], dp[j + 1]);
        }
    }

    return dp[0];
}

function uniquePathsI([rows, cols]) {
    const dp = Array(rows).fill(0).map(() => Array(cols).fill(1));

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
        }
    }

    return dp[rows - 1][cols - 1];
}

function uniquePathsII(grid) {
    const rows = grid.length;
    const cols = grid[0].length;

    if (grid[0][0] === 1 || grid[rows - 1][cols - 1] === 1) return 0;

    const dp = Array(rows).fill(0).map(() => Array(cols).fill(0));
    dp[0][0] = 1;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (grid[i][j] === 1) {
                dp[i][j] = 0;
            } else {
                if (i > 0) dp[i][j] += dp[i - 1][j];
                if (j > 0) dp[i][j] += dp[i][j - 1];
            }
        }
    }

    return dp[rows - 1][cols - 1];
}

function shortestPath(grid) {
    const rows = grid.length;
    const cols = grid[0].length;

    if (grid[0][0] === 1 || grid[rows - 1][cols - 1] === 1) return "";

    const queue = [[0, 0, ""]];
    const visited = new Set();
    visited.add("0,0");

    const dirs = [[-1, 0, "U"], [1, 0, "D"], [0, -1, "L"], [0, 1, "R"]];

    while (queue.length > 0) {
        const [r, c, path] = queue.shift();

        if (r === rows - 1 && c === cols - 1) return path;

        for (const [dr, dc, dir] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            const key = `${nr},${nc}`;

            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                grid[nr][nc] === 0 && !visited.has(key)) {
                visited.add(key);
                queue.push([nr, nc, path + dir]);
            }
        }
    }

    return "";
}

function sanitizeParentheses(str) {
    const result = [];
    let minRemove = Infinity;

    function isValid(s) {
        let count = 0;
        for (const c of s) {
            if (c === '(') count++;
            else if (c === ')') count--;
            if (count < 0) return false;
        }
        return count === 0;
    }

    function backtrack(index, current, removals) {
        if (removals > minRemove) return;

        if (index === str.length) {
            if (isValid(current)) {
                if (removals < minRemove) {
                    minRemove = removals;
                    result.length = 0;
                }
                if (!result.includes(current)) {
                    result.push(current);
                }
            }
            return;
        }

        const c = str[index];

        if (c !== '(' && c !== ')') {
            backtrack(index + 1, current + c, removals);
        } else {
            // Skip this parenthesis
            backtrack(index + 1, current, removals + 1);
            // Keep this parenthesis
            backtrack(index + 1, current + c, removals);
        }
    }

    backtrack(0, "", 0);
    return result.length > 0 ? result : [""];
}

function validMathExpressions([digits, target]) {
    const result = [];

    function backtrack(index, expr, value, prev) {
        if (index === digits.length) {
            if (value === target) {
                result.push(expr);
            }
            return;
        }

        for (let i = index; i < digits.length; i++) {
            if (i > index && digits[index] === '0') break;

            const numStr = digits.slice(index, i + 1);
            const num = parseInt(numStr);

            if (index === 0) {
                backtrack(i + 1, numStr, num, num);
            } else {
                backtrack(i + 1, expr + '+' + numStr, value + num, num);
                backtrack(i + 1, expr + '-' + numStr, value - num, -num);
                backtrack(i + 1, expr + '*' + numStr, value - prev + prev * num, prev * num);
            }
        }
    }

    backtrack(0, "", 0, 0);
    return result;
}

function hammingEncode(n) {
    const binary = n.toString(2);
    const d = binary.split('').map(b => parseInt(b));

    // Calculate total bits needed
    let r = 0;
    while ((1 << r) < d.length + r + 1) r++;

    const encoded = new Array(d.length + r + 1).fill(0);
    let j = 0;

    // Place data bits
    for (let i = 1; i < encoded.length; i++) {
        if ((i & (i - 1)) !== 0) {
            encoded[i] = d[j++];
        }
    }

    // Calculate parity bits
    for (let i = 0; i < r; i++) {
        const pos = 1 << i;
        let parity = 0;
        for (let j = pos; j < encoded.length; j++) {
            if (j & pos) parity ^= encoded[j];
        }
        encoded[pos] = parity;
    }

    // Overall parity
    encoded[0] = encoded.reduce((a, b) => a ^ b, 0);

    return encoded.join('');
}

function hammingDecode(str) {
    const bits = str.split('').map(b => parseInt(b));

    // Find error position
    let errorPos = 0;
    for (let i = 0; (1 << i) < bits.length; i++) {
        const pos = 1 << i;
        let parity = 0;
        for (let j = pos; j < bits.length; j++) {
            if (j & pos) parity ^= bits[j];
        }
        if (parity !== 0) errorPos += pos;
    }

    // Fix error
    if (errorPos > 0 && errorPos < bits.length) {
        bits[errorPos] ^= 1;
    }

    // Extract data bits
    let result = '';
    for (let i = 1; i < bits.length; i++) {
        if ((i & (i - 1)) !== 0) {
            result += bits[i];
        }
    }

    return parseInt(result, 2);
}

function twoColorGraph([n, edges]) {
    const adj = Array(n).fill(null).map(() => []);
    for (const [u, v] of edges) {
        adj[u].push(v);
        adj[v].push(u);
    }

    const colors = new Array(n).fill(-1);

    for (let start = 0; start < n; start++) {
        if (colors[start] !== -1) continue;

        const queue = [start];
        colors[start] = 0;

        while (queue.length > 0) {
            const node = queue.shift();

            for (const neighbor of adj[node]) {
                if (colors[neighbor] === -1) {
                    colors[neighbor] = 1 - colors[node];
                    queue.push(neighbor);
                } else if (colors[neighbor] === colors[node]) {
                    return [];
                }
            }
        }
    }

    return colors;
}

function rleCompress(str) {
    let result = '';
    let i = 0;

    while (i < str.length) {
        let count = 1;
        while (i + count < str.length && str[i] === str[i + count] && count < 9) {
            count++;
        }
        result += count.toString() + str[i];
        i += count;
    }

    return result;
}

function lzDecompress(str) {
    let result = '';
    let i = 0;

    while (i < str.length) {
        const len = parseInt(str[i]);

        if (len === 0) {
            i++;
            continue;
        }

        if (i % 2 === 0) {
            // Literal
            result += str.slice(i + 1, i + 1 + len);
            i += 1 + len;
        } else {
            // Reference
            const offset = parseInt(str[i + 1]);
            for (let j = 0; j < len; j++) {
                result += result[result.length - offset];
            }
            i += 2;
        }
    }

    return result;
}

function lzCompress(str) {
    // Simplified LZ compression
    let result = '';
    let i = 0;

    while (i < str.length) {
        let bestLen = 0;
        let bestOffset = 0;

        // Look for matches in the previous 9 characters
        for (let offset = 1; offset <= Math.min(9, i); offset++) {
            let len = 0;
            while (i + len < str.length && len < 9 &&
                str[i + len] === str[i - offset + (len % offset)]) {
                len++;
            }
            if (len > bestLen) {
                bestLen = len;
                bestOffset = offset;
            }
        }

        if (bestLen >= 2) {
            // Use reference
            if (result.length % 2 === 0) result += '0';
            result += bestLen.toString() + bestOffset.toString();
            i += bestLen;
        } else {
            // Use literal
            let litLen = 0;
            let litStart = i;

            while (i < str.length && litLen < 9) {
                i++;
                litLen++;
            }

            if (result.length % 2 === 1) result += '0';
            result += litLen.toString() + str.slice(litStart, litStart + litLen);
        }
    }

    return result;
}

function caesarCipher([str, shift]) {
    let result = '';

    for (const c of str) {
        if (c >= 'A' && c <= 'Z') {
            const code = ((c.charCodeAt(0) - 65 - shift % 26 + 26) % 26) + 65;
            result += String.fromCharCode(code);
        } else {
            result += c;
        }
    }

    return result;
}

function vigenereCipher([str, key]) {
    let result = '';
    let keyIndex = 0;

    for (const c of str) {
        if (c >= 'A' && c <= 'Z') {
            const shift = key.charCodeAt(keyIndex % key.length) - 65;
            const code = ((c.charCodeAt(0) - 65 + shift) % 26) + 65;
            result += String.fromCharCode(code);
            keyIndex++;
        } else {
            result += c;
        }
    }

    return result;
}
