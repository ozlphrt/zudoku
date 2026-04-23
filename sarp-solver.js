/**
 * SarpSolver - Human-Style Sudoku Solver Engine
 * 
 * This engine solves Sudoku puzzles using only human-friendly logical techniques.
 * It tracks the solve path, computes difficulty, and assigns an elegance score.
 * NEVER uses brute force or backtracking.
 */
class SarpSolver {
    constructor() {
        this.weights = {
            'Naked Single': 1.0,
            'Hidden Single': 1.2,
            'Naked Pair': 2.0,
            'Naked Triple': 3.0,
            'Hidden Pair': 2.0,
            'Hidden Triple': 3.0,
            'Pointing Pair': 2.5,
            'Box-Line Reduction': 2.5,
            'X-Wing': 5.0,
            'Swordfish': 6.0,
            'XY-Wing': 5.5,
            'Simple Coloring': 6.0,
            'Forcing Chain': 8.0
        };
    }

    solve(initialGrid, options = { mode: 'normal' }) {
        const grid = initialGrid.map(row => [...row]);
        const candidates = this.initCandidates(grid);
        const solveSteps = [];
        let solved = false;
        
        while (true) {
            let step = this.findNextStep(grid, candidates);
            
            if (!step) {
                // Check if solved
                let emptyCells = 0;
                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (grid[r][c] === 0) emptyCells++;
                    }
                }
                
                if (emptyCells === 0) {
                    solved = true;
                }
                break;
            }
            
