// Offline builder for the validated puzzle catalog (Easy / Medium / Hard / Expert).
// Every puzzle written is: uniquely solvable, solved by the Sarp solver, rated in the
// tier's SE band, and inside the tier's clue-count window. Master uses master-puzzles.js.
//
// Usage: node tools/build-puzzle-catalog.js [perLevel=100] [tier]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(root, 'sarp-solver.js'), 'utf8'), { filename: 'sarp-solver.js' });
const solver = new SarpSolver();

// Sub-levels (I/II/III) inside each tier. A puzzle belongs to a level when its metrics
// (measured with the Sarp solver's cheapest-technique-first path) satisfy the spec:
//   max  = hardest technique rating      ns = number of non-single steps
//   hs   = number of Hidden Single steps (the solver prefers Naked Singles first,
//          so a Hidden Single step means the player really has to scan for one)
// Each rung changes ONE thing: Easy I->II fewer clues, Easy II->III hidden singles,
// Medium I->II first locked-candidate step, II->III more of them, etc.
// Keep tier names in sync with DIFFICULTY_PRESETS in script.js.
const LEVELS = {
    easy: [
        { clues: [42, 46], ok: m => m.ns === 0 && m.hs <= 1 },
        { clues: [36, 41], ok: m => m.ns === 0 && m.hs <= 2 },
        { clues: [34, 40], ok: m => m.ns === 0 && m.hs >= 3 && m.hs <= 8 }
    ],
    medium: [
        { clues: [30, 35], ok: m => m.ns === 0 && m.hs >= 8 },
        { clues: [29, 34], ok: m => m.ns === 1 && m.max === 2.6 },
        { clues: [28, 33], ok: m => m.ns >= 2 && m.ns <= 3 && m.max >= 2.6 && m.max <= 2.8 }
    ],
    hard: [
        { clues: [26, 30], ok: m => m.max === 3.0 && m.ns >= 1 && m.ns <= 2 },
        { clues: [25, 29], ok: m => m.max === 3.0 && m.ns >= 3 && m.ns <= 5 },
        { clues: [24, 28], ok: m => m.max >= 3.2 && m.max <= 4.0 && m.ns <= 8 }
    ],
    expert: [
        { clues: [22, 26], ok: m => m.max >= 4.2 && m.max <= 6.0 && m.ns >= 2 && m.ns <= 4 },
        { clues: [22, 25], ok: m => m.max >= 4.2 && m.max <= 6.0 && m.ns >= 5 && m.ns <= 8 },
        { clues: [21, 25], ok: m => m.max >= 4.2 && m.max <= 6.0 && m.ns >= 9 && m.ns <= 16 }
    ]
};
const perLevel = Number(process.argv[2] || 100);
const onlyTier = process.argv[3]; // optional: rebuild a single tier
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
    if (!grade.solved) return null;
    const steps = grade.solveSteps;
    return {
        max: grade.maxStepDifficulty,
        ns: steps.filter(s => !/Single/.test(s.technique)).length,
        hs: steps.filter(s => s.technique === 'Hidden Single').length
    };
}
let catalog = {};
const outPath = path.join(root, 'puzzle-catalog.js');
if (onlyTier && !process.argv[4] && fs.existsSync(outPath)) catalog = require(outPath); // keep other tiers
catalog = JSON.parse(JSON.stringify(catalog));
const seen = new Set();
for (const [tier, levels] of Object.entries(LEVELS)) {
    if (onlyTier && tier !== onlyTier) continue;
    catalog[tier] = [];
    levels.forEach((spec, l) => {
        const started = Date.now();
        let tried = 0, have = 0;
        while (have < perLevel) {
            tried++;
            const target = spec.clues[0] + rand(spec.clues[1] - spec.clues[0] + 1);
            const puzzle = carve(randomSolution(), target);
            if (!puzzle || seen.has(puzzle)) continue;
            const m = rate(puzzle);
            if (!m || !spec.ok(m)) continue;
            seen.add(puzzle);
            catalog[tier].push({ p: puzzle, s: countSolutions(puzzle.split('').map(Number), 1).solution, r: m.max, l });
            have++;
            if (have % 10 === 0) {
                console.error(`${tier} L${l + 1}: ${have}/${perLevel} (${tried} tried, ${((Date.now() - started) / 1000).toFixed(0)}s)`);
            }
        }
    });
}
const out = '// Generated by tools/build-puzzle-catalog.js - do not edit by hand.\n' +
    '// Every puzzle is uniquely solvable, logically solvable, and rated inside its tier band.\n' +
    'const VALIDATED_PUZZLE_CATALOG = Object.freeze(' + JSON.stringify(catalog) + ');\n' +
    "if (typeof module !== 'undefined') module.exports = VALIDATED_PUZZLE_CATALOG;\n";
fs.writeFileSync(process.argv[4] || path.join(root, 'puzzle-catalog.js'), out);
console.error('Wrote puzzle-catalog.js');
