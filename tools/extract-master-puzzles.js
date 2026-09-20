const fs = require('fs');

const sourcePath = process.argv[2];
const requestedCount = Number(process.argv[3] || 100);

if (!sourcePath) {
    throw new Error('Usage: node tools/extract-master-puzzles.js <diabolical.txt> [count]');
}

function solveAndCount(puzzle, limit = 2) {
    const grid = puzzle.split('').map(Number);
    const rows = Array(9).fill(0);
    const cols = Array(9).fill(0);
    const boxes = Array(9).fill(0);
    const fullMask = 0x3FE;
    let count = 0;
    let firstSolution = null;

    for (let index = 0; index < 81; index++) {
        const value = grid[index];
        if (!value) continue;
        const row = Math.floor(index / 9);
        const col = index % 9;
        const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
        const bit = 1 << value;
        if ((rows[row] | cols[col] | boxes[box]) & bit) return { count: 0, solution: null };
        rows[row] |= bit;
        cols[col] |= bit;
        boxes[box] |= bit;
    }

    function search() {
        if (count >= limit) return;
        let bestIndex = -1;
        let bestMask = 0;
        let bestCount = 10;

        for (let index = 0; index < 81; index++) {
            if (grid[index]) continue;
            const row = Math.floor(index / 9);
            const col = index % 9;
            const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
            const mask = fullMask & ~(rows[row] | cols[col] | boxes[box]);
            let optionCount = 0;
            for (let bits = mask; bits; bits &= bits - 1) optionCount++;
            if (!optionCount) return;
            if (optionCount < bestCount) {
                bestIndex = index;
                bestMask = mask;
                bestCount = optionCount;
                if (optionCount === 1) break;
            }
        }

        if (bestIndex === -1) {
            count++;
            if (!firstSolution) firstSolution = grid.join('');
            return;
        }

        const row = Math.floor(bestIndex / 9);
        const col = bestIndex % 9;
        const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
        for (let choices = bestMask; choices; choices &= choices - 1) {
            const bit = choices & -choices;
            const value = 31 - Math.clz32(bit);
            grid[bestIndex] = value;
            rows[row] |= bit;
            cols[col] |= bit;
            boxes[box] |= bit;
            search();
            rows[row] ^= bit;
            cols[col] ^= bit;
            boxes[box] ^= bit;
            grid[bestIndex] = 0;
            if (count >= limit) return;
        }
    }

    search();
    return { count, solution: firstSolution };
}

const records = fs.readFileSync(sourcePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
        const match = line.match(/^\S+\s+([0-9]{81})\s+([0-9]+(?:\.[0-9]+)?)$/);
        return match ? { p: match[1], r: Number(match[2]) } : null;
    })
    .filter(record => record && record.r >= 6.2)
    .sort((a, b) => b.r - a.r || a.p.localeCompare(b.p));

// Sample across the full rating range instead of taking only one difficulty cluster.
const selected = [];
const used = new Set();
for (let i = 0; i < requestedCount; i++) {
    const index = Math.round(i * (records.length - 1) / Math.max(1, requestedCount - 1));
    const record = records[index];
    if (!record || used.has(record.p)) continue;
    const result = solveAndCount(record.p);
    if (result.count !== 1 || !result.solution) continue;
    used.add(record.p);
    selected.push({ p: record.p, s: result.solution, r: record.r });
}

if (selected.length !== requestedCount) {
    throw new Error(`Expected ${requestedCount} verified puzzles; selected ${selected.length}.`);
}

console.log(JSON.stringify(selected));
