const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const gameSource = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const solverSource = fs.readFileSync(path.join(root, 'sarp-solver.js'), 'utf8');
const ratedMasterPuzzles = require(path.join(root, 'master-puzzles.js'));

global.window = global;
vm.runInThisContext(solverSource, { filename: 'sarp-solver.js' });

const bankLine = gameSource
    .split(/\r?\n/)
    .find(line => line.includes('this._cachedMasterBanks = {'));

if (!bankLine) throw new Error('Could not locate the master puzzle bank.');

const banks = JSON.parse(
    bankLine.slice(bankLine.indexOf('=') + 1, bankLine.lastIndexOf(';')).trim()
);

function toGrid(value) {
    if (typeof value !== 'string' || value.length !== 81 || /[^0-9]/.test(value)) {
        throw new Error('Puzzle and solution strings must contain exactly 81 digits.');
    }
    return Array.from({ length: 9 }, (_, row) =>
        value.slice(row * 9, row * 9 + 9).split('').map(Number));
}

function isCompleteSolution(grid) {
    const expected = '123456789';
    const signature = values => [...values].sort().join('');
    for (let i = 0; i < 9; i++) {
        if (signature(grid[i]) !== expected) return false;
        if (signature(grid.map(row => row[i])) !== expected) return false;
    }
    for (let boxRow = 0; boxRow < 3; boxRow++) {
        for (let boxCol = 0; boxCol < 3; boxCol++) {
            const values = [];
            for (let r = boxRow * 3; r < boxRow * 3 + 3; r++) {
                for (let c = boxCol * 3; c < boxCol * 3 + 3; c++) values.push(grid[r][c]);
            }
            if (signature(values) !== expected) return false;
        }
    }
    return true;
}

function countSolutions(initialGrid, limit = 2) {
    const grid = initialGrid.map(row => [...row]);
    const rows = Array(9).fill(0);
    const cols = Array(9).fill(0);
    const boxes = Array(9).fill(0);
    const fullMask = 0x3FE;
    let count = 0;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const value = grid[r][c];
            if (!value) continue;
            const bit = 1 << value;
            const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
            if ((rows[r] | cols[c] | boxes[box]) & bit) return 0;
            rows[r] |= bit;
            cols[c] |= bit;
            boxes[box] |= bit;
        }
    }

    function search() {
        if (count >= limit) return;
        let bestRow = -1;
        let bestCol = -1;
        let bestMask = 0;
        let bestCount = 10;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c]) continue;
                const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
                const mask = fullMask & ~(rows[r] | cols[c] | boxes[box]);
                let optionCount = 0;
                for (let bits = mask; bits; bits &= bits - 1) optionCount++;
                if (!optionCount) return;
                if (optionCount < bestCount) {
                    bestRow = r;
                    bestCol = c;
                    bestMask = mask;
                    bestCount = optionCount;
                }
            }
        }

        if (bestRow === -1) {
            count++;
            return;
        }

        const box = Math.floor(bestRow / 3) * 3 + Math.floor(bestCol / 3);
        for (let choices = bestMask; choices; choices &= choices - 1) {
            const bit = choices & -choices;
            const value = 31 - Math.clz32(bit);
            grid[bestRow][bestCol] = value;
            rows[bestRow] |= bit;
            cols[bestCol] |= bit;
            boxes[box] |= bit;
            search();
            rows[bestRow] ^= bit;
            cols[bestCol] ^= bit;
            boxes[box] ^= bit;
            grid[bestRow][bestCol] = 0;
            if (count >= limit) return;
        }
    }

    search();
    return count;
}

const solver = new SarpSolver();
const failures = [];
const ratings = {};
let total = 0;

for (const [clueKey, entries] of Object.entries(banks)) {
    ratings[clueKey] = {};
    entries.forEach((entry, index) => {
        total++;
        const puzzle = toGrid(entry.p);
        const solution = toGrid(entry.s);
        const clueCount = puzzle.flat().filter(Boolean).length;

        if (clueCount !== Number(clueKey)) {
            failures.push(`${clueKey}#${index + 1}: contains ${clueCount} clues`);
        }
        if (!isCompleteSolution(solution)) {
            failures.push(`${clueKey}#${index + 1}: stored solution is invalid`);
        }
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (puzzle[r][c] && puzzle[r][c] !== solution[r][c]) {
                    failures.push(`${clueKey}#${index + 1}: given at r${r + 1}c${c + 1} conflicts with solution`);
                }
            }
        }

        const solutionCount = countSolutions(puzzle, 2);
        if (solutionCount !== 1) {
            failures.push(`${clueKey}#${index + 1}: expected one solution, found ${solutionCount}`);
        }

        const grade = solver.solve(puzzle);
        const label = grade.solved ? grade.difficultyLabel : 'beyond-sarp';
        ratings[clueKey][label] = (ratings[clueKey][label] || 0) + 1;
    });
}

const masterRatings = {};
const masterStageCounts = [
    { label: 'Master I', min: 6.2, max: 6.9, count: 0 },
    { label: 'Master II', min: 7.0, max: 7.6, count: 0 },
    { label: 'Master III', min: 7.7, max: 8.3, count: 0 },
    { label: 'Master IV', min: 8.4, max: 9.3, count: 0 }
];
for (const [index, entry] of ratedMasterPuzzles.entries()) {
    const puzzle = toGrid(entry.p);
    const solution = toGrid(entry.s);
    const ratingBand = entry.r.toFixed(1);
    masterRatings[ratingBand] = (masterRatings[ratingBand] || 0) + 1;
    const stage = masterStageCounts.find(item => entry.r >= item.min && entry.r <= item.max);
    if (stage) stage.count++;
    else failures.push(`Master#${index + 1}: rating ${entry.r} belongs to no Master stage`);

    if (!Number.isFinite(entry.r) || entry.r < 6.2) {
        failures.push(`Master#${index + 1}: rating ${entry.r} is below 6.2`);
    }
    if (!isCompleteSolution(solution)) {
        failures.push(`Master#${index + 1}: stored solution is invalid`);
    }
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (puzzle[r][c] && puzzle[r][c] !== solution[r][c]) {
                failures.push(`Master#${index + 1}: given at r${r + 1}c${c + 1} conflicts with solution`);
            }
        }
    }
    const solutionCount = countSolutions(puzzle, 2);
    if (solutionCount !== 1) {
        failures.push(`Master#${index + 1}: expected one solution, found ${solutionCount}`);
    }
}

console.log(`Validated ${total} master-bank puzzles.`);
for (const [clues, summary] of Object.entries(ratings)) {
    console.log(`${clues} clues: ${JSON.stringify(summary)}`);
}
console.log(`Validated ${ratedMasterPuzzles.length} externally rated Master puzzles.`);
console.log(`Master SE ratings: ${JSON.stringify(masterRatings)}`);
console.log(`Master stages: ${masterStageCounts.map(stage => `${stage.label}=${stage.count}`).join(', ')}`);

if (ratedMasterPuzzles.length !== 100) {
    failures.push(`Expected 100 externally rated Master puzzles, found ${ratedMasterPuzzles.length}`);
}
if (masterStageCounts.some(stage => stage.count === 0)) {
    failures.push('Every Master stage must contain at least one puzzle');
}

if (!(ratings['17']?.expert > 0)) {
    failures.push('17-clue bank has no puzzle in the Expert SE band');
}

if (failures.length) {
    console.error(`\n${failures.length} validation failure(s):`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.log('All puzzles are valid, solvable, and uniquely solvable.');
}