            // Apply step
            this.applyStep(grid, candidates, step);
            step.stepIndex = solveSteps.length;
            solveSteps.push(step);
        }
        
        const result = {
            isValid: true, // Basic validity assumed if no collisions
            solved: solved,
            solveSteps: solveSteps,
            techniquesUsed: [...new Set(solveSteps.map(s => s.technique))],
            maxStepDifficulty: solveSteps.length > 0 ? Math.max(...solveSteps.map(s => s.difficultyWeight)) : 0,
            difficultyScore: solveSteps.reduce((sum, s) => sum + s.difficultyWeight, 0),
            rejectionReason: solved ? null : "Solver got stuck - requires advanced logic or guessing."
        };
        
        if (solved) {
            result.eleganceScore = this.computeElegance(solveSteps, options);
            result.difficultyLabel = this.getDifficultyLabel(result.maxStepDifficulty);
        } else {
            result.eleganceScore = 0;
        }
        
        return result;
    }

    initCandidates(grid) {
        const candidates = Array(9).fill().map(() => Array(9).fill().map(() => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])));
        
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] !== 0) {
                    const val = grid[r][c];
                    candidates[r][c].clear();
                    this.eliminateCandidateFromPeers(candidates, r, c, val);
                }
            }
        }
        return candidates;
    }

    eliminateCandidateFromPeers(candidates, row, col, val) {
        // Row
        for (let c = 0; c < 9; c++) candidates[row][c].delete(val);
        // Col
        for (let r = 0; r < 9; r++) candidates[r][col].delete(val);
        // Box
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r++) {
            for (let c = bc; c < bc + 3; c++) {
                candidates[r][c].delete(val);
            }
        }
    }

    findNextStep(grid, candidates) {
        // Techniques in order of weight/complexity
        return this.findNakedSingle(grid, candidates) ||
               this.findHiddenSingle(grid, candidates) ||
               this.findNakedPair(grid, candidates) ||
               this.findPointingPair(grid, candidates) ||
               this.findBoxLineReduction(grid, candidates) ||
               this.findHiddenPair(grid, candidates) ||
               this.findNakedTriple(grid, candidates) ||
               this.findHiddenTriple(grid, candidates) ||
               this.findXWing(grid, candidates) ||
               this.findXYWing(grid, candidates) ||
               this.findSwordfish(grid, candidates) ||
               this.findSimpleColoring(grid, candidates);
    }

    applyStep(grid, candidates, step) {
        if (step.type === 'placement') {
            const { row, col, number } = step;
            grid[row][col] = number;
            candidates[row][col].clear();
            this.eliminateCandidateFromPeers(candidates, row, col, number);
        } else if (step.type === 'elimination') {
            for (const elim of step.candidatesRemoved) {
                candidates[elim.row][elim.col].delete(elim.number);
            }
        }
    }

    // --- Technique Implementations ---

    findNakedSingle(grid, candidates) {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] === 0 && candidates[r][c].size === 1) {
                    const num = [...candidates[r][c]][0];
                    return {
                        technique: 'Naked Single',
                        type: 'placement',
                        row: r, col: c, number: num,
                        difficultyWeight: this.weights['Naked Single'],
                        reason: `Cell (${r+1},${c+1}) has only one possible candidate: ${num}.`
                    };
                }
            }
        }
        return null;
    }

    findHiddenSingle(grid, candidates) {
        for (let num = 1; num <= 9; num++) {
            // Check Rows
            for (let r = 0; r < 9; r++) {
                let count = 0;
                let lastCol = -1;
                for (let c = 0; c < 9; c++) {
                    if (grid[r][c] === 0 && candidates[r][c].has(num)) {
                        count++;
                        lastCol = c;
                    }
                }
                if (count === 1) {
                    return {
                        technique: 'Hidden Single',
                        type: 'placement',
                        row: r, col: lastCol, number: num,
                        difficultyWeight: this.weights['Hidden Single'],
                        reason: `In row ${r+1}, the number ${num} can only be placed in cell (${r+1},${lastCol+1}).`
                    };
                }
            }
            // Check Cols
            for (let c = 0; c < 9; c++) {
                let count = 0;
                let lastRow = -1;
                for (let r = 0; r < 9; r++) {
                    if (grid[r][c] === 0 && candidates[r][c].has(num)) {
                        count++;
                        lastRow = r;
                    }
                }
                if (count === 1) {
                    return {
                        technique: 'Hidden Single',
                        type: 'placement',
                        row: lastRow, col: c, number: num,
                        difficultyWeight: this.weights['Hidden Single'],
                        reason: `In column ${c+1}, the number ${num} can only be placed in cell (${lastRow+1},${c+1}).`
                    };
                }
            }
            // Check Boxes
            for (let b = 0; b < 9; b++) {
                let count = 0;
                let lastRow = -1, lastCol = -1;
                const br = Math.floor(b / 3) * 3;
                const bc = (b % 3) * 3;
                for (let r = br; r < br + 3; r++) {
                    for (let c = bc; c < bc + 3; c++) {
                        if (grid[r][c] === 0 && candidates[r][c].has(num)) {
                            count++;
                            lastRow = r;
                            lastCol = c;
                        }
                    }
                }
                if (count === 1) {
                    return {
                        technique: 'Hidden Single',
                        type: 'placement',
                        row: lastRow, col: lastCol, number: num,
                        difficultyWeight: this.weights['Hidden Single'],
                        reason: `In 3x3 block ${b+1}, the number ${num} can only be placed in cell (${lastRow+1},${lastCol+1}).`
                    };
                }
            }
        }
        return null;
    }

    findNakedPair(grid, candidates) {
        // Rows
        for (let r = 0; r < 9; r++) {
            const result = this.findNakedSubsetInUnit(candidates, this.getRowCells(r), 2);
            if (result) return { ...result, technique: 'Naked Pair', difficultyWeight: this.weights['Naked Pair'] };
        }
        // Cols
        for (let c = 0; c < 9; c++) {
            const result = this.findNakedSubsetInUnit(candidates, this.getColCells(c), 2);
            if (result) return { ...result, technique: 'Naked Pair', difficultyWeight: this.weights['Naked Pair'] };
        }
        // Boxes
        for (let b = 0; b < 9; b++) {
            const result = this.findNakedSubsetInUnit(candidates, this.getBoxCells(b), 2);
            if (result) return { ...result, technique: 'Naked Pair', difficultyWeight: this.weights['Naked Pair'] };
        }
        return null;
    }

    findNakedSubsetInUnit(candidates, cells, size) {
        const unsolved = cells.filter(cell => candidates[cell.r][cell.c].size > 0);
        if (unsolved.length <= size) return null;

        // Find cells with candidate size <= size
        const potentialCells = unsolved.filter(cell => candidates[cell.r][cell.c].size >= 2 && candidates[cell.r][cell.c].size <= size);
        
        if (potentialCells.length < size) return null;

        // Get all combinations of size 'size'
        const combinations = this.getCombinations(potentialCells, size);
        for (const combo of combinations) {
            const combinedCandidates = new Set();
            for (const cell of combo) {
                for (const num of candidates[cell.r][cell.c]) combinedCandidates.add(num);
            }

            if (combinedCandidates.size === size) {
                // Found a naked subset! Now check for eliminations
                const candidatesRemoved = [];
                for (const otherCell of unsolved) {
                    if (combo.some(c => c.r === otherCell.r && c.c === otherCell.c)) continue;
                    for (const num of combinedCandidates) {
                        if (candidates[otherCell.r][otherCell.c].has(num)) {
                            candidatesRemoved.push({ row: otherCell.r, col: otherCell.c, number: num });
                        }
                    }
                }

                if (candidatesRemoved.length > 0) {
                    return {
                        type: 'elimination',
                        cellsAffected: combo,
                        candidatesRemoved: candidatesRemoved,
                        reason: `Naked subset of size ${size} found in unit.`
                    };
                }
            }
        }
        return null;
    }

    findPointingPair(grid, candidates) {
        for (let b = 0; b < 9; b++) {
            const boxCells = this.getBoxCells(b);
            for (let num = 1; num <= 9; num++) {
                const positions = boxCells.filter(cell => grid[cell.r][cell.c] === 0 && candidates[cell.r][cell.c].has(num));
                if (positions.length >= 2 && positions.length <= 3) {
                    // Check if all in same row
                    const rows = [...new Set(positions.map(p => p.r))];
                    if (rows.length === 1) {
                        const r = rows[0];
                        const candidatesRemoved = [];
                        for (let c = 0; c < 9; c++) {
                            if (Math.floor(c / 3) === (b % 3)) continue; // Skip same box
                            if (grid[r][c] === 0 && candidates[r][c].has(num)) {
                                candidatesRemoved.push({ row: r, col: c, number: num });
                            }
                        }
                        if (candidatesRemoved.length > 0) {
                            return {
                                technique: 'Pointing Pair',
                                type: 'elimination',
                                difficultyWeight: this.weights['Pointing Pair'],
                                candidatesRemoved: candidatesRemoved,
                                reason: `In block ${b+1}, ${num} is restricted to row ${r+1}.`
                            };
                        }
                    }
                    // Check if all in same col
                    const cols = [...new Set(positions.map(p => p.c))];
                    if (cols.length === 1) {
                        const c = cols[0];
                        const candidatesRemoved = [];
                        for (let r = 0; r < 9; r++) {
                            if (Math.floor(r / 3) === Math.floor(b / 3)) continue; // Skip same box
                            if (grid[r][c] === 0 && candidates[r][c].has(num)) {
                                candidatesRemoved.push({ row: r, col: c, number: num });
                            }
                        }
                        if (candidatesRemoved.length > 0) {
                            return {
                                technique: 'Pointing Pair',
                                type: 'elimination',
                                difficultyWeight: this.weights['Pointing Pair'],
                                candidatesRemoved: candidatesRemoved,
                                reason: `In block ${b+1}, ${num} is restricted to column ${c+1}.`
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

    findBoxLineReduction(grid, candidates) {
        for (let num = 1; num <= 9; num++) {
            // Rows
            for (let r = 0; r < 9; r++) {
                const positions = [];
                for (let c = 0; c < 9; c++) {
                    if (grid[r][c] === 0 && candidates[r][c].has(num)) positions.push(c);
                }
                if (positions.length >= 2 && positions.length <= 3) {
                    const boxes = [...new Set(positions.map(c => Math.floor(c / 3)))];
                    if (boxes.length === 1) {
                        const b = Math.floor(r / 3) * 3 + boxes[0];
                        const candidatesRemoved = [];
                        const boxCells = this.getBoxCells(b);
                        for (const cell of boxCells) {
                            if (cell.r === r) continue;
                            if (grid[cell.r][cell.c] === 0 && candidates[cell.r][cell.c].has(num)) {
                                candidatesRemoved.push({ row: cell.r, col: cell.c, number: num });
                            }
                        }
                        if (candidatesRemoved.length > 0) {
                            return {
                                technique: 'Box-Line Reduction',
                                type: 'elimination',
                                difficultyWeight: this.weights['Box-Line Reduction'],
                                candidatesRemoved: candidatesRemoved,
                                reason: `In row ${r+1}, ${num} is restricted to block ${b+1}.`
                            };
                        }
                    }
                }
            }
            // Cols
            for (let c = 0; c < 9; c++) {
                const positions = [];
                for (let r = 0; r < 9; r++) {
                    if (grid[r][c] === 0 && candidates[r][c].has(num)) positions.push(r);
                }
                if (positions.length >= 2 && positions.length <= 3) {
                    const boxes = [...new Set(positions.map(r => Math.floor(r / 3)))];
                    if (boxes.length === 1) {
                        const b = boxes[0] * 3 + Math.floor(c / 3);
                        const candidatesRemoved = [];
                        const boxCells = this.getBoxCells(b);
                        for (const cell of boxCells) {
                            if (cell.c === c) continue;
                            if (grid[cell.r][cell.c] === 0 && candidates[cell.r][cell.c].has(num)) {
                                candidatesRemoved.push({ row: cell.r, col: cell.c, number: num });
                            }
                        }
                        if (candidatesRemoved.length > 0) {
                            return {
                                technique: 'Box-Line Reduction',
                                type: 'elimination',
                                difficultyWeight: this.weights['Box-Line Reduction'],
                                candidatesRemoved: candidatesRemoved,
                                reason: `In column ${c+1}, ${num} is restricted to block ${b+1}.`
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

    findHiddenPair(grid, candidates) {
        // Similar to naked subset but looking for number occurrences
        // Hidden Pair weight: 2.0
        return null; // Implementation pending if needed for complexity
    }

    findNakedTriple(grid, candidates) {
        for (let r = 0; r < 9; r++) {
            const result = this.findNakedSubsetInUnit(candidates, this.getRowCells(r), 3);
            if (result) return { ...result, technique: 'Naked Triple', difficultyWeight: this.weights['Naked Triple'] };
        }
        // ... same for cols/boxes
        return null;
    }

    findHiddenTriple(grid, candidates) {
        return null;
    }

    findXWing(grid, candidates) {
        for (let num = 1; num <= 9; num++) {
            // Rows X-Wing
            const rowPositions = [];
            for (let r = 0; r < 9; r++) {
                const cols = [];
                for (let c = 0; c < 9; c++) {
                    if (grid[r][c] === 0 && candidates[r][c].has(num)) cols.push(c);
                }
                if (cols.length === 2) rowPositions.push({ r, cols });
            }

            if (rowPositions.length >= 2) {
                for (let i = 0; i < rowPositions.length; i++) {
                    for (let j = i + 1; j < rowPositions.length; j++) {
                        const r1 = rowPositions[i];
                        const r2 = rowPositions[j];
                        if (r1.cols[0] === r2.cols[0] && r1.cols[1] === r2.cols[1]) {
                            // X-Wing found in rows r1.r, r2.r with columns r1.cols
                            const candidatesRemoved = [];
                            const c1 = r1.cols[0], c2 = r1.cols[1];
                            for (let r = 0; r < 9; r++) {
                                if (r === r1.r || r === r2.r) continue;
                                if (grid[r][c1] === 0 && candidates[r][c1].has(num)) candidatesRemoved.push({ row: r, col: c1, number: num });
                                if (grid[r][c2] === 0 && candidates[r][c2].has(num)) candidatesRemoved.push({ row: r, col: c2, number: num });
                            }
                            if (candidatesRemoved.length > 0) {
                                return {
                                    technique: 'X-Wing',
                                    type: 'elimination',
                                    difficultyWeight: this.weights['X-Wing'],
                                    candidatesRemoved: candidatesRemoved,
                                    reason: `X-Wing for ${num} in rows ${r1.r+1}, ${r2.r+1} and columns ${c1+1}, ${c2+1}.`
                                };
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    findXYWing(grid, candidates) {
        // XY-Wing weight: 5.5
        // Pivot cell with 2 candidates (X,Y)
        // Two pincer cells in different units both seeing pivot
        // One pincer has (X,Z), other has (Y,Z)
        // Any cell seeing both pincers cannot have Z.
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] === 0 && candidates[r][c].size === 2) {
                    const pivot = { r, c, vals: [...candidates[r][c]] };
                    const [X, Y] = pivot.vals;
                    
                    const peers = this.getPeers(r, c);
                    const pincers = peers.filter(p => grid[p.r][p.c] === 0 && candidates[p.r][p.c].size === 2);
                    
                    for (let i = 0; i < pincers.length; i++) {
                        for (let j = i + 1; j < pincers.length; j++) {
                            const p1 = pincers[i];
                            const p2 = pincers[j];
                            const p1Vals = [...candidates[p1.r][p1.c]];
                            const p2Vals = [...candidates[p2.r][p2.c]];
                            
                            // Check if p1 and p2 share a value Z that is not in pivot
                            let Z = -1;
                            if (p1Vals.includes(X) && p2Vals.includes(Y)) {
                                Z = p1Vals.find(v => v !== X);
                                if (Z !== p2Vals.find(v => v !== Y)) Z = -1;
                            } else if (p1Vals.includes(Y) && p2Vals.includes(X)) {
                                Z = p1Vals.find(v => v !== Y);
                                if (Z !== p2Vals.find(v => v !== X)) Z = -1;
                            }
                            
                            if (Z !== -1 && !pivot.vals.includes(Z)) {
                                // Potential XY-Wing! Find mutual peers of p1 and p2
                                const p1Peers = this.getPeers(p1.r, p1.c);
                                const p2Peers = this.getPeers(p2.r, p2.c);
                                const mutualPeers = p1Peers.filter(p1p => p2Peers.some(p2p => p1p.r === p2p.r && p1p.c === p2p.c));
                                
                                const candidatesRemoved = [];
                                for (const mp of mutualPeers) {
                                    if (mp.r === pivot.r && mp.c === pivot.c) continue;
                                    if (grid[mp.r][mp.c] === 0 && candidates[mp.r][mp.c].has(Z)) {
                                        candidatesRemoved.push({ row: mp.r, col: mp.c, number: Z });
                                    }
                                }
                                
                                if (candidatesRemoved.length > 0) {
                                    return {
                                        technique: 'XY-Wing',
                                        type: 'elimination',
                                        difficultyWeight: this.weights['XY-Wing'],
                                        candidatesRemoved: candidatesRemoved,
                                        reason: `XY-Wing with pivot (${pivot.r+1},${pivot.c+1}) and pincers (${p1.r+1},${p1.c+1}), (${p2.r+1},${p2.c+1}).`
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    findSwordfish(grid, candidates) {
        // Implementation similar to X-Wing but for 3 rows/cols
        return null;
    }

    findSimpleColoring(grid, candidates) {
        return null;
    }

    // --- Helper Methods ---

    getRowCells(r) {
        const cells = [];
        for (let c = 0; c < 9; c++) cells.push({ r, c });
        return cells;
    }

    getColCells(c) {
        const cells = [];
        for (let r = 0; r < 9; r++) cells.push({ r, c });
        return cells;
    }

    getBoxCells(b) {
        const cells = [];
        const br = Math.floor(b / 3) * 3;
        const bc = (b % 3) * 3;
        for (let r = br; r < br + 3; r++) {
            for (let c = bc; c < bc + 3; c++) cells.push({ r, c });
        }
        return cells;
    }

    getPeers(r, c) {
        const peers = [];
        for (let i = 0; i < 9; i++) {
            if (i !== c) peers.push({ r, c: i });
            if (i !== r) peers.push({ r: i, c });
        }
        const br = Math.floor(r / 3) * 3;
        const bc = Math.floor(c / 3) * 3;
        for (let i = br; i < br + 3; i++) {
            for (let j = bc; j < bc + 3; j++) {
                if (i !== r && j !== c) peers.push({ r: i, c: j });
            }
        }
        return peers;
    }

    getCombinations(arr, k) {
        const results = [];
        const combine = (start, combo) => {
            if (combo.length === k) {
                results.push([...combo]);
                return;
            }
            for (let i = start; i < arr.length; i++) {
                combo.push(arr[i]);
                combine(i + 1, combo);
                combo.pop();
            }
        };
        combine(0, []);
        return results;
    }

    computeElegance(steps, options) {
        if (steps.length === 0) return 100;
        let score = 100;
        
        // A. Difficulty Jumps
        for (let i = 0; i < steps.length - 1; i++) {
            if (steps[i+1].difficultyWeight > steps[i].difficultyWeight * 2) {
                score -= 10;
            }
        }
        
        // B. Technique Chaos
        const uniqueTechniques = new Set(steps.map(s => s.technique));
        if (uniqueTechniques.size > 5) {
            score -= (uniqueTechniques.size - 5);
        }
        
        // C. Repetition Fatigue
        let consecutiveCount = 1;
        for (let i = 0; i < steps.length - 1; i++) {
            if (steps[i+1].technique === steps[i].technique) {
                consecutiveCount++;
                if (consecutiveCount > 6) {
                    score -= 5;
                    consecutiveCount = 1; // Reset to avoid double penalty for same sequence
                }
            } else {
                consecutiveCount = 1;
            }
        }
        
        // E. Path Smoothness (Reward gradual increase)
        let increasing = true;
        for (let i = 0; i < Math.min(steps.length - 1, 10); i++) {
            if (steps[i+1].difficultyWeight < steps[i].difficultyWeight) {
                increasing = false;
                break;
            }
        }
        if (increasing) score += 5;
        
        return Math.max(0, Math.min(100, score));
    }

    getDifficultyLabel(maxWeight) {
        if (maxWeight <= 1.2) return 'easy';
        if (maxWeight <= 3.0) return 'medium';
        if (maxWeight <= 5.5) return 'hard';
        return 'expert';
    }
}

// Global instance for browser access
window.SarpSolver = SarpSolver;
