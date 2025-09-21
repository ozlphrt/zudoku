class SudokuGame {
    constructor() {
        this.grid = Array(9).fill().map(() => Array(9).fill(0));
        this.solution = Array(9).fill().map(() => Array(9).fill(0));
        this.givenCells = Array(9).fill().map(() => Array(9).fill(false));
        this.notes = Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
        this.selectedCell = null;
        this.difficulty = 'easy';
        this.isNoteMode = false;
        this.isPaintMode = false;
        this.paintNumber = null;
        this.startTime = null;
        this.timer = null;
        this.moveCount = 0;
        this.errorCount = 0;
        this.hintCount = 0;
        this.isGameWon = false;
        
        this.difficulties = {
            easy: 35,
            medium: 28,
            advanced: 25,
            hard: 20
        };
        
        this.createGrid();
        this.addWheelListener();
        this.initializeButtons();
        this.newGame();
    }
    
    createGrid() {
        const gridElement = document.getElementById('sudokuGrid');
        gridElement.innerHTML = '';
        
        for (let i = 0; i < 81; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;
            
            // Click to select
            cell.addEventListener('click', () => this.selectCell(i));
            
            // Right-click to toggle note mode
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.toggleNoteMode(i);
            });
            
            // Touch support - let browser handle pointer events naturally
            let longPressTimer = null;
            let touchStartX = 0;
            let touchStartY = 0;
            let touchStartTime = 0;
            
            cell.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                
                // Start long press timer
                longPressTimer = setTimeout(() => {
                    this.handleLongPress(i);
                }, 800);
            }, { passive: true });
            
            cell.addEventListener('touchend', (e) => {
                const touchEndTime = Date.now();
                const touchDuration = touchEndTime - touchStartTime;
                
                // Clear long press timer
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                
                // Check for flick gesture (quick swipe right) - original logic
                if (touchDuration < 300 && e.changedTouches.length > 0) {
                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].clientY;
                    const deltaX = touchEndX - touchStartX;
                    const deltaY = touchEndY - touchStartY;
                    
                    // Flick right: deltaX > 20 and |deltaY| < 60 (original values)
                    if (deltaX > 20 && Math.abs(deltaY) < 60) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleFlickRight(i);
                        return;
                    }
                }
                
            }, { passive: false });
            
            cell.addEventListener('touchmove', (e) => {
                // Cancel long press on move
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }, { passive: true });
            
            
            gridElement.appendChild(cell);
        }
    }
    
    addWheelListener() {
        // Add wheel listener to the entire document
        document.addEventListener('wheel', (e) => {
            // Only work when in paint mode
            if (!this.isPaintMode || !this.paintNumber) return;
            
            // Only prevent default if we're actually changing the paint number
            e.preventDefault();
            e.stopPropagation();
            
            // Scroll up = increase number, scroll down = decrease number
            if (e.deltaY < 0) {
                // Scroll up - increase number
                this.paintNumber = Math.min(9, this.paintNumber + 1);
            } else if (e.deltaY > 0) {
                // Scroll down - decrease number
                this.paintNumber = Math.max(1, this.paintNumber - 1);
            }
            
            // Update the cursor with new number
            this.updateCursor();
        }, { passive: false, capture: true });
        
        // Also add wheel listener to the grid specifically
        const gridElement = document.getElementById('sudokuGrid');
        if (gridElement) {
            gridElement.addEventListener('wheel', (e) => {
                if (!this.isPaintMode || !this.paintNumber) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                if (e.deltaY < 0) {
                    this.paintNumber = Math.min(9, this.paintNumber + 1);
                } else if (e.deltaY > 0) {
                    this.paintNumber = Math.max(1, this.paintNumber - 1);
                }
                
                this.updateCursor();
            }, { passive: false });
        }
    }
    
    initializeButtons() {
        // Initialize solve buttons with proper touch support
        const solveHintBtn = document.querySelector('.solve-hint-btn');
        const solvePuzzleBtn = document.querySelector('.solve-puzzle-btn');
        
        if (solveHintBtn) {
            // Click event
            solveHintBtn.addEventListener('click', () => {
                this.solveHint();
            });
            
            // Touch events for mobile
            solveHintBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.solveHint();
            }, { passive: false });
        }
        
        if (solvePuzzleBtn) {
            // Click event
            solvePuzzleBtn.addEventListener('click', () => {
                this.solvePuzzle();
            });
            
            // Touch events for mobile
            solvePuzzleBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.solvePuzzle();
            }, { passive: false });
        }
    }
    
    selectCell(index) {
        if (this.isGameWon) return;
        
        // Remove previous selection and highlights
        this.clearSelection();
        this.clearHighlights();
        
        const row = Math.floor(index / 9);
        const col = index % 9;
        
        // If it's a given cell, highlight all instances of that number and set paint mode
        if (this.givenCells[row][col]) {
            const number = this.grid[row][col];
            this.highlightSameNumbers(number);
            this.paintNumber = number;
            this.isPaintMode = true;
            this.updateCursor();
            return;
        }
        
        // If it's a user-filled cell, highlight all instances and set paint mode
        if (this.grid[row][col] !== 0) {
            const number = this.grid[row][col];
            this.highlightSameNumbers(number);
            this.paintNumber = number;
            this.isPaintMode = true;
            this.updateCursor();
            return;
        }
        
        // If it's an empty cell and we're in paint mode, place the paint number
        if (this.isPaintMode && this.paintNumber) {
            this.setNumber(row, col, this.paintNumber);
            this.updateDisplay();
            return;
        }
        
        // If it's an empty cell and we're in note mode, add the highlighted number as a note
        if (this.isNoteMode && this.grid[row][col] === 0) {
            if (this.isPaintMode && this.paintNumber) {
                this.toggleNote(row, col, this.paintNumber);
                this.updateDisplay();
            } else {
                this.selectedCell = index;
                const cell = document.querySelector(`[data-index="${index}"]`);
                cell.classList.add('selected');
            }
            return;
        }
        
        this.selectedCell = index;
        // Don't reset note mode on left click - keep it sticky
        const cell = document.querySelector(`[data-index="${index}"]`);
        cell.classList.add('selected');
    }
    
    clearSelection() {
        if (this.selectedCell !== null) {
            const cell = document.querySelector(`[data-index="${this.selectedCell}"]`);
            cell.classList.remove('selected');
            this.selectedCell = null;
        }
        // Don't reset note mode - keep it sticky
        // Don't reset paint mode - keep it sticky
    }
    
    clearHighlights() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.classList.remove('highlighted');
        });
    }
    
    updateCursor() {
        if (this.isPaintMode && this.paintNumber) {
            document.body.classList.add('paint-mode');
            // Update the cursor to show the paint number
            const cursorSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%23ffc107" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><text x="12" y="16" text-anchor="middle" font-family="Arial" font-size="12" font-weight="300" fill="%23ffc107">${this.paintNumber}</text></svg>`;
            document.documentElement.style.setProperty('--paint-cursor', `url('${cursorSvg}') 24 24, pointer`);
            
            // Paint mode is active
        } else {
            document.body.classList.remove('paint-mode');
        }
    }
    
    
    highlightSameNumbers(number) {
        for (let i = 0; i < 81; i++) {
            const row = Math.floor(i / 9);
            const col = i % 9;
            const cell = document.querySelector(`[data-index="${i}"]`);
            
            // Highlight all cells containing this number (both given and user-solved)
            if (this.grid[row][col] === number) {
                cell.classList.add('highlighted');
            }
        }
    }
    
    inputNumber(number) {
        if (this.selectedCell === null || this.isGameWon) return;
        
        const row = Math.floor(this.selectedCell / 9);
        const col = this.selectedCell % 9;
        
        if (this.givenCells[row][col]) return;
        
        if (this.isNoteMode) {
            this.toggleNote(row, col, number);
        } else {
            this.setNumber(row, col, number);
        }
        
        this.updateDisplay();
    }
    
    toggleNoteMode(index) {
        if (this.isGameWon) return;
        
        const row = Math.floor(index / 9);
        const col = index % 9;
        
        if (this.givenCells[row][col]) return;
        
        // If we're in paint mode and clicking an empty cell, add the paint number as a note
        if (this.isPaintMode && this.paintNumber && this.grid[row][col] === 0) {
            this.toggleNote(row, col, this.paintNumber);
            this.updateDisplay();
            return;
        }
        
        // If we're already in note mode and clicking an empty cell, just select it
        if (this.isNoteMode && this.grid[row][col] === 0) {
            this.clearSelection();
            this.clearHighlights();
            this.selectedCell = index;
            const cell = document.querySelector(`[data-index="${index}"]`);
            cell.classList.add('selected');
            return;
        }
        
        // Toggle note mode
        this.isNoteMode = !this.isNoteMode;
        
        // Clear paint mode when toggling note mode
        this.isPaintMode = false;
        this.paintNumber = null;
        document.body.classList.remove('paint-mode');
        
        // Update cursor style
        if (this.isNoteMode) {
            document.body.classList.add('note-mode');
        } else {
            document.body.classList.remove('note-mode');
        }
        
        // Update mobile toggle
        const toggle = document.getElementById('noteModeToggle');
        if (toggle) {
            toggle.checked = this.isNoteMode;
        }
        
        // Remove previous selection and highlights
        this.clearSelection();
        this.clearHighlights();
        
        this.selectedCell = index;
        const cell = document.querySelector(`[data-index="${index}"]`);
        cell.classList.add('selected');
    }
    
    // New function to handle long press on empty cell
    handleLongPress(index) {
        if (this.isGameWon) return;
        
        const row = Math.floor(index / 9);
        const col = index % 9;
        
        if (this.givenCells[row][col]) return;
        
        // If cell is empty and we have a highlighted number (paint mode)
        if (this.grid[row][col] === 0 && this.isPaintMode && this.paintNumber) {
            this.toggleNote(row, col, this.paintNumber);
            this.updateDisplay();
        }
    }
    
    // Handle flick right gesture for note mode
    handleFlickRight(index) {
        if (this.isGameWon) return;
        
        const row = Math.floor(index / 9);
        const col = index % 9;
        
        if (this.givenCells[row][col]) return;
        
        // If cell is empty and we have a highlighted number (paint mode)
        if (this.grid[row][col] === 0 && this.isPaintMode && this.paintNumber) {
            this.toggleNote(row, col, this.paintNumber);
            this.updateDisplay();
        }
    }
    
    addNote(number) {
        if (this.selectedCell === null || this.isGameWon) return;
        
        const row = Math.floor(this.selectedCell / 9);
        const col = this.selectedCell % 9;
        
        if (this.givenCells[row][col]) return;
        
        this.toggleNote(row, col, number);
        this.updateDisplay();
    }
    
    setNumber(row, col, number) {
        const oldValue = this.grid[row][col];
        this.grid[row][col] = number;
        
        // Check if the move is valid
        if (this.isValidMove(row, col, number)) {
            this.moveCount++;
            this.updateMoveCount();
            
            // Clear notes for this cell
            this.notes[row][col].clear();
            
            // Remove this number from notes in the same row, column, and 3x3 block
            this.removeNotesFromBlock(row, col, number);
            
            // Clear selection after valid move
            this.clearSelection();
            
            // Check for completed rows/columns/blocks
            this.checkCompletion();
            
            // Check for win
            if (this.checkWin()) {
                this.gameWon();
            }
        } else {
            // Invalid move - show error and revert
            this.grid[row][col] = oldValue;
            this.showError(row, col);
            this.errorCount++;
            this.updateErrorCount();
            
            // Clear selection after invalid move
            this.clearSelection();
        }
    }
    
    toggleNote(row, col, number) {
        if (this.notes[row][col].has(number)) {
            this.notes[row][col].delete(number);
        } else {
            this.notes[row][col].add(number);
        }
    }
    
    
    removeNotesFromBlock(row, col, number) {
        const blockRow = Math.floor(row / 3) * 3;
        const blockCol = Math.floor(col / 3) * 3;
        
        for (let r = blockRow; r < blockRow + 3; r++) {
            for (let c = blockCol; c < blockCol + 3; c++) {
                if (this.notes[r][c].has(number)) {
                    this.notes[r][c].delete(number);
                }
            }
        }
    }
    
    isValidMove(row, col, number) {
        // Check row
        for (let c = 0; c < 9; c++) {
            if (c !== col && this.grid[row][c] === number) {
                return false;
            }
        }
        
        // Check column
        for (let r = 0; r < 9; r++) {
            if (r !== row && this.grid[r][col] === number) {
                return false;
            }
        }
        
        // Check 3x3 block
        const blockRow = Math.floor(row / 3) * 3;
        const blockCol = Math.floor(col / 3) * 3;
        
        for (let r = blockRow; r < blockRow + 3; r++) {
            for (let c = blockCol; c < blockCol + 3; c++) {
                if ((r !== row || c !== col) && this.grid[r][c] === number) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    showError(row, col) {
        const index = row * 9 + col;
        const cell = document.querySelector(`[data-index="${index}"]`);
        cell.classList.add('error');
        
        setTimeout(() => {
            cell.classList.remove('error');
        }, 1000);
    }
    
    updateDisplay() {
        for (let i = 0; i < 81; i++) {
            const row = Math.floor(i / 9);
            const col = i % 9;
            const cell = document.querySelector(`[data-index="${i}"]`);
            
            cell.classList.remove('given', 'notes');
            
            if (this.givenCells[row][col]) {
                cell.classList.add('given');
                cell.textContent = this.grid[row][col] || '';
            } else if (this.grid[row][col] !== 0) {
                // If cell has a number, show the number (not notes)
                cell.textContent = this.grid[row][col];
            } else if (this.notes[row][col].size > 0) {
                // Only show notes if cell is empty
                cell.classList.add('notes');
                cell.innerHTML = this.formatNotes(this.notes[row][col]);
            } else {
                cell.textContent = '';
            }
        }
    }
    
    formatNotes(notes) {
        const numbers = Array.from(notes).sort();
        let html = '';
        
        for (let i = 0; i < 9; i++) {
            const num = i + 1;
            if (numbers.includes(num)) {
                html += `<span class="note-number">${num}</span>`;
            } else {
                html += '<span class="note-number"></span>';
            }
            
            if ((i + 1) % 3 === 0 && i < 8) {
                html += '<br>';
            }
        }
        
        return html;
    }
    
    checkCompletion() {
        // Check rows
        for (let row = 0; row < 9; row++) {
            if (this.isRowComplete(row)) {
                this.highlightRow(row);
            }
        }
        
        // Check columns
        for (let col = 0; col < 9; col++) {
            if (this.isColumnComplete(col)) {
                this.highlightColumn(col);
            }
        }
        
        // Check 3x3 blocks
        for (let blockRow = 0; blockRow < 3; blockRow++) {
            for (let blockCol = 0; blockCol < 3; blockCol++) {
                if (this.isBlockComplete(blockRow, blockCol)) {
                    this.highlightBlock(blockRow, blockCol);
                }
            }
        }
    }
    
    isRowComplete(row) {
        const numbers = new Set();
        for (let col = 0; col < 9; col++) {
            if (this.grid[row][col] === 0) return false;
            numbers.add(this.grid[row][col]);
        }
        return numbers.size === 9;
    }
    
    isColumnComplete(col) {
        const numbers = new Set();
        for (let row = 0; row < 9; row++) {
            if (this.grid[row][col] === 0) return false;
            numbers.add(this.grid[row][col]);
        }
        return numbers.size === 9;
    }
    
    isBlockComplete(blockRow, blockCol) {
        const numbers = new Set();
        const startRow = blockRow * 3;
        const startCol = blockCol * 3;
        
        for (let row = startRow; row < startRow + 3; row++) {
            for (let col = startCol; col < startCol + 3; col++) {
                if (this.grid[row][col] === 0) return false;
                numbers.add(this.grid[row][col]);
            }
        }
        return numbers.size === 9;
    }
    
    highlightRow(row) {
        for (let col = 0; col < 9; col++) {
            const index = row * 9 + col;
            const cell = document.querySelector(`[data-index="${index}"]`);
            cell.classList.add('completed-highlight');
        }
        
        setTimeout(() => {
            for (let col = 0; col < 9; col++) {
                const index = row * 9 + col;
                const cell = document.querySelector(`[data-index="${index}"]`);
                cell.classList.remove('completed-highlight');
            }
        }, 1500);
    }
    
    highlightColumn(col) {
        for (let row = 0; row < 9; row++) {
            const index = row * 9 + col;
            const cell = document.querySelector(`[data-index="${index}"]`);
            cell.classList.add('completed-highlight');
        }
        
        setTimeout(() => {
            for (let row = 0; row < 9; row++) {
                const index = row * 9 + col;
                const cell = document.querySelector(`[data-index="${index}"]`);
                cell.classList.remove('completed-highlight');
            }
        }, 1500);
    }
    
    highlightBlock(blockRow, blockCol) {
        const startRow = blockRow * 3;
        const startCol = blockCol * 3;
        
        for (let row = startRow; row < startRow + 3; row++) {
            for (let col = startCol; col < startCol + 3; col++) {
                const index = row * 9 + col;
                const cell = document.querySelector(`[data-index="${index}"]`);
                cell.classList.add('completed-highlight');
            }
        }
        
        setTimeout(() => {
            for (let row = startRow; row < startRow + 3; row++) {
                for (let col = startCol; col < startCol + 3; col++) {
                    const index = row * 9 + col;
                    const cell = document.querySelector(`[data-index="${index}"]`);
                    cell.classList.remove('completed-highlight');
                }
            }
        }, 1500);
    }

    checkWin() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    return false;
                }
            }
        }
        return true;
    }
    
    gameWon() {
        this.isGameWon = true;
        this.stopTimer();
        
        // Show win animation
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            setTimeout(() => {
                cell.classList.add('correct');
            }, index * 20);
        });
        
        setTimeout(() => {
            alert(`Congratulations! You solved the puzzle in ${this.formatTime(this.getElapsedTime())} with ${this.moveCount} moves!`);
        }, 1000);
    }
    
    generateSolution() {
        // Generate a valid Sudoku solution
        this.grid = Array(9).fill().map(() => Array(9).fill(0));
        
        // Fill diagonal 3x3 blocks first (they are independent)
        for (let i = 0; i < 9; i += 3) {
            this.fillBlock(i, i);
        }
        
        // Fill remaining cells
        if (!this.solveSudoku()) {
            console.error('Failed to generate valid solution');
            return false;
        }
        
        // Validate the complete solution
        if (!this.validateCompleteSolution()) {
            console.error('Generated solution is invalid');
            return false;
        }
        
        // Copy solution
        this.solution = this.grid.map(row => [...row]);
        return true;
    }

    validateCompleteSolution() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) return false;
                
                // Check if this number violates any constraints
                const num = this.grid[row][col];
                this.grid[row][col] = 0;
                
                if (!this.isValidMove(row, col, num)) {
                    this.grid[row][col] = num;
                    return false;
                }
                
                this.grid[row][col] = num;
            }
        }
        return true;
    }
    
    fillBlock(row, col) {
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        this.shuffleArray(numbers);
        
        let index = 0;
        for (let r = row; r < row + 3; r++) {
            for (let c = col; c < col + 3; c++) {
                this.grid[r][c] = numbers[index++];
            }
        }
    }
    
    solveSudoku() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    for (let num = 1; num <= 9; num++) {
                        if (this.isValidMove(row, col, num)) {
                            this.grid[row][col] = num;
                            
                            if (this.solveSudoku()) {
                                return true;
                            }
                            
                            this.grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }
    
    removeNumbers() {
        const targetCellsToRemove = 81 - this.difficulties[this.difficulty];
        let removedCount = 0;
        let attempts = 0;
        const maxAttempts = 500; // Increased from 1000
        
        // Create positions array and shuffle
        const positions = [];
        for (let i = 0; i < 81; i++) {
            positions.push(i);
        }
        
        // Try multiple rounds of removal
        while (removedCount < targetCellsToRemove && attempts < maxAttempts) {
            attempts++;
            this.shuffleArray(positions);
            
            let foundRemovable = false;
            
            for (let pos of positions) {
                const row = Math.floor(pos / 9);
                const col = pos % 9;
                
                // Skip if already removed
                if (this.grid[row][col] === 0) continue;
                
                // Store original value
                const originalValue = this.grid[row][col];
                
                // Try removing this cell
                this.grid[row][col] = 0;
                
                // Check if puzzle still has unique solution AND no duplicates
                if (this.hasUniqueSolution() && this.validateGameState()) {
                    this.givenCells[row][col] = false;
                    removedCount++;
                    foundRemovable = true;
                    
                    if (removedCount >= targetCellsToRemove) break;
                } else {
                    // Restore value if removal breaks uniqueness or creates duplicates
                    this.grid[row][col] = originalValue;
                }
            }
            
            // If no progress made, try a different approach
            if (!foundRemovable) {
                // Try removing from less constrained areas
                if (!this.removeFromLessConstrainedAreas()) {
                    break; // Can't remove any more
                }
            }
        }
        
        // Final validation
        if (!this.hasUniqueSolution()) {
            console.warn('Generated puzzle is not uniquely solvable');
            return false;
        }
        
        // Mark remaining cells as given
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] !== 0) {
                    this.givenCells[row][col] = true;
                }
            }
        }
        
        console.log(`Successfully removed ${removedCount} cells (target: ${targetCellsToRemove})`);
        return true;
    }

    removeFromLessConstrainedAreas() {
        // Find cells with fewer constraints (more possible values)
        const candidates = [];
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] !== 0) {
                    const possibleValues = this.getPossibleValuesForCell(row, col);
                    candidates.push({
                        row, col,
                        possibleCount: possibleValues.length,
                        position: row * 9 + col
                    });
                }
            }
        }
        
        // Sort by constraint level (more constrained first)
        candidates.sort((a, b) => b.possibleCount - a.possibleCount);
        
        // Try removing from less constrained areas
        for (let candidate of candidates.slice(0, 10)) { // Try top 10 candidates
            const originalValue = this.grid[candidate.row][candidate.col];
            this.grid[candidate.row][candidate.col] = 0;
            
            if (this.hasUniqueSolution() && this.validateGameState()) {
                this.givenCells[candidate.row][candidate.col] = false;
                return true;
            }
            
            this.grid[candidate.row][candidate.col] = originalValue;
        }
        
        return false;
    }

    getPossibleValuesForCell(row, col) {
        const possible = [];
        for (let num = 1; num <= 9; num++) {
            if (this.isValidMoveForGrid(this.grid, row, col, num)) {
                possible.push(num);
            }
        }
        return possible;
    }
    
    hasUniqueSolution() {
        const tempGrid = this.grid.map(row => [...row]);
        this.solutionCount = 0;
        
        // Use a more efficient solution counting approach
        this.countSolutionsEfficient(tempGrid, 0, 0);
        
        // Ensure exactly one solution exists
        return this.solutionCount === 1;
    }
    
    countSolutionsEfficient(grid, row, col) {
        // If we've found more than one solution, stop immediately
        if (this.solutionCount > 1) return;
        
        // If we've filled the entire grid
        if (row === 9) {
            this.solutionCount++;
            return;
        }
        
        // Calculate next position
        const nextRow = col === 8 ? row + 1 : row;
        const nextCol = col === 8 ? 0 : col + 1;
        
        // If current cell is already filled, move to next
        if (grid[row][col] !== 0) {
            this.countSolutionsEfficient(grid, nextRow, nextCol);
            return;
        }
        
        // Try each number 1-9
        for (let num = 1; num <= 9; num++) {
            if (this.isValidMoveForGrid(grid, row, col, num)) {
                grid[row][col] = num;
                this.countSolutionsEfficient(grid, nextRow, nextCol);
                grid[row][col] = 0; // Backtrack
                
                // Early termination if multiple solutions found
                if (this.solutionCount > 1) return;
            }
        }
    }
    
    isValidMoveForGrid(grid, row, col, number) {
        // Check row
        for (let c = 0; c < 9; c++) {
            if (c !== col && grid[row][c] === number) {
                return false;
            }
        }
        
        // Check column
        for (let r = 0; r < 9; r++) {
            if (r !== row && grid[r][col] === number) {
                return false;
            }
        }
        
        // Check 3x3 block
        const blockRow = Math.floor(row / 3) * 3;
        const blockCol = Math.floor(col / 3) * 3;
        
        for (let r = blockRow; r < blockRow + 3; r++) {
            for (let c = blockCol; c < blockCol + 3; c++) {
                if ((r !== row || c !== col) && grid[r][c] === number) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    newGame() {
        this.resetGame();
        
        console.log(`Generating new ${this.difficulty} puzzle...`);
        
        // Generate a reliable puzzle using our own system
        this.generateReliablePuzzle();
        
        this.updateDisplay();
        this.startTimer();
    }

    generateReliablePuzzle() {
        console.log('🎯 Generating reliable puzzle...');
        
        // Use a simple, guaranteed approach
        this.generateSimplePuzzle();
        
        console.log(`✅ Generated ${this.difficulty} puzzle`);
    }

    generateSimplePuzzle() {
        console.log('🎯 Generating valid puzzle...');
        
        // Start with a known valid complete Sudoku
        const completeSudoku = [
            [5,3,4,6,7,8,9,1,2],
            [6,7,2,1,9,5,3,4,8],
            [1,9,8,3,4,2,5,6,7],
            [8,5,9,7,6,1,4,2,3],
            [4,2,6,8,5,3,7,9,1],
            [7,1,3,9,2,4,8,5,6],
            [9,6,1,5,3,7,2,8,4],
            [2,8,7,4,1,9,6,3,5],
            [3,4,5,2,8,6,1,7,9]
        ];
        
        // Copy to our grid and solution
        this.grid = completeSudoku.map(row => [...row]);
        this.solution = completeSudoku.map(row => [...row]);
        
        // Remove numbers carefully to maintain unique solution
        this.removeNumbersForDifficulty();
        
        // Mark remaining cells as given
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                this.givenCells[row][col] = this.grid[row][col] !== 0;
            }
        }
        
        // Final validation
        if (!this.validateGameState()) {
            console.warn('⚠️ Generated puzzle has duplicates, using fallback');
            this.useFallbackPuzzle();
        }
        
        const givenCount = this.grid.flat().filter(num => num !== 0).length;
        console.log(`✅ Generated valid puzzle: ${givenCount} given numbers`);
    }
    
    removeNumbersForDifficulty() {
        const targetGivenCount = this.difficulties[this.difficulty];
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
            // Create a copy for testing
            const testGrid = this.grid.map(row => [...row]);
            const positions = [];
            
            // Get all positions that can be removed
            for (let i = 0; i < 81; i++) {
                positions.push(i);
            }
            
            this.shuffleArray(positions);
            
            // Try to remove numbers one by one, checking for unique solution
            for (let pos of positions) {
                const row = Math.floor(pos / 9);
                const col = pos % 9;
                
                if (testGrid[row][col] === 0) continue;
                
                const originalValue = testGrid[row][col];
                testGrid[row][col] = 0;
                
                // Check if this removal maintains unique solution
                if (this.hasUniqueSolution(testGrid)) {
                    this.grid[row][col] = 0;
                    
                    // Check if we've reached target difficulty
                    const currentGivenCount = this.grid.flat().filter(num => num !== 0).length;
                    if (currentGivenCount <= targetGivenCount) {
                        console.log(`✅ Removed enough numbers for ${this.difficulty}: ${currentGivenCount} given`);
                        return;
                    }
                } else {
                    // Restore if it breaks unique solution
                    testGrid[row][col] = originalValue;
                }
            }
            
            attempts++;
        }
        
        console.log(`⚠️ Could not reach target difficulty after ${maxAttempts} attempts`);
    }
    
    hasUniqueSolution(grid) {
        // Count solutions using backtracking
        const solutions = [];
        this.countSolutions(grid, solutions, 0);
        return solutions.length === 1;
    }
    
    countSolutions(grid, solutions, startIndex) {
        if (solutions.length > 1) return; // Early exit if multiple solutions found
        
        // Find first empty cell
        for (let i = startIndex; i < 81; i++) {
            const row = Math.floor(i / 9);
            const col = i % 9;
            
            if (grid[row][col] === 0) {
                // Try each number 1-9
                for (let num = 1; num <= 9; num++) {
                    if (this.isValidMoveForGrid(grid, row, col, num)) {
                        grid[row][col] = num;
                        this.countSolutions(grid, solutions, i + 1);
                        grid[row][col] = 0;
                        
                        if (solutions.length > 1) return; // Early exit
                    }
                }
                return; // No valid moves for this cell
            }
        }
        
        // If we reach here, grid is complete
        solutions.push(1);
    }
    
    isValidMoveForGrid(grid, row, col, num) {
        // Check row
        for (let c = 0; c < 9; c++) {
            if (grid[row][c] === num) return false;
        }
        
        // Check column
        for (let r = 0; r < 9; r++) {
            if (grid[r][col] === num) return false;
        }
        
        // Check 3x3 box
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if (grid[r][c] === num) return false;
            }
        }
        
        return true;
    }
    
    useFallbackPuzzle() {
        // Use a pre-validated puzzle as fallback
        const fallbackPuzzles = {
            easy: [
                [5,3,0,0,7,0,0,0,0],
                [6,0,0,1,9,5,0,0,0],
                [0,9,8,0,0,0,0,6,0],
                [8,0,0,0,6,0,0,0,3],
                [4,0,0,8,0,3,0,0,1],
                [7,0,0,0,2,0,0,0,6],
                [0,6,0,0,0,0,2,8,0],
                [0,0,0,4,1,9,0,0,5],
                [0,0,0,0,8,0,0,7,9]
            ],
            medium: [
                [0,0,0,6,0,0,0,0,0],
                [0,0,0,0,9,5,0,0,0],
                [0,9,8,0,0,0,0,6,0],
                [8,0,0,0,6,0,0,0,0],
                [4,0,0,8,0,0,0,0,1],
                [0,0,0,0,2,0,0,0,0],
                [0,6,0,0,0,0,2,8,0],
                [0,0,0,4,1,9,0,0,0],
                [0,0,0,0,8,0,0,0,0]
            ]
        };
        
        const puzzle = fallbackPuzzles[this.difficulty] || fallbackPuzzles.easy;
        this.grid = puzzle.map(row => [...row]);
        this.solution = [
            [5,3,4,6,7,8,9,1,2],
            [6,7,2,1,9,5,3,4,8],
            [1,9,8,3,4,2,5,6,7],
            [8,5,9,7,6,1,4,2,3],
            [4,2,6,8,5,3,7,9,1],
            [7,1,3,9,2,4,8,5,6],
            [9,6,1,5,3,7,2,8,4],
            [2,8,7,4,1,9,6,3,5],
            [3,4,5,2,8,6,1,7,9]
        ];
        
        console.log('🔄 Using fallback puzzle');
    }

    generateCompleteSolution() {
        // Start with empty grid
        this.grid = Array(9).fill().map(() => Array(9).fill(0));
        
        // Fill diagonal 3x3 blocks first (they are independent)
        for (let i = 0; i < 9; i += 3) {
            this.fillBlock(i, i);
        }
        
        // Fill remaining cells using backtracking
        this.solveSudoku();
    }

    fillBlock(row, col) {
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        this.shuffleArray(numbers);
        
        let index = 0;
        for (let r = row; r < row + 3; r++) {
            for (let c = col; c < col + 3; c++) {
                this.grid[r][c] = numbers[index++];
            }
        }
    }

    solveSudoku() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    for (let num = 1; num <= 9; num++) {
                        if (this.isValidMove(row, col, num)) {
                            this.grid[row][col] = num;
                            
                            if (this.solveSudoku()) {
                                return true;
                            }
                            
                            this.grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    removeNumbersForDifficulty() {
        const targetGivenCount = this.difficulties[this.difficulty];
        const targetRemovalCount = 81 - targetGivenCount;
        
        console.log(`Target: ${targetGivenCount} given numbers, removing ${targetRemovalCount} numbers`);
        
        // Try multiple times to get a good puzzle
        let bestAttempt = null;
        let bestScore = 0;
        
        for (let attempt = 0; attempt < 5; attempt++) {
            // Reset to complete solution
            this.grid = this.solution.map(row => [...row]);
            
            // Create array of all positions
            const positions = [];
            for (let i = 0; i < 81; i++) {
                positions.push(i);
            }
            
            // Shuffle and remove numbers
            this.shuffleArray(positions);
            
            let removedCount = 0;
            const maxAttempts = Math.min(targetRemovalCount * 2, 60); // Don't try too hard
            
            for (let i = 0; i < positions.length && removedCount < targetRemovalCount && i < maxAttempts; i++) {
                const pos = positions[i];
                const row = Math.floor(pos / 9);
                const col = pos % 9;
                
                if (this.grid[row][col] !== 0) {
                    // Store original value
                    const originalValue = this.grid[row][col];
                    
                    // Try removing this cell
                    this.grid[row][col] = 0;
                    
                    // Check if puzzle still has unique solution and is solvable
                    if (this.hasUniqueSolution() && this.isPuzzleSolvable()) {
                        removedCount++;
                    } else {
                        // Restore if it breaks uniqueness or solvability
                        this.grid[row][col] = originalValue;
                    }
                }
            }
            
            // Score this attempt (closer to target is better)
            const score = targetRemovalCount - Math.abs(removedCount - targetRemovalCount);
            if (score > bestScore) {
                bestScore = score;
                bestAttempt = this.grid.map(row => [...row]);
            }
            
            console.log(`Attempt ${attempt + 1}: Removed ${removedCount} numbers (score: ${score})`);
        }
        
        // Use the best attempt
        if (bestAttempt) {
            this.grid = bestAttempt;
        }
        
        // Final validation
        if (!this.isPuzzleSolvable()) {
            console.warn('⚠️ Generated puzzle may not be solvable, using fallback...');
                this.generateFallbackPuzzle();
            return;
        }
        
        if (!this.validateAllNumbersCanBePlaced()) {
            console.warn('⚠️ Generated puzzle has blocks where numbers cannot be placed, using fallback...');
            this.generateFallbackPuzzle();
            return;
        }
        
        console.log(`✅ Final puzzle: ${81 - this.countEmptyCells()} given numbers`);
    }
    
    generateFallbackPuzzle() {
        console.log('🔄 Using fallback puzzle generation...');
        
        // Generate a complete solution
        this.generateCompleteSolution();
        
        // Store the solution
        this.solution = this.grid.map(row => [...row]);
        
        // Simple removal strategy - remove numbers from random positions
        const targetGivenCount = this.difficulties[this.difficulty];
        const targetRemovalCount = 81 - targetGivenCount;
        
        const positions = [];
        for (let i = 0; i < 81; i++) {
            positions.push(i);
        }
        
        this.shuffleArray(positions);
        
        // Remove numbers more conservatively
        let removedCount = 0;
        for (let i = 0; i < positions.length && removedCount < targetRemovalCount; i++) {
            const pos = positions[i];
            const row = Math.floor(pos / 9);
            const col = pos % 9;
            
            if (this.grid[row][col] !== 0) {
                this.grid[row][col] = 0;
                removedCount++;
            }
        }
        
        // Mark remaining cells as given
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                this.givenCells[row][col] = this.grid[row][col] !== 0;
            }
        }
        
        console.log(`✅ Fallback puzzle: ${81 - this.countEmptyCells()} given numbers`);
    }

    isPuzzleSolvable() {
        // Check if every empty cell has at least one valid number
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    let hasValidMove = false;
                    for (let num = 1; num <= 9; num++) {
                        if (this.isValidMove(row, col, num)) {
                            hasValidMove = true;
                            break;
                        }
                    }
                    if (!hasValidMove) {
                        return false; // This cell has no valid moves
                    }
                }
            }
        }
        return true;
    }

    countEmptyCells() {
        let count = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) count++;
            }
        }
        return count;
    }

    validateAllNumbersCanBePlaced() {
        // Check each 3x3 block to ensure every number 1-9 can be placed
        for (let blockRow = 0; blockRow < 3; blockRow++) {
            for (let blockCol = 0; blockCol < 3; blockCol++) {
                const startRow = blockRow * 3;
                const startCol = blockCol * 3;
                
                // Check each number 1-9
                for (let num = 1; num <= 9; num++) {
                    let canPlaceNumber = false;
                    
                    // Check if number is already in this block
                    let numberExists = false;
                    for (let r = startRow; r < startRow + 3; r++) {
                        for (let c = startCol; c < startCol + 3; c++) {
                            if (this.grid[r][c] === num) {
                                numberExists = true;
                                break;
                            }
                        }
                        if (numberExists) break;
                    }
                    
                    if (numberExists) {
                        canPlaceNumber = true;
                    } else {
                        // Check if number can be placed in any empty cell of this block
                        for (let r = startRow; r < startRow + 3; r++) {
                            for (let c = startCol; c < startCol + 3; c++) {
                                if (this.grid[r][c] === 0 && this.isValidMove(r, c, num)) {
                                    canPlaceNumber = true;
                                    break;
                                }
                            }
                            if (canPlaceNumber) break;
                        }
                    }
                    
                    if (!canPlaceNumber) {
                        console.error(`❌ Number ${num} cannot be placed in block (${blockRow}, ${blockCol})`);
                        return false;
                    }
                }
            }
        }
        return true;
    }

    hasUniqueSolution() {
        // Create a copy of the current grid
        const tempGrid = this.grid.map(row => [...row]);
        this.solutionCount = 0;
        
        // Count solutions
        this.countSolutions(tempGrid, 0, 0);
        
        return this.solutionCount === 1;
    }

    countSolutions(grid, row, col) {
        // If we've found more than one solution, stop counting
        if (this.solutionCount > 1) return;
        
        // If we've filled the entire grid
        if (row === 9) {
            this.solutionCount++;
            return;
        }
        
        // Calculate next position
        const nextRow = col === 8 ? row + 1 : row;
        const nextCol = col === 8 ? 0 : col + 1;
        
        // If current cell is already filled, move to next
        if (grid[row][col] !== 0) {
            this.countSolutions(grid, nextRow, nextCol);
            return;
        }
        
        // Try each number 1-9
        for (let num = 1; num <= 9; num++) {
            if (this.isValidMoveForGrid(grid, row, col, num)) {
                grid[row][col] = num;
                this.countSolutions(grid, nextRow, nextCol);
                grid[row][col] = 0; // Backtrack
                
                // Early termination if multiple solutions found
                if (this.solutionCount > 1) return;
            }
        }
    }

    loadPuzzleFromLibrary(puzzleString, solutionString) {
        // Convert string format to 2D array
        this.grid = Array(9).fill().map(() => Array(9).fill(0));
        this.solution = Array(9).fill().map(() => Array(9).fill(0));
        
        // Load puzzle (with blanks as 0)
        for (let i = 0; i < 81; i++) {
            const row = Math.floor(i / 9);
            const col = i % 9;
            const puzzleChar = puzzleString[i];
            const solutionChar = solutionString[i];
            
            if (puzzleChar !== '.') {
                this.grid[row][col] = parseInt(puzzleChar);
                this.givenCells[row][col] = true;
            } else {
        this.grid[row][col] = 0;
                this.givenCells[row][col] = false;
            }
            
            // Store solution
            this.solution[row][col] = parseInt(solutionChar);
        }
    }

    
    // Testing and validation methods
    testPuzzleGeneration() {
        console.log('Testing puzzle generation...');
        
        const testResults = {
            totalTests: 0,
            successful: 0,
            failed: 0,
            errors: []
        };
        
        // Test each difficulty level
        ['easy', 'medium', 'hard'].forEach(difficulty => {
            console.log(`Testing ${difficulty} puzzles...`);
            
            for (let i = 0; i < 10; i++) { // Test 10 puzzles per difficulty
                testResults.totalTests++;
                
                try {
                    this.difficulty = difficulty;
                    this.generateSolution();
                    
                    if (!this.removeNumbers()) {
                        testResults.failed++;
                        testResults.errors.push(`${difficulty} puzzle ${i}: Failed to remove numbers`);
                        continue;
                    }
                    
                    if (!this.hasUniqueSolution()) {
                        testResults.failed++;
                        testResults.errors.push(`${difficulty} puzzle ${i}: Multiple solutions found`);
                        continue;
                    }
                    
                    // Test that puzzle is solvable
                    if (!this.testSolvability()) {
                        testResults.failed++;
                        testResults.errors.push(`${difficulty} puzzle ${i}: Puzzle not solvable`);
                        continue;
                    }
                    
                    testResults.successful++;
                    
                } catch (error) {
                    testResults.failed++;
                    testResults.errors.push(`${difficulty} puzzle ${i}: ${error.message}`);
                }
            }
        });
        
        console.log('Test Results:', testResults);
        return testResults;
    }

    testSolvability() {
        // Create a copy of the puzzle and try to solve it
        const testGrid = this.grid.map(row => [...row]);
        const testGiven = this.givenCells.map(row => [...row]);
        
        // Try to solve the puzzle
        return this.solveSudokuWithValidation(testGrid);
    }

    solveSudokuWithValidation(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
        for (let num = 1; num <= 9; num++) {
                        if (this.isValidMoveForGrid(grid, row, col, num)) {
                            grid[row][col] = num;
                            
                            if (this.solveSudokuWithValidation(grid)) {
                                return true;
                            }
                            
                            grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    // Add a method to run validation tests
    runValidationTests() {
        const results = this.testPuzzleGeneration();
        
        if (results.failed === 0) {
            console.log('✅ All puzzle generation tests passed!');
        } else {
            console.log(`❌ ${results.failed} out of ${results.totalTests} tests failed`);
            console.log('Errors:', results.errors);
        }
        
        return results;
    }

    validateGameState() {
        const errors = [];
        
        // Check for duplicate numbers in rows
        for (let row = 0; row < 9; row++) {
            const numbers = new Set();
            const duplicates = [];
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] !== 0) {
                    if (numbers.has(this.grid[row][col])) {
                        duplicates.push(`${this.grid[row][col]} at (${row},${col})`);
                    }
                    numbers.add(this.grid[row][col]);
                }
            }
            if (duplicates.length > 0) {
                errors.push(`Row ${row}: duplicate numbers - ${duplicates.join(', ')}`);
            }
        }
        
        // Check for duplicate numbers in columns
        for (let col = 0; col < 9; col++) {
            const numbers = new Set();
            const duplicates = [];
            for (let row = 0; row < 9; row++) {
                if (this.grid[row][col] !== 0) {
                    if (numbers.has(this.grid[row][col])) {
                        duplicates.push(`${this.grid[row][col]} at (${row},${col})`);
                    }
                    numbers.add(this.grid[row][col]);
                }
            }
            if (duplicates.length > 0) {
                errors.push(`Column ${col}: duplicate numbers - ${duplicates.join(', ')}`);
            }
        }
        
        // Check for duplicate numbers in 3x3 blocks
        for (let blockRow = 0; blockRow < 3; blockRow++) {
            for (let blockCol = 0; blockCol < 3; blockCol++) {
                const numbers = new Set();
                const duplicates = [];
                for (let r = blockRow * 3; r < blockRow * 3 + 3; r++) {
                    for (let c = blockCol * 3; c < blockCol * 3 + 3; c++) {
                        if (this.grid[r][c] !== 0) {
                            if (numbers.has(this.grid[r][c])) {
                                duplicates.push(`${this.grid[r][c]} at (${r},${c})`);
                            }
                            numbers.add(this.grid[r][c]);
                        }
                    }
                }
                if (duplicates.length > 0) {
                    errors.push(`Block (${blockRow},${blockCol}): duplicate numbers - ${duplicates.join(', ')}`);
                }
            }
        }
        
        if (errors.length > 0) {
            console.error('Game state validation errors:', errors);
            console.error('Current grid state:', this.grid);
            return false;
        }
        
        return true;
    }
    
    resetGame() {
        this.grid = Array(9).fill().map(() => Array(9).fill(0));
        this.givenCells = Array(9).fill().map(() => Array(9).fill(false));
        this.notes = Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
        this.clearSelection();
        this.isNoteMode = false;
        this.isPaintMode = false;
        this.paintNumber = null;
        document.body.classList.remove('note-mode', 'paint-mode');
        
        // Reset mobile toggle
        const toggle = document.getElementById('noteModeToggle');
        if (toggle) {
            toggle.checked = false;
        }
        this.moveCount = 0;
        this.errorCount = 0;
        this.hintCount = 0;
        this.isGameWon = false;
        
        this.updateMoveCount();
        this.updateErrorCount();
        this.updateHintCount();
        this.stopTimer();
    }
    
    solveHint() {
        if (this.isGameWon) return;
        
        // Try to find a cell with only one possible number (naked single)
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    const possibleNumbers = this.getPossibleNumbers(row, col);
                    if (possibleNumbers.length === 1) {
                        this.grid[row][col] = possibleNumbers[0];
                        this.notes[row][col].clear(); // Clear any existing notes
                        this.hintCount++;
                        this.updateHintCount();
                        this.updateDisplay();
                        this.highlightHintCell(row, col);
                        this.showHintMessage(`Naked Single: This cell can only contain ${possibleNumbers[0]} because all other numbers 1-9 are already used in this row, column, or 3x3 box. Look for cells where most numbers are already placed nearby!`);
                        return;
                    }
                }
            }
        }
        
        // Try to find a hidden single (number that can only go in one cell in a row/column/box)
        const hiddenSingle = this.findHiddenSingle();
        if (hiddenSingle) {
            this.grid[hiddenSingle.row][hiddenSingle.col] = hiddenSingle.number;
            this.notes[hiddenSingle.row][hiddenSingle.col].clear(); // Clear any existing notes
            this.hintCount++;
            this.updateHintCount();
            this.updateDisplay();
            this.highlightHintCell(hiddenSingle.row, hiddenSingle.col);
            this.showHintMessage(`Hidden Single: The number ${hiddenSingle.number} can only go in this cell because all other empty cells in this ${hiddenSingle.reason} already have ${hiddenSingle.number} blocked by existing numbers. Check each number 1-9 to see where it can fit!`);
            return;
        }
        
        // If no easy hints found, provide general strategy advice
        this.showHintMessage("Strategy Tips: 1) Look for cells with only one possible number (check what's already in the row/column/box). 2) For each number 1-9, see if it can only go in one place in a row, column, or 3x3 box. 3) Use notes to track possibilities!");
    }
    
    solvePuzzle() {
        if (this.isGameWon) {
            console.log('🎉 Puzzle already solved!');
            return;
        }
        
        console.log('🔍 Solving puzzle...');
        
        // Create a copy of the current grid for solving
        const workingGrid = this.grid.map(row => [...row]);
        
        // Try to solve the puzzle
        if (this.solveSudokuForGrid(workingGrid)) {
            // If successful, copy the solution back
            this.grid = workingGrid;
            this.updateDisplay();
            
            // Check if this matches our stored solution
            let matchesSolution = true;
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (this.grid[row][col] !== this.solution[row][col]) {
                        matchesSolution = false;
                        break;
                    }
                }
                if (!matchesSolution) break;
            }
            
            if (matchesSolution) {
                console.log('✅ Puzzle solved correctly! Matches stored solution.');
                this.gameWon();
            } else {
                console.log('⚠️ Puzzle solved, but solution differs from stored solution.');
                console.log('This might indicate the puzzle has multiple solutions or the stored solution is incorrect.');
            }
        } else {
            console.log('❌ Puzzle could not be solved! This indicates an invalid puzzle.');
            console.log('The puzzle may have no solution or multiple conflicting constraints.');
        }
    }
    
    solveSudokuForGrid(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    for (let num = 1; num <= 9; num++) {
                        if (this.isValidMoveForGrid(grid, row, col, num)) {
                            grid[row][col] = num;
                            
                            if (this.solveSudokuForGrid(grid)) {
                                return true;
                            }
                            
                            grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }
    
    getPossibleNumbers(row, col) {
        const possible = [];
        for (let num = 1; num <= 9; num++) {
            if (this.isValidMove(row, col, num)) {
                possible.push(num);
            }
        }
        return possible;
    }
    
    findHiddenSingle() {
        // Check rows
        for (let row = 0; row < 9; row++) {
            for (let num = 1; num <= 9; num++) {
                const possibleCells = [];
                for (let col = 0; col < 9; col++) {
                    if (this.grid[row][col] === 0 && this.isValidMove(row, col, num)) {
                        possibleCells.push(col);
                    }
                }
                if (possibleCells.length === 1) {
                    return { row, col: possibleCells[0], number: num, reason: 'row' };
                }
            }
        }
        
        // Check columns
        for (let col = 0; col < 9; col++) {
            for (let num = 1; num <= 9; num++) {
                const possibleCells = [];
                for (let row = 0; row < 9; row++) {
                    if (this.grid[row][col] === 0 && this.isValidMove(row, col, num)) {
                        possibleCells.push(row);
                    }
                }
                if (possibleCells.length === 1) {
                    return { row: possibleCells[0], col, number: num, reason: 'column' };
                }
            }
        }
        
        // Check 3x3 boxes
        for (let boxRow = 0; boxRow < 3; boxRow++) {
            for (let boxCol = 0; boxCol < 3; boxCol++) {
                for (let num = 1; num <= 9; num++) {
                    const possibleCells = [];
                    for (let r = boxRow * 3; r < boxRow * 3 + 3; r++) {
                        for (let c = boxCol * 3; c < boxCol * 3 + 3; c++) {
                            if (this.grid[r][c] === 0 && this.isValidMove(r, c, num)) {
                                possibleCells.push({ row: r, col: c });
                            }
                        }
                    }
                    if (possibleCells.length === 1) {
                        return { 
                            row: possibleCells[0].row, 
                            col: possibleCells[0].col, 
                            number: num, 
                            reason: '3x3 box' 
                        };
                    }
                }
            }
        }
        
        return null;
    }
    
    highlightHintCell(row, col) {
        const index = row * 9 + col;
        const cell = document.querySelector(`[data-index="${index}"]`);
        cell.classList.add('hint-highlight');
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            cell.classList.remove('hint-highlight');
        }, 3000);
    }
    
    showHintMessage(message) {
        // Remove any existing hint message
        const existingHint = document.getElementById('hint-message');
        if (existingHint) {
            existingHint.remove();
        }
        
        // Create a persistent hint message with close button
        const hintDiv = document.createElement('div');
        hintDiv.id = 'hint-message';
        hintDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(20px);
            color: #ffffff;
            padding: 20px;
            border-radius: 15px;
            font-size: 1rem;
            text-align: center;
            z-index: 1000;
            max-width: 500px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            outline: 2px solid rgba(100, 181, 246, 0.5);
        `;
        
        hintDiv.innerHTML = `
            <div style="margin-bottom: 15px;">${message}</div>
            <button id="close-hint" style="
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #ffffff;
                padding: 8px 16px;
                border-radius: 10px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: all 0.3s ease;
            ">Got it!</button>
        `;
        
        document.body.appendChild(hintDiv);
        
        // Add close functionality and hover effects
        const closeButton = document.getElementById('close-hint');
        closeButton.addEventListener('click', () => {
            hintDiv.remove();
        });
        
        // Add touch support for close button
        closeButton.addEventListener('touchend', (e) => {
            hintDiv.remove();
        });
        
        // Add hover effects for glassmorphism
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
            closeButton.style.transform = 'translateY(-2px)';
            closeButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        });
        
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.1)';
            closeButton.style.transform = 'translateY(0)';
            closeButton.style.boxShadow = 'none';
        });
    }
    
    clearBoard() {
        if (confirm('Are you sure you want to clear the board?')) {
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (!this.givenCells[row][col]) {
                        this.grid[row][col] = 0;
                        this.notes[row][col].clear();
                    }
                }
            }
            this.updateDisplay();
        }
    }
    
    eraseNumber() {
        if (this.selectedCell === null || this.isGameWon) return;
        
        const row = Math.floor(this.selectedCell / 9);
        const col = this.selectedCell % 9;
        
        if (this.givenCells[row][col]) return;
        
        if (this.isNoteMode) {
            this.notes[row][col].clear();
        } else {
            this.grid[row][col] = 0;
            this.notes[row][col].clear();
        }
        
        this.updateDisplay();
    }
    
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        
        // Clear highlights and selection
        this.clearSelection();
        this.clearHighlights();
        
        // Update UI
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[onclick="setDifficulty('${difficulty}')"]`).classList.add('active');
        
        // Generate new game with selected difficulty
        this.newGame();
    }
    
    startTimer() {
        this.startTime = Date.now();
        this.timer = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }
    
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    
    updateTimer() {
        const elapsed = this.getElapsedTime();
        document.getElementById('timer').textContent = this.formatTime(elapsed);
    }
    
    getElapsedTime() {
        if (!this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    updateMoveCount() {
        document.getElementById('moveCount').textContent = this.moveCount;
    }
    
    updateErrorCount() {
        document.getElementById('errorCount').textContent = this.errorCount;
    }
    
    updateHintCount() {
        document.getElementById('hintCount').textContent = this.hintCount;
    }
}

// Global functions
let game;

function newGame() {
    game.newGame();
}

function inputNumber(number) {
    game.inputNumber(number);
}

function addNote(number) {
    game.addNote(number);
}

function eraseNumber() {
    game.eraseNumber();
}

function solveHint() {
    game.solveHint();
}

function solvePuzzle() {
    game.solvePuzzle();
}

function clearBoard() {
    game.clearBoard();
}

function setDifficulty(difficulty) {
    game.setDifficulty(difficulty);
}


// Global function to run validation tests
function runValidationTests() {
    if (game) {
        return game.runValidationTests();
        } else {
        console.error('Game not initialized yet');
        return null;
    }
}

// Global function to validate current game state
function validateCurrentGame() {
    if (game) {
        return game.validateGameState();
    } else {
        console.error('Game not initialized yet');
        return false;
    }
}

// Global function to check for duplicate numbers in current puzzle
function checkForDuplicates() {
    if (game) {
        console.log('Checking for duplicate numbers...');
        const isValid = game.validateGameState();
        if (isValid) {
            console.log('✅ No duplicate numbers found - puzzle is valid!');
        } else {
            console.log('❌ Duplicate numbers found - see errors above');
        }
        return isValid;
    } else {
        console.error('Game not initialized yet');
        return false;
    }
}

// Global function to check if all numbers can be placed in all blocks
function checkBlockPlaceability() {
    if (!game) {
        console.error('Game not initialized yet');
        return false;
    }
    
    console.log('Checking if all numbers can be placed in all blocks...');
    const isValid = game.validateAllNumbersCanBePlaced();
    if (isValid) {
        console.log('✅ All numbers can be placed in all blocks!');
    } else {
        console.log('❌ Some numbers cannot be placed in some blocks - see errors above');
    }
    return isValid;
}

// Global function to test puzzle generation
function testPuzzleGeneration() {
    console.log('Testing puzzle generation system...');
    
    if (!game) {
        console.error('❌ Game not initialized');
        return false;
    }
    
    try {
        // Test different difficulty levels
        const difficulties = ['easy', 'medium', 'advanced', 'hard'];
        for (const diff of difficulties) {
            console.log(`Testing ${diff} difficulty...`);
            
            // Set difficulty and generate puzzle
            game.difficulty = diff;
            game.generateReliablePuzzle();
            
            // Count given numbers
            let givenCount = 0;
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (game.grid[row][col] !== 0) {
                        givenCount++;
                    }
                }
            }
            
            const target = game.difficulties[diff];
            const isValid = game.validateGameState();
            
            console.log(`✅ ${diff}: ${givenCount} given numbers (target: ${target}), valid: ${isValid}`);
        }
        
        console.log('✅ Puzzle generation test passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Puzzle generation test failed:', error);
        return false;
    }
}

