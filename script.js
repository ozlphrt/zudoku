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
            medium: 25,
            hard: 17
        };
        
        this.createGrid();
        this.addWheelListener();
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
            
            cell.addEventListener('touchstart', (e) => {
                // Start long press timer
                longPressTimer = setTimeout(() => {
                    this.handleLongPress(i);
                }, 800);
            });
            
            cell.addEventListener('touchend', (e) => {
                // Clear long press timer
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            });
            
            cell.addEventListener('touchmove', (e) => {
                // Cancel long press on move
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            });
            
            gridElement.appendChild(cell);
        }
    }
    
    addWheelListener() {
        document.addEventListener('wheel', (e) => {
            // Only work when in paint mode
            if (!this.isPaintMode || !this.paintNumber) return;
            
            e.preventDefault();
            
            // Scroll up = increase number, scroll down = decrease number
            if (e.deltaY < 0) {
                // Scroll up - increase number
                this.paintNumber = Math.min(9, this.paintNumber + 1);
            } else {
                // Scroll down - decrease number
                this.paintNumber = Math.max(1, this.paintNumber - 1);
            }
            
            // Update the cursor with new number
            this.updateCursor();
        }, { passive: false });
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
        
        // If it's an empty cell and we're in note mode, just select it for note input
        if (this.isNoteMode && this.grid[row][col] === 0) {
            this.selectedCell = index;
            const cell = document.querySelector(`[data-index="${index}"]`);
            cell.classList.add('selected');
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
        
        // If cell is empty, add a note (cycle through numbers 1-9)
        if (this.grid[row][col] === 0) {
            // Find the next number to add as a note
            let nextNumber = 1;
            while (nextNumber <= 9 && this.notes[row][col].includes(nextNumber)) {
                nextNumber++;
            }
            
            if (nextNumber <= 9) {
                this.toggleNote(row, col, nextNumber);
                this.updateDisplay();
            }
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
        this.solveSudoku();
        
        // Copy solution
        this.solution = this.grid.map(row => [...row]);
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
        const cellsToRemove = 81 - this.difficulties[this.difficulty];
        const positions = [];
        
        for (let i = 0; i < 81; i++) {
            positions.push(i);
        }
        
        this.shuffleArray(positions);
        
        let removedCount = 0;
        for (let i = 0; i < positions.length && removedCount < cellsToRemove; i++) {
            const pos = positions[i];
            const row = Math.floor(pos / 9);
            const col = pos % 9;
            
            // Store the original value
            const originalValue = this.grid[row][col];
            
            // Try removing this cell
            this.grid[row][col] = 0;
            
            // Check if the puzzle still has a unique solution
            if (this.hasUniqueSolution()) {
            this.givenCells[row][col] = false;
                removedCount++;
            } else {
                // Restore the value if removing it makes the puzzle invalid
                this.grid[row][col] = originalValue;
            }
        }
        
        // Mark remaining cells as given
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] !== 0) {
                    this.givenCells[row][col] = true;
                }
            }
        }
    }
    
    hasUniqueSolution() {
        // Create a copy of the current grid
        const tempGrid = this.grid.map(row => [...row]);
        
        // Count solutions
        this.solutionCount = 0;
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
        
        // If current cell is already filled, move to next
        if (grid[row][col] !== 0) {
            if (col === 8) {
                this.countSolutions(grid, row + 1, 0);
            } else {
                this.countSolutions(grid, row, col + 1);
            }
            return;
        }
        
        // Try each number 1-9
        for (let num = 1; num <= 9; num++) {
            if (this.isValidMoveForGrid(grid, row, col, num)) {
                grid[row][col] = num;
                
                if (col === 8) {
                    this.countSolutions(grid, row + 1, 0);
                } else {
                    this.countSolutions(grid, row, col + 1);
                }
                
                grid[row][col] = 0; // Backtrack
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
        this.generateSolution();
        this.removeNumbers();
        this.updateDisplay();
        this.startTimer();
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

function clearBoard() {
    game.clearBoard();
}

function setDifficulty(difficulty) {
    game.setDifficulty(difficulty);
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
    game = new SudokuGame();
});
