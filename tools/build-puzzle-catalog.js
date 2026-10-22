// Offline builder for the validated puzzle catalog (Easy / Medium / Hard / Expert).
// Every puzzle written is: uniquely solvable, solved by the Sarp solver, rated in the
// tier's SE band, and inside the tier's clue-count window. Master uses master-puzzles.js.
//
// Usage: node tools/build-puzzle-catalog.js [perTier=100]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(root, 'sarp-solver.js'), 'utf8'), { filename: 'sarp-solver.js' });
const solver = new SarpSolver();

// Keep in sync with DIFFICULTY_PRESETS in script.js. Clue windows are disjoint and
// strictly decreasing so a higher tier never has more givens than a lower one.
const TIERS = {
    easy:   { minRating: 0,   maxRating: 2.3, minClues: 36, maxClues: 46 },
    medium: { minRating: 2.6, maxRating: 2.8, minClues: 29, maxClues: 35 },
    hard:   { minRating: 3.0, maxRating: 4.0, minClues: 25, maxClues: 28 },
    expert: { minRating: 4.2, maxRating: 6.0, minClues: 21, maxClues: 24 }
};
const perTier = Number(process.argv[2] || 100);

const rand = n => Math.floor(Math.random() * n);
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

function countSolutions(grid, limit = 2, fillFirst) {
    const g = grid.slice();
    const rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
    let count = 0, first = null;
    for (let i = 0; i < 81; i++) {
        if (!g[i]) continue;
        const bit = 1 << g[i], r = (i / 9) | 0, c = i % 9, b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
        if ((rows[r] | cols[c] | boxes[b]) & bit) return { count: 0, solution: null };
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
    }
    (function search() {
        if (count >= limit) return;
        let best = -1, bestMask = 0, bestN = 10;
        for (let i = 0; i < 81; i++) {
            if (g[i]) continue;
            const r = (i / 9) | 0, c = i % 9, b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
            const mask = 0x3FE & ~(rows[r] | cols[c] | boxes[b]);
            let n = 0; for (let m = mask; m; m &= m - 1) n++;
            if (!n) return;
            if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n === 1) break; }
        }
        if (best === -1) { count++; if (!first) first = g.join(''); return; }
        const r = (best / 9) | 0, c = best % 9, b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
        let choices = bestMask;
        if (fillFirst) { // randomised value order for solution generation
            const vals = []; for (let m = choices; m; m &= m - 1) vals.push(31 - Math.clz32(m & -m));
            shuffle(vals);
            for (const v of vals) {
                const bit = 1 << v;
                g[best] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
                search();
                rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit; g[best] = 0;
                if (count >= limit) return;
            }
            return;
        }
        for (; choices; choices &= choices - 1) {
            const bit = choices & -choices, v = 31 - Math.clz32(bit);
            g[best] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
            search();
            rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit; g[best] = 0;
            if (count >= limit) return;
        }
    })();
    return { count, solution: first };
}

function randomSolution() {
    return countSolutions(Array(81).fill(0), 1, true).solution;
}

function carve(solution, targetClues) {
    const g = solution.split('').map(Number);
    let clues = 81;
    for (const i of shuffle([...Array(81).keys()])) {
        if (clues <= targetClues) break;
        const v = g[i];
        g[i] = 0;
        if (countSolutions(g, 2).count === 1) clues--; else g[i] = v;
    }
    return clues === targetClues ? g.join('') : null;
}

function rate(puzzle) {
    const grid = Array.from({ length: 9 }, (_, r) => puzzle.slice(r * 9, r * 9 + 9).split('').map(Number));
    const grade = solver.solve(grid);
    return grade.solved ? grade.maxStepDifficulty : null;
}

const catalog = {};
const seen = new Set();
for (const [tier, spec] of Object.entries(TIERS)) {
    catalog[tier] = [];
    const started = Date.now();
    let tried = 0;
    while (catalog[tier].length < perTier) {
        tried++;
        const target = spec.minClues + rand(spec.maxClues - spec.minClues + 1);
        const solution = randomSolution();
        const puzzle = carve(solution, target);
        if (!puzzle || seen.has(puzzle)) continue;
        const r = rate(puzzle);
        if (r === null || r < spec.minRating || r > spec.maxRating) continue;
        seen.add(puzzle);
        catalog[tier].push({ p: puzzle, s: countSolutions(puzzle.split('').map(Number), 1).solution, r });
        if (catalog[tier].length % 10 === 0) {
            console.error(`${tier}: ${catalog[tier].length}/${perTier} (${tried} tried, ${((Date.now() - started) / 1000).toFixed(0)}s)`);
        }
    }
    catalog[tier].sort((a, b) => a.r - b.r || b.p.split('0').length - a.p.split('0').length);
}

const out = '// Generated by tools/build-puzzle-catalog.js - do not edit by hand.\n' +
    '// Every puzzle is uniquely solvable, logically solvable, and rated inside its tier band.\n' +
    'const VALIDATED_PUZZLE_CATALOG = Object.freeze(' + JSON.stringify(catalog) + ');\n' +
    "if (typeof module !== 'undefined') module.exports = VALIDATED_PUZZLE_CATALOG;\n";
fs.writeFileSync(path.join(root, 'puzzle-catalog.js'), out);
console.error('Wrote puzzle-catalog.js');