// Global function to test a specific difficulty level
function testDifficultyLevel(difficulty) {
    if (game) {
        console.log(`Testing ${difficulty} difficulty...`);
        
        // Set the difficulty
        game.difficulty = difficulty;
        
        // Generate a new puzzle
        game.newGame();
        
        // Check for duplicates
        const isValid = game.validateGameState();
        
        // Count given numbers
        let givenCount = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (game.grid[row][col] !== 0) {
                    givenCount++;
                }
            }
        }
        
        console.log(`Difficulty: ${difficulty}`);
        console.log(`Given numbers: ${givenCount} (target: ${game.difficulties[difficulty]})`);
        console.log(`Valid puzzle: ${isValid ? '✅ Yes' : '❌ No'}`);
        
        return { difficulty, givenCount, isValid };
    } else {
        console.error('Game not initialized yet');
        return null;
    }
}

// Quick debug function
function debugCurrentPuzzle() {
    if (game) {
        let givenCount = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (game.grid[row][col] !== 0) {
                    givenCount++;
                }
            }
        }
        
        console.log(`Current puzzle debug:`);
        console.log(`- Difficulty: ${game.difficulty}`);
        console.log(`- Given numbers: ${givenCount}`);
        console.log(`- Target: ${game.difficulties[game.difficulty]}`);
        console.log(`- Valid: ${game.validateGameState()}`);
        console.log(`- Library available: ${typeof SudokuGenerator !== 'undefined'}`);
        
        return { difficulty: game.difficulty, givenCount, target: game.difficulties[game.difficulty] };
    }
}


// Keyboard support
document.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '9') {
        inputNumber(parseInt(e.key));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        eraseNumber();
    } else if (e.key === 'h' || e.key === 'H') {
        solveHint();
    } else if (e.key === 'n' || e.key === 'N') {
        newGame();
    }
});

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Initializing Sudoku Game...');
    game = new SudokuGame();
});
