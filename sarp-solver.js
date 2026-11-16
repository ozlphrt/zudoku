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
            // Sudoku Explainer-compatible technique ratings. Difficulty labels
            // below group those ratings into product-friendly bands.
            'Hidden Single': 1.5,
            'Naked Single': 2.3,
            'Pointing Pair': 2.6,
            'Box-Line Reduction': 2.8,
            'Naked Pair': 3.0,
            'X-Wing': 3.2,
            'Hidden Pair': 3.4,
            'Naked Triple': 3.6,
            'Swordfish': 3.8,
            'Hidden Triple': 4.0,
            'XY-Wing': 4.2,
            'XYZ-Wing': 4.4,
            'Skyscraper': 4.4,
            '2-String Kite': 4.4,
            'W-Wing': 4.6,
            'Empty Rectangle': 4.6,
            'Finned X-Wing': 4.6,
            'Simple Coloring': 4.8,
            'Naked Quad': 5.0,
            'XY-Chain': 5.2,
            'Long XY-Chain': 5.4,
            'Hidden Quad': 5.4,
            '3D Medusa': 5.6,
            'AIC': 5.8,
            'Extended AIC': 6.0,
            'Forcing Chain': 7.0
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
            result.solveCurveShape = this.classifySolveCurve(solveSteps);
        } else {
            result.eleganceScore = 0;
            result.solveCurveShape = 'unsolvable';
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
               this.findXWing(grid, candidates) ||
               this.findSwordfish(grid, candidates) ||
               this.findHiddenTriple(grid, candidates) ||
               this.findXYWing(grid, candidates) ||
               this.findXYZWing(grid, candidates) ||
               this.findSkyscraper(grid, candidates) ||
               this.findTwoStringKite(grid, candidates) ||
               this.findWWing(grid, candidates) ||
               this.findEmptyRectangle(grid, candidates) ||
               this.findFinnedXWing(grid, candidates) ||
               this.findSimpleColoring(grid, candidates) ||
               this.findNakedQuad(grid, candidates) ||
               this.findXYChain(grid, candidates) ||
               this.findHiddenQuad(grid, candidates) ||
               this.find3DMedusa(grid, candidates) ||
               this.findAIC(grid, candidates);
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
        const units = [];
        for (let i = 0; i < 9; i++) {
            units.push({ cells: this.getRowCells(i), name: `row ${i+1}` });
            units.push({ cells: this.getColCells(i), name: `col ${i+1}` });
            units.push({ cells: this.getBoxCells(i), name: `box ${i+1}` });
        }

        for (const unit of units) {
            const unsolved = unit.cells.filter(cell => grid[cell.r][cell.c] === 0 && candidates[cell.r][cell.c].size > 0);
            if (unsolved.length < 3) continue;

            // Find which numbers appear in only 2 cells in this unit
            const numPositions = new Map();
            for (let num = 1; num <= 9; num++) {
                const positions = unsolved.filter(cell => candidates[cell.r][cell.c].has(num));
                if (positions.length === 2) {
                    numPositions.set(num, positions);
                }
            }

            // Check all pairs of such numbers
            const nums = [...numPositions.keys()];
            for (let i = 0; i < nums.length; i++) {
                for (let j = i + 1; j < nums.length; j++) {
                    const pos1 = numPositions.get(nums[i]);
                    const pos2 = numPositions.get(nums[j]);
                    // Same two cells?
                    if (pos1[0].r === pos2[0].r && pos1[0].c === pos2[0].c &&
                        pos1[1].r === pos2[1].r && pos1[1].c === pos2[1].c) {
                        // Hidden Pair found! Remove other candidates from these two cells
                        const pairNums = new Set([nums[i], nums[j]]);
                        const candidatesRemoved = [];
                        for (const cell of [pos1[0], pos1[1]]) {
                            for (const cand of candidates[cell.r][cell.c]) {
                                if (!pairNums.has(cand)) {
                                    candidatesRemoved.push({ row: cell.r, col: cell.c, number: cand });
                                }
                            }
                        }
                        if (candidatesRemoved.length > 0) {
                            return {
                                technique: 'Hidden Pair',
                                type: 'elimination',
                                difficultyWeight: this.weights['Hidden Pair'],
                                candidatesRemoved: candidatesRemoved,
                                reason: `Hidden Pair {${nums[i]},${nums[j]}} in ${unit.name} at cells (${pos1[0].r+1},${pos1[0].c+1}) and (${pos1[1].r+1},${pos1[1].c+1}).`
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

    findNakedTriple(grid, candidates) {
        for (let r = 0; r < 9; r++) {
            const result = this.findNakedSubsetInUnit(candidates, this.getRowCells(r), 3);
            if (result) return { ...result, technique: 'Naked Triple', difficultyWeight: this.weights['Naked Triple'] };
        }
        for (let c = 0; c < 9; c++) {
            const result = this.findNakedSubsetInUnit(candidates, this.getColCells(c), 3);
            if (result) return { ...result, technique: 'Naked Triple', difficultyWeight: this.weights['Naked Triple'] };
        }
        for (let b = 0; b < 9; b++) {
            const result = this.findNakedSubsetInUnit(candidates, this.getBoxCells(b), 3);
            if (result) return { ...result, technique: 'Naked Triple', difficultyWeight: this.weights['Naked Triple'] };
        }
        return null;
    }

    findHiddenTriple(grid, candidates) {
        const units = [];
        for (let i = 0; i < 9; i++) {
            units.push({ cells: this.getRowCells(i), name: `row ${i+1}` });
            units.push({ cells: this.getColCells(i), name: `col ${i+1}` });
            units.push({ cells: this.getBoxCells(i), name: `box ${i+1}` });
        }

        for (const unit of units) {
            const unsolved = unit.cells.filter(cell => grid[cell.r][cell.c] === 0 && candidates[cell.r][cell.c].size > 0);
            if (unsolved.length < 4) continue;

            // Find numbers that appear in 2 or 3 cells
            const numPositions = new Map();
            for (let num = 1; num <= 9; num++) {
                const positions = unsolved.filter(cell => candidates[cell.r][cell.c].has(num));
                if (positions.length >= 2 && positions.length <= 3) {
                    numPositions.set(num, positions);
                }
            }

            const nums = [...numPositions.keys()];
            if (nums.length < 3) continue;

            const combos = this.getCombinations(nums, 3);
            for (const tripleNums of combos) {
                // Collect all cells containing any of these three numbers
                const cellSet = new Set();
                for (const n of tripleNums) {
                    for (const pos of numPositions.get(n)) {
                        cellSet.add(`${pos.r},${pos.c}`);
                    }
                }
                if (cellSet.size === 3) {
                    // Hidden Triple found!
                    const tripleSet = new Set(tripleNums);
                    const candidatesRemoved = [];
                    for (const key of cellSet) {
                        const [r, c] = key.split(',').map(Number);
                        for (const cand of candidates[r][c]) {
                            if (!tripleSet.has(cand)) {
                                candidatesRemoved.push({ row: r, col: c, number: cand });
                            }
                        }
                    }
                    if (candidatesRemoved.length > 0) {
                        return {
                            technique: 'Hidden Triple',
                            type: 'elimination',
                            difficultyWeight: this.weights['Hidden Triple'],
                            candidatesRemoved: candidatesRemoved,
                            reason: `Hidden Triple {${tripleNums.join(',')}} in ${unit.name}.`
                        };
                    }
                }
            }
        }
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

            // Columns X-Wing (symmetric so board transpositions grade identically)
            const colPositions = [];
            for (let c = 0; c < 9; c++) {
                const rows = [];
                for (let r = 0; r < 9; r++) {
                    if (grid[r][c] === 0 && candidates[r][c].has(num)) rows.push(r);
                }
                if (rows.length === 2) colPositions.push({ c, rows });
            }

            if (colPositions.length >= 2) {
                for (let i = 0; i < colPositions.length; i++) {
                    for (let j = i + 1; j < colPositions.length; j++) {
                        const c1 = colPositions[i];
                        const c2 = colPositions[j];
                        if (c1.rows[0] === c2.rows[0] && c1.rows[1] === c2.rows[1]) {
                            const candidatesRemoved = [];
                            const r1 = c1.rows[0], r2 = c1.rows[1];
                            for (let c = 0; c < 9; c++) {
                                if (c === c1.c || c === c2.c) continue;
                                if (grid[r1][c] === 0 && candidates[r1][c].has(num)) candidatesRemoved.push({ row: r1, col: c, number: num });
                                if (grid[r2][c] === 0 && candidates[r2][c].has(num)) candidatesRemoved.push({ row: r2, col: c, number: num });
                            }
                            if (candidatesRemoved.length > 0) {
                                return {
                                    technique: 'X-Wing',
                                    type: 'elimination',
                                    difficultyWeight: this.weights['X-Wing'],
                                    candidatesRemoved: candidatesRemoved,
                                    reason: `X-Wing for ${num} in columns ${c1.c+1}, ${c2.c+1} and rows ${r1+1}, ${r2+1}.`
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
        for (let num = 1; num <= 9; num++) {
            // Row-based Swordfish
            const rowLines = [];
            for (let r = 0; r < 9; r++) {
                const cols = [];
                for (let c = 0; c < 9; c++) {
                    if (grid[r][c] === 0 && candidates[r][c].has(num)) cols.push(c);
                }
                if (cols.length >= 2 && cols.length <= 3) rowLines.push({ r, cols });
            }
            if (rowLines.length >= 3) {
                for (const trio of this.getCombinations(rowLines, 3)) {
                    const colSet = new Set();
                    for (const row of trio) for (const c of row.cols) colSet.add(c);
                    if (colSet.size === 3) {
                        const rowSet = new Set(trio.map(x => x.r));
                        const removed = [];
                        for (const c of colSet) {
                            for (let r = 0; r < 9; r++) {
                                if (rowSet.has(r)) continue;
                                if (grid[r][c] === 0 && candidates[r][c].has(num)) removed.push({ row: r, col: c, number: num });
                            }
                        }
                        if (removed.length > 0) {
                            return {
                                technique: 'Swordfish',
                                type: 'elimination',
                                difficultyWeight: this.weights['Swordfish'],
                                candidatesRemoved: removed,
                                reason: `Swordfish for ${num} in rows ${trio.map(x => x.r + 1).join(', ')}.`
                            };
                        }
                    }
                }
            }

            // Column-based Swordfish
            const colLines = [];
            for (let c = 0; c < 9; c++) {
                const rows = [];
                for (let r = 0; r < 9; r++) {
                    if (grid[r][c] === 0 && candidates[r][c].has(num)) rows.push(r);
                }
                if (rows.length >= 2 && rows.length <= 3) colLines.push({ c, rows });
            }
            if (colLines.length >= 3) {
                for (const trio of this.getCombinations(colLines, 3)) {
                    const rowSet = new Set();
                    for (const col of trio) for (const r of col.rows) rowSet.add(r);
                    if (rowSet.size === 3) {
                        const colSet = new Set(trio.map(x => x.c));
                        const removed = [];
                        for (const r of rowSet) {
                            for (let c = 0; c < 9; c++) {
                                if (colSet.has(c)) continue;
                                if (grid[r][c] === 0 && candidates[r][c].has(num)) removed.push({ row: r, col: c, number: num });
                            }
                        }
                        if (removed.length > 0) {
                            return {
                                technique: 'Swordfish',
                                type: 'elimination',
                                difficultyWeight: this.weights['Swordfish'],
                                candidatesRemoved: removed,
                                reason: `Swordfish for ${num} in columns ${trio.map(x => x.c + 1).join(', ')}.`
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

    // 4.4: XYZ-Wing — 3-candidate pivot {X,Y,Z} with two bivalue pincer peers {X,Z} and {Y,Z}
    findXYZWing(grid, candidates) {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] !== 0 || candidates[r][c].size !== 3) continue;
                const pVals = [...candidates[r][c]];
                const subPeers = this.getPeers(r, c).filter(p =>
                    grid[p.r][p.c] === 0 &&
                    candidates[p.r][p.c].size === 2 &&
                    [...candidates[p.r][p.c]].every(v => candidates[r][c].has(v))
                );
                for (let i = 0; i < subPeers.length; i++) {
                    for (let j = i + 1; j < subPeers.length; j++) {
                        const p1 = subPeers[i], p2 = subPeers[j];
                        const v1 = [...candidates[p1.r][p1.c]], v2 = [...candidates[p2.r][p2.c]];
                        if (v1[0] === v2[0] && v1[1] === v2[1]) continue;
                        const shared = v1.filter(v => v2.includes(v));
                        if (shared.length !== 1) continue;
                        const Z = shared[0];
                        const removed = [];
                        for (const peer of this.getPeers(r, c)) {
                            if ((peer.r === p1.r && peer.c === p1.c) || (peer.r === p2.r && peer.c === p2.c)) continue;
                            if (grid[peer.r][peer.c] === 0 && candidates[peer.r][peer.c].has(Z) &&
                                this.arePeers(peer.r, peer.c, p1.r, p1.c) && this.arePeers(peer.r, peer.c, p2.r, p2.c)) {
                                removed.push({ row: peer.r, col: peer.c, number: Z });
                            }
                        }
                        if (removed.length > 0) {
                            return {
                                technique: 'XYZ-Wing',
                                type: 'elimination',
                                difficultyWeight: this.weights['XYZ-Wing'],
                                candidatesRemoved: removed,
                                reason: `XYZ-Wing on {${pVals.join(',')}} at pivot (${r+1},${c+1}) with pincers (${p1.r+1},${p1.c+1}) and (${p2.r+1},${p2.c+1}).`
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

    // 4.4: Skyscraper — two conjugate pairs in parallel lines sharing one cross-line
    findSkyscraper(grid, candidates) {
        for (let num = 1; num <= 9; num++) {
            const biRows = [];
            for (let r = 0; r < 9; r++) {
                const cols = [];
                for (let c = 0; c < 9; c++) if (grid[r][c] === 0 && candidates[r][c].has(num)) cols.push(c);
                if (cols.length === 2) biRows.push({ r, cols });
            }
            for (let i = 0; i < biRows.length; i++) {
                for (let j = i + 1; j < biRows.length; j++) {
                    const a = biRows[i], b = biRows[j];
                    for (let ai = 0; ai < 2; ai++) {
                        for (let bi = 0; bi < 2; bi++) {
                            if (a.cols[ai] === b.cols[bi] && a.cols[1 - ai] !== b.cols[1 - bi]) {
                                const e1 = { r: a.r, c: a.cols[1 - ai] }, e2 = { r: b.r, c: b.cols[1 - bi] };
                                const removed = [];
                                for (let r = 0; r < 9; r++) {
                                    for (let c = 0; c < 9; c++) {
                                        if (grid[r][c] === 0 && candidates[r][c].has(num) &&
                                            !(r === e1.r && c === e1.c) && !(r === e2.r && c === e2.c) &&
                                            this.arePeers(r, c, e1.r, e1.c) && this.arePeers(r, c, e2.r, e2.c)) {
                                            removed.push({ row: r, col: c, number: num });
                                        }
                                    }
                                }
                                if (removed.length > 0) {
                                    return {
                                        technique: 'Skyscraper',
                                        type: 'elimination',
                                        difficultyWeight: this.weights['Skyscraper'],
                                        candidatesRemoved: removed,
                                        reason: `Skyscraper for ${num} in rows ${a.r+1} and ${b.r+1} sharing column ${a.cols[ai]+1}.`
                                    };
                                }
                            }
                        }
                    }
                }
            }

            const biCols = [];
            for (let c = 0; c < 9; c++) {
                const rows = [];
                for (let r = 0; r < 9; r++) if (grid[r][c] === 0 && candidates[r][c].has(num)) rows.push(r);
                if (rows.length === 2) biCols.push({ c, rows });
            }
            for (let i = 0; i < biCols.length; i++) {
                for (let j = i + 1; j < biCols.length; j++) {
                    const a = biCols[i], b = biCols[j];
                    for (let ai = 0; ai < 2; ai++) {
                        for (let bi = 0; bi < 2; bi++) {
                            if (a.rows[ai] === b.rows[bi] && a.rows[1 - ai] !== b.rows[1 - bi]) {
                                const e1 = { r: a.rows[1 - ai], c: a.c }, e2 = { r: b.rows[1 - bi], c: b.c };
                                const removed = [];
                                for (let r = 0; r < 9; r++) {
                                    for (let c = 0; c < 9; c++) {
                                        if (grid[r][c] === 0 && candidates[r][c].has(num) &&
                                            !(r === e1.r && c === e1.c) && !(r === e2.r && c === e2.c) &&
                                            this.arePeers(r, c, e1.r, e1.c) && this.arePeers(r, c, e2.r, e2.c)) {
                                            removed.push({ row: r, col: c, number: num });
                                        }
                                    }
                                }
                                if (removed.length > 0) {
                                    return {
                                        technique: 'Skyscraper',
                                        type: 'elimination',
                                        difficultyWeight: this.weights['Skyscraper'],
                                        candidatesRemoved: removed,
                                        reason: `Skyscraper for ${num} in columns ${a.c+1} and ${b.c+1} sharing row ${a.rows[ai]+1}.`
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

    // 4.4: 2-String Kite — row conjugate pair + column conjugate pair linked via a shared box
    findTwoStringKite(grid, candidates) {
        for (let num = 1; num <= 9; num++) {
            const biRows = [], biCols = [];
            for (let r = 0; r < 9; r++) {
                const cols = [];
                for (let c = 0; c < 9; c++) if (grid[r][c] === 0 && candidates[r][c].has(num)) cols.push(c);
                if (cols.length === 2) biRows.push({ r, cols });
            }
            for (let c = 0; c < 9; c++) {
                const rows = [];
                for (let r = 0; r < 9; r++) if (grid[r][c] === 0 && candidates[r][c].has(num)) rows.push(r);
                if (rows.length === 2) biCols.push({ c, rows });
            }
            for (const br of biRows) {
                for (const bc of biCols) {
                    for (let ri = 0; ri < 2; ri++) {
                        for (let ci = 0; ci < 2; ci++) {
                            const boxRCell = { r: br.r, c: br.cols[ri] };
                            const boxCCell = { r: bc.rows[ci], c: bc.c };
                            if (boxRCell.r === boxCCell.r && boxRCell.c === boxCCell.c) continue;
                            if (Math.floor(boxRCell.r / 3) === Math.floor(boxCCell.r / 3) &&
                                Math.floor(boxRCell.c / 3) === Math.floor(boxCCell.c / 3)) {
                                const endR = { r: br.r, c: br.cols[1 - ri] };
                                const endC = { r: bc.rows[1 - ci], c: bc.c };
                                if (Math.floor(endR.c / 3) === Math.floor(boxRCell.c / 3) ||
                                    Math.floor(endC.r / 3) === Math.floor(boxCCell.r / 3)) continue;
                                const tr = endC.r, tc = endR.c;
                                if (grid[tr][tc] === 0 && candidates[tr][tc].has(num)) {
                                    return {
                                        technique: '2-String Kite',
                                        type: 'elimination',
                                        difficultyWeight: this.weights['2-String Kite'],
                                        candidatesRemoved: [{ row: tr, col: tc, number: num }],
                                        reason: `2-String Kite for ${num} in row ${br.r+1} and column ${bc.c+1} eliminates ${num} at (${tr+1},${tc+1}).`
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

    // 4.6: W-Wing — two identical bivalue cells {X,Y} linked by a conjugate pair on X
    findWWing(grid, candidates) {
        const bivalues = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] === 0 && candidates[r][c].size === 2) {
                    bivalues.push({ r, c, vals: [...candidates[r][c]] });
                }
            }
        }
        const units = [];
        for (let i = 0; i < 9; i++) units.push(this.getRowCells(i), this.getColCells(i), this.getBoxCells(i));
        for (let i = 0; i < bivalues.length; i++) {
            for (let j = i + 1; j < bivalues.length; j++) {
                const c1 = bivalues[i], c2 = bivalues[j];
                if (c1.vals[0] !== c2.vals[0] || c1.vals[1] !== c2.vals[1]) continue;
                if (this.arePeers(c1.r, c1.c, c2.r, c2.c)) continue;
                for (const [X, Y] of [[c1.vals[0], c1.vals[1]], [c1.vals[1], c1.vals[0]]]) {
                    let linked = false;
                    for (const unit of units) {
                        const xCells = unit.filter(u => grid[u.r][u.c] === 0 && candidates[u.r][u.c].has(X));
                        if (xCells.length !== 2) continue;
                        const [s1, s2] = xCells;
                        if ((s1.r === c1.r && s1.c === c1.c) || (s1.r === c2.r && s1.c === c2.c) ||
                            (s2.r === c1.r && s2.c === c1.c) || (s2.r === c2.r && s2.c === c2.c)) continue;
                        if ((this.arePeers(s1.r, s1.c, c1.r, c1.c) && this.arePeers(s2.r, s2.c, c2.r, c2.c)) ||
                            (this.arePeers(s1.r, s1.c, c2.r, c2.c) && this.arePeers(s2.r, s2.c, c1.r, c1.c))) {
                            linked = true;
                            break;
                        }
                    }
                    if (!linked) continue;
                    const removed = [];
                    for (let r = 0; r < 9; r++) {
                        for (let c = 0; c < 9; c++) {
                            if (grid[r][c] === 0 && candidates[r][c].has(Y) &&
                                this.arePeers(r, c, c1.r, c1.c) && this.arePeers(r, c, c2.r, c2.c)) {
                                removed.push({ row: r, col: c, number: Y });
                            }
                        }
                    }
                    if (removed.length > 0) {
                        return {
                            technique: 'W-Wing',
                            type: 'elimination',
                            difficultyWeight: this.weights['W-Wing'],
                            candidatesRemoved: removed,
                            reason: `W-Wing on {${X},${Y}} at (${c1.r+1},${c1.c+1}) and (${c2.r+1},${c2.c+1}) linked by ${X}.`
                        };
                    }
                }
            }
        }
        return null;
    }

    // 4.6: Empty Rectangle — box candidates restricted to 1 row + 1 col paired with an outside conjugate link
    findEmptyRectangle(grid, candidates) {
        for (let num = 1; num <= 9; num++) {
            for (let b = 0; b < 9; b++) {
                const br = Math.floor(b / 3), bc = b % 3;
                const boxCells = this.getBoxCells(b).filter(cell => grid[cell.r][cell.c] === 0 && candidates[cell.r][cell.c].has(num));
                if (boxCells.length < 2) continue;
                for (let r0 = br * 3; r0 < br * 3 + 3; r0++) {
                    for (let c0 = bc * 3; c0 < bc * 3 + 3; c0++) {
                        if (!boxCells.every(cell => cell.r === r0 || cell.c === c0)) continue;
                        for (let c1 = 0; c1 < 9; c1++) {
                            if (Math.floor(c1 / 3) === bc) continue;
                            const rows = [];
                            for (let r = 0; r < 9; r++) if (grid[r][c1] === 0 && candidates[r][c1].has(num)) rows.push(r);
                            if (rows.length !== 2 || !rows.includes(r0)) continue;
                            const r2 = rows[0] === r0 ? rows[1] : rows[0];
                            if (Math.floor(r2 / 3) === br) continue;
                            if (grid[r2][c0] === 0 && candidates[r2][c0].has(num)) {
                                return {
                                    technique: 'Empty Rectangle',
                                    type: 'elimination',
                                    difficultyWeight: this.weights['Empty Rectangle'],
                                    candidatesRemoved: [{ row: r2, col: c0, number: num }],
                                    reason: `Empty Rectangle for ${num} in block ${b+1} with column ${c1+1} eliminates ${num} at (${r2+1},${c0+1}).`
                                };
                            }
                        }
                        for (let r1 = 0; r1 < 9; r1++) {
                            if (Math.floor(r1 / 3) === br) continue;
                            const cols = [];
                            for (let c = 0; c < 9; c++) if (grid[r1][c] === 0 && candidates[r1][c].has(num)) cols.push(c);
                            if (cols.length !== 2 || !cols.includes(c0)) continue;
                            const c2 = cols[0] === c0 ? cols[1] : cols[0];
                            if (Math.floor(c2 / 3) === bc) continue;
                            if (grid[r0][c2] === 0 && candidates[r0][c2].has(num)) {
                                return {
                                    technique: 'Empty Rectangle',
                                    type: 'elimination',
                                    difficultyWeight: this.weights['Empty Rectangle'],
                                    candidatesRemoved: [{ row: r0, col: c2, number: num }],
                                    reason: `Empty Rectangle for ${num} in block ${b+1} with row ${r1+1} eliminates ${num} at (${r0+1},${c2+1}).`
                                };
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    // 4.6: Finned X-Wing (rows and columns)
    findFinnedXWing(grid, candidates) {
        for (let num = 1; num <= 9; num++) {
            for (let r1 = 0; r1 < 9; r1++) {
                const cols1 = [];
                for (let c = 0; c < 9; c++) if (grid[r1][c] === 0 && candidates[r1][c].has(num)) cols1.push(c);
                if (cols1.length !== 2) continue;
                for (let r2 = 0; r2 < 9; r2++) {
                    if (Math.floor(r1 / 3) === Math.floor(r2 / 3)) continue;
                    const cols2 = [];
                    for (let c = 0; c < 9; c++) if (grid[r2][c] === 0 && candidates[r2][c].has(num)) cols2.push(c);
                    if (cols2.length < 2 || cols2.length > 4) continue;
                    for (const [cBase, cFinCol] of [[cols1[0], cols1[1]], [cols1[1], cols1[0]]]) {
                        if (Math.floor(cBase / 3) === Math.floor(cFinCol / 3)) continue;
                        if (!cols2.includes(cBase)) continue;
                        const fins = cols2.filter(c => c !== cBase && c !== cFinCol);
                        if (fins.length === 0 || !fins.every(c => Math.floor(c / 3) === Math.floor(cFinCol / 3))) continue;
                        const br2 = Math.floor(r2 / 3) * 3;
                        const removed = [];
                        for (let r = br2; r < br2 + 3; r++) {
                            if (r === r2) continue;
                            if (grid[r][cFinCol] === 0 && candidates[r][cFinCol].has(num)) removed.push({ row: r, col: cFinCol, number: num });
                        }
                        if (removed.length > 0) {
                            return {
                                technique: 'Finned X-Wing',
                                type: 'elimination',
                                difficultyWeight: this.weights['Finned X-Wing'],
                                candidatesRemoved: removed,
                                reason: `Finned X-Wing for ${num} in rows ${r1+1} and ${r2+1}.`
                            };
                        }
                    }
                }
            }
            for (let c1 = 0; c1 < 9; c1++) {
                const rows1 = [];
                for (let r = 0; r < 9; r++) if (grid[r][c1] === 0 && candidates[r][c1].has(num)) rows1.push(r);
                if (rows1.length !== 2) continue;
                for (let c2 = 0; c2 < 9; c2++) {
                    if (Math.floor(c1 / 3) === Math.floor(c2 / 3)) continue;
                    const rows2 = [];
                    for (let r = 0; r < 9; r++) if (grid[r][c2] === 0 && candidates[r][c2].has(num)) rows2.push(r);
                    if (rows2.length < 2 || rows2.length > 4) continue;
                    for (const [rBase, rFinRow] of [[rows1[0], rows1[1]], [rows1[1], rows1[0]]]) {
                        if (Math.floor(rBase / 3) === Math.floor(rFinRow / 3)) continue;
                        if (!rows2.includes(rBase)) continue;
                        const fins = rows2.filter(r => r !== rBase && r !== rFinRow);
                        if (fins.length === 0 || !fins.every(r => Math.floor(r / 3) === Math.floor(rFinRow / 3))) continue;
                        const bc2 = Math.floor(c2 / 3) * 3;
                        const removed = [];
                        for (let c = bc2; c < bc2 + 3; c++) {
                            if (c === c2) continue;
                            if (grid[rFinRow][c] === 0 && candidates[rFinRow][c].has(num)) removed.push({ row: rFinRow, col: c, number: num });
                        }
                        if (removed.length > 0) {
                            return {
                                technique: 'Finned X-Wing',
                                type: 'elimination',
                                difficultyWeight: this.weights['Finned X-Wing'],
                                candidatesRemoved: removed,
                                reason: `Finned X-Wing for ${num} in columns ${c1+1} and ${c2+1}.`
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

    // 4.8: Simple Coloring — single-digit conjugate-pair components (Color Wrap & Color Trap)
    findSimpleColoring(grid, candidates) {
        const units = [];
        for (let i = 0; i < 9; i++) units.push(this.getRowCells(i), this.getColCells(i), this.getBoxCells(i));
        for (let num = 1; num <= 9; num++) {
            const adj = new Map();
            const addEdge = (a, b) => {
                if (!adj.has(a)) adj.set(a, new Set());
                if (!adj.has(b)) adj.set(b, new Set());
                adj.get(a).add(b);
                adj.get(b).add(a);
            };
            for (const unit of units) {
                const pos = unit.filter(u => grid[u.r][u.c] === 0 && candidates[u.r][u.c].has(num));
                if (pos.length === 2) addEdge(pos[0].r * 9 + pos[0].c, pos[1].r * 9 + pos[1].c);
            }
            const color = new Map();
            for (const start of adj.keys()) {
                if (color.has(start)) continue;
                const comp = [[], []];
                const q = [start];
                color.set(start, 0);
                while (q.length) {
                    const u = q.shift();
                    const cu = color.get(u);
                    comp[cu].push({ r: (u / 9) | 0, c: u % 9 });
                    for (const v of adj.get(u)) {
                        if (!color.has(v)) {
                            color.set(v, 1 - cu);
                            q.push(v);
                        }
                    }
                }
                for (let p = 0; p < 2; p++) {
                    let wrap = false;
                    for (let i = 0; i < comp[p].length && !wrap; i++) {
                        for (let j = i + 1; j < comp[p].length; j++) {
                            if (this.arePeers(comp[p][i].r, comp[p][i].c, comp[p][j].r, comp[p][j].c)) {
                                wrap = true;
                                break;
                            }
                        }
                    }
                    if (wrap) {
                        return {
                            technique: 'Simple Coloring',
                            type: 'elimination',
                            difficultyWeight: this.weights['Simple Coloring'],
                            candidatesRemoved: comp[p].map(cell => ({ row: cell.r, col: cell.c, number: num })),
                            reason: `Simple Coloring wrap for ${num} eliminates contradictory color group.`
                        };
                    }
                }
                const inComp = new Set([...comp[0], ...comp[1]].map(x => x.r * 9 + x.c));
                const removed = [];
                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (grid[r][c] !== 0 || !candidates[r][c].has(num) || inComp.has(r * 9 + c)) continue;
                        if (comp[0].some(x => this.arePeers(r, c, x.r, x.c)) &&
                            comp[1].some(x => this.arePeers(r, c, x.r, x.c))) {
                            removed.push({ row: r, col: c, number: num });
                        }
                    }
                }
                if (removed.length > 0) {
                    return {
                        technique: 'Simple Coloring',
                        type: 'elimination',
                        difficultyWeight: this.weights['Simple Coloring'],
                        candidatesRemoved: removed,
                        reason: `Simple Coloring trap for ${num} eliminates candidates seeing both colors.`
                    };
                }
            }
        }
        return null;
    }

    // 5.0: Naked Quad
    findNakedQuad(grid, candidates) {
        for (let i = 0; i < 9; i++) {
            for (const cells of [this.getRowCells(i), this.getColCells(i), this.getBoxCells(i)]) {
                const res = this.findNakedSubsetInUnit(candidates, cells, 4);
                if (res) return { ...res, technique: 'Naked Quad', difficultyWeight: this.weights['Naked Quad'] };
            }
        }
        return null;
    }

    // 5.2 / 5.4: XY-Chain — shortest-first bivalue chain (4 cells = 5.2, 5..7 cells = 5.4)
    findXYChain(grid, candidates) {
        const bi = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] === 0 && candidates[r][c].size === 2) {
                    const [a, b] = [...candidates[r][c]];
                    bi.push({ id: r * 9 + c, r, c, a, b, peers: [] });
                }
            }
        }
        for (let i = 0; i < bi.length; i++) {
            for (let j = i + 1; j < bi.length; j++) {
                if (this.arePeers(bi[i].r, bi[i].c, bi[j].r, bi[j].c)) {
                    bi[i].peers.push(bi[j]);
                    bi[j].peers.push(bi[i]);
                }
            }
        }
        for (let targetLen = 4; targetLen <= 7; targetLen++) {
            const techName = targetLen === 4 ? 'XY-Chain' : 'Long XY-Chain';
            for (const start of bi) {
                for (const [Z, firstLink] of [[start.a, start.b], [start.b, start.a]]) {
                    const visited = new Set([start.id]);
                    const dfs = (curr, outVal, depth) => {
                        if (depth === targetLen) {
                            if (outVal !== Z) return null;
                            const removed = [];
                            for (let r = 0; r < 9; r++) {
                                for (let c = 0; c < 9; c++) {
                                    const id = r * 9 + c;
                                    if (id === start.id || id === curr.id) continue;
                                    if (grid[r][c] === 0 && candidates[r][c].has(Z) &&
                                        this.arePeers(r, c, start.r, start.c) && this.arePeers(r, c, curr.r, curr.c)) {
                                        removed.push({ row: r, col: c, number: Z });
                                    }
                                }
                            }
                            return removed.length > 0 ? { end: curr, removed } : null;
                        }
                        for (const nxt of curr.peers) {
                            if (visited.has(nxt.id)) continue;
                            if (nxt.a !== outVal && nxt.b !== outVal) continue;
                            const nextOut = nxt.a === outVal ? nxt.b : nxt.a;
                            visited.add(nxt.id);
                            const hit = dfs(nxt, nextOut, depth + 1);
                            visited.delete(nxt.id);
                            if (hit) return hit;
                        }
                        return null;
                    };
                    const hit = dfs(start, firstLink, 1);
                    if (hit) {
                        return {
                            technique: techName,
                            type: 'elimination',
                            difficultyWeight: this.weights[techName],
                            candidatesRemoved: hit.removed,
                            reason: `${techName} (${targetLen} cells) between (${start.r+1},${start.c+1}) and (${hit.end.r+1},${hit.end.c+1}) eliminates ${Z}.`
                        };
                    }
                }
            }
        }
        return null;
    }

    // 5.4: Hidden Quad
    findHiddenQuad(grid, candidates) {
        const units = [];
        for (let i = 0; i < 9; i++) {
            units.push({ cells: this.getRowCells(i), name: `row ${i+1}` },
                       { cells: this.getColCells(i), name: `col ${i+1}` },
                       { cells: this.getBoxCells(i), name: `box ${i+1}` });
        }
        for (const unit of units) {
            const unsolved = unit.cells.filter(cell => grid[cell.r][cell.c] === 0 && candidates[cell.r][cell.c].size > 0);
            if (unsolved.length < 5) continue;
            const numPositions = new Map();
            for (let num = 1; num <= 9; num++) {
                const pos = unsolved.filter(cell => candidates[cell.r][cell.c].has(num));
                if (pos.length >= 2 && pos.length <= 4) numPositions.set(num, pos);
            }
            const nums = [...numPositions.keys()];
            if (nums.length < 4) continue;
            for (const quadNums of this.getCombinations(nums, 4)) {
                const cellSet = new Set();
                for (const n of quadNums) for (const p of numPositions.get(n)) cellSet.add(p.r * 9 + p.c);
                if (cellSet.size === 4) {
                    const quadSet = new Set(quadNums);
                    const removed = [];
                    for (const key of cellSet) {
                        const r = (key / 9) | 0, c = key % 9;
                        for (const cand of candidates[r][c]) {
                            if (!quadSet.has(cand)) removed.push({ row: r, col: c, number: cand });
                        }
                    }
                    if (removed.length > 0) {
                        return {
                            technique: 'Hidden Quad',
                            type: 'elimination',
                            difficultyWeight: this.weights['Hidden Quad'],
                            candidatesRemoved: removed,
                            reason: `Hidden Quad {${quadNums.join(',')}} in ${unit.name}.`
                        };
                    }
                }
            }
        }
        return null;
    }

    // 5.6: 3D Medusa — multi-digit XOR coloring across bivalue cells and unit conjugate pairs
    find3DMedusa(grid, candidates) {
        const adj = new Map();
        const key = (r, c, d) => (r * 9 + c) * 10 + d;
        const decode = k => ({ r: ((k / 10) | 0) / 9 | 0, c: ((k / 10) | 0) % 9, d: k % 10 });
        const addEdge = (a, b) => {
            if (!adj.has(a)) adj.set(a, new Set());
            if (!adj.has(b)) adj.set(b, new Set());
            adj.get(a).add(b);
            adj.get(b).add(a);
        };
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] === 0 && candidates[r][c].size === 2) {
                    const [d1, d2] = [...candidates[r][c]];
                    addEdge(key(r, c, d1), key(r, c, d2));
                }
            }
        }
        const units = [];
        for (let i = 0; i < 9; i++) units.push(this.getRowCells(i), this.getColCells(i), this.getBoxCells(i));
        for (let d = 1; d <= 9; d++) {
            for (const unit of units) {
                const pos = unit.filter(u => grid[u.r][u.c] === 0 && candidates[u.r][u.c].has(d));
                if (pos.length === 2) addEdge(key(pos[0].r, pos[0].c, d), key(pos[1].r, pos[1].c, d));
            }
        }
        const conflicts = (a, b) => (a.r === b.r && a.c === b.c && a.d !== b.d) || (a.d === b.d && this.arePeers(a.r, a.c, b.r, b.c));
        const color = new Map();
        for (const start of adj.keys()) {
            if (color.has(start)) continue;
            const comp = [[], []];
            const q = [start];
            color.set(start, 0);
            while (q.length) {
                const u = q.shift();
                const cu = color.get(u);
                comp[cu].push({ k: u, ...decode(u) });
                for (const v of adj.get(u)) {
                    if (!color.has(v)) {
                        color.set(v, 1 - cu);
                        q.push(v);
                    }
                }
            }
            if (comp[0].length + comp[1].length < 3) continue;
            for (let p = 0; p < 2; p++) {
                let wrap = false;
                for (let i = 0; i < comp[p].length && !wrap; i++) {
                    for (let j = i + 1; j < comp[p].length; j++) {
                        if (conflicts(comp[p][i], comp[p][j])) {
                            wrap = true;
                            break;
                        }
                    }
                }
                if (wrap) {
                    return {
                        technique: '3D Medusa',
                        type: 'elimination',
                        difficultyWeight: this.weights['3D Medusa'],
                        candidatesRemoved: comp[p].map(n => ({ row: n.r, col: n.c, number: n.d })),
                        reason: `3D Medusa color contradiction eliminates contradictory candidate group.`
                    };
                }
            }
            const inComp = new Set([...comp[0], ...comp[1]].map(n => n.k));
            const removed = [];
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (grid[r][c] !== 0) continue;
                    for (const d of candidates[r][c]) {
                        const k = key(r, c, d);
                        if (inComp.has(k)) continue;
                        const node = { r, c, d };
                        if (comp[0].some(x => conflicts(node, x)) && comp[1].some(x => conflicts(node, x))) {
                            removed.push({ row: r, col: c, number: d });
                        }
                    }
                }
            }
            if (removed.length > 0) {
                return {
                    technique: '3D Medusa',
                    type: 'elimination',
                    difficultyWeight: this.weights['3D Medusa'],
                    candidatesRemoved: removed,
                    reason: `3D Medusa trap eliminates candidates seeing both colors.`
                };
            }
        }
        return null;
    }

    // 5.8 / 6.0: Alternating Inference Chains (2 strong links = 5.8 AIC, 3 strong links = 6.0 Extended AIC)
    findAIC(grid, candidates) {
        const nodes = [];
        const nodeIdx = new Map();
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] !== 0) continue;
                for (const d of candidates[r][c]) {
                    const id = nodes.length;
                    nodeIdx.set((r * 9 + c) * 10 + d, id);
                    nodes.push({ id, r, c, d, strong: [], weak: [] });
                }
            }
        }
        const addStrong = (k1, k2) => {
            const a = nodeIdx.get(k1), b = nodeIdx.get(k2);
            if (a === undefined || b === undefined || a === b) return;
            if (!nodes[a].strong.includes(b)) {
                nodes[a].strong.push(b);
                nodes[b].strong.push(a);
            }
        };
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] === 0 && candidates[r][c].size === 2) {
                    const [d1, d2] = [...candidates[r][c]];
                    addStrong((r * 9 + c) * 10 + d1, (r * 9 + c) * 10 + d2);
                }
            }
        }
        const units = [];
        for (let i = 0; i < 9; i++) units.push(this.getRowCells(i), this.getColCells(i), this.getBoxCells(i));
        for (let d = 1; d <= 9; d++) {
            for (const unit of units) {
                const pos = unit.filter(u => grid[u.r][u.c] === 0 && candidates[u.r][u.c].has(d));
                if (pos.length === 2) addStrong((pos[0].r * 9 + pos[0].c) * 10 + d, (pos[1].r * 9 + pos[1].c) * 10 + d);
            }
        }
        const conflicts = (a, b) => (a.r === b.r && a.c === b.c && a.d !== b.d) || (a.d === b.d && this.arePeers(a.r, a.c, b.r, b.c));
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].strong.length === 0) continue;
            for (let j = 0; j < nodes.length; j++) {
                if (i !== j && nodes[j].strong.length > 0 && conflicts(nodes[i], nodes[j])) nodes[i].weak.push(j);
            }
        }
        // Pass 1: 2-strong-link AIC (5.8)
        for (const u1 of nodes) {
            for (const v1 of u1.strong) {
                for (const u2 of nodes[v1].weak) {
                    if (u2 === u1.id) continue;
                    for (const v2 of nodes[u2].strong) {
                        if (v2 === u1.id || v2 === v1) continue;
                        const rem = nodes.filter(x => x.id !== u1.id && x.id !== v2 && conflicts(x, u1) && conflicts(x, nodes[v2]));
                        if (rem.length > 0) {
                            return {
                                technique: 'AIC',
                                type: 'elimination',
                                difficultyWeight: this.weights['AIC'],
                                candidatesRemoved: rem.map(x => ({ row: x.r, col: x.c, number: x.d })),
                                reason: `AIC between (${u1.r+1},${u1.c+1})=${u1.d} and (${nodes[v2].r+1},${nodes[v2].c+1})=${nodes[v2].d}.`
                            };
                        }
                    }
                }
            }
        }
        // Pass 2: 3-strong-link Extended AIC (6.0)
        for (const u1 of nodes) {
            for (const v1 of u1.strong) {
                for (const u2 of nodes[v1].weak) {
                    if (u2 === u1.id) continue;
                    for (const v2 of nodes[u2].strong) {
                        if (v2 === u1.id || v2 === v1) continue;
                        for (const u3 of nodes[v2].weak) {
                            if (u3 === u1.id || u3 === v1 || u3 === u2) continue;
                            for (const v3 of nodes[u3].strong) {
                                if (v3 === u1.id || v3 === v1 || v3 === u2 || v3 === v2) continue;
                                const rem = nodes.filter(x => x.id !== u1.id && x.id !== v3 && conflicts(x, u1) && conflicts(x, nodes[v3]));
                                if (rem.length > 0) {
                                    return {
                                        technique: 'Extended AIC',
                                        type: 'elimination',
                                        difficultyWeight: this.weights['Extended AIC'],
                                        candidatesRemoved: rem.map(x => ({ row: x.r, col: x.c, number: x.d })),
                                        reason: `Extended AIC between (${u1.r+1},${u1.c+1})=${u1.d} and (${nodes[v3].r+1},${nodes[v3].c+1})=${nodes[v3].d}.`
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

    // --- Helper Methods ---

    arePeers(r1, c1, r2, c2) {
        if (r1 === r2 && c1 === c2) return false;
        return r1 === r2 || c1 === c2 || (Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3));
    }

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
                    consecutiveCount = 1;
                }
            } else {
                consecutiveCount = 1;
            }
        }
        
        // D. Opening Cascade — first 8 steps should be Singles
        const openingSize = Math.min(8, steps.length);
        let openingAllSingles = true;
        for (let i = 0; i < openingSize; i++) {
            if (!steps[i].technique.includes('Single')) {
                openingAllSingles = false;
                break;
            }
        }
        if (openingAllSingles) {
            score += 10; // Reward smooth opening
        } else {
            score -= 15; // Punish jarring starts
        }
        
        // E. Single Crux — at most 1 contiguous advanced section (SE > 4.0)
        let hardSections = 0;
        let inHardSection = false;
        for (const step of steps) {
            if (step.difficultyWeight > 4.0) {
                if (!inHardSection) {
                    hardSections++;
                    inHardSection = true;
                }
            } else {
                inHardSection = false;
            }
        }
        if (hardSections <= 1) {
            score += 5; // Clean single crux
        } else {
            score -= (hardSections - 1) * 10; // Multiple hard sections feel choppy
        }
        
        // F. Resolution Speed — last 25% of steps should be Singles
        const tailStart = Math.floor(steps.length * 0.75);
        let tailAllSingles = true;
        for (let i = tailStart; i < steps.length; i++) {
            if (!steps[i].technique.includes('Single')) {
                tailAllSingles = false;
                break;
            }
        }
        if (tailAllSingles) score += 5;
        
        // G. Path Smoothness (Reward gradual increase)
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

    /**
     * Classifies the solve path shape for diagnostic visibility.
     * Returns: 'cascade' | 'plateau' | 'spike' | 'choppy'
     */
    classifySolveCurve(steps) {
        if (steps.length === 0) return 'cascade';
        
        const maxWeight = Math.max(...steps.map(s => s.difficultyWeight));
        if (maxWeight <= 2.3) return 'cascade'; // All singles — perfect flow
        
        // Find advanced sections (SE > 4.0)
        let hardSections = 0;
        let inHard = false;
        for (const step of steps) {
            if (step.difficultyWeight > 4.0) {
                if (!inHard) { hardSections++; inHard = true; }
            } else {
                inHard = false;
            }
        }
        
        if (hardSections === 0) return 'plateau'; // Medium techniques throughout, no spikes
        if (hardSections === 1) return 'spike';     // One hard moment — acceptable crux
        return 'choppy'; // Multiple hard spots — feels random
    }

    getDifficultyLabel(maxWeight) {
        if (maxWeight <= 2.3) return 'easy';       // Singles
        if (maxWeight <= 2.8) return 'medium';     // Locked candidates
        if (maxWeight <= 4.0) return 'hard';       // Subsets and basic fish
        if (maxWeight <= 6.0) return 'expert';     // Wings and advanced patterns
        return 'master';                           // Chains and inference nets
    }
}

// Global instance for browser access
window.SarpSolver = SarpSolver;
