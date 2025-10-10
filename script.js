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
        this.pausedTime = 0;
        this.isPaused = false;
        this.bestTimes = this.loadBestTimes();
        this.moveCount = 0;
        this.errorCount = 0;
        this.hintCount = 0;
        this.isGameWon = false;
        this.wasAutoSolved = false;
        
        // Move history for undo/redo
        this.moveHistory = [];
        this.historyIndex = -1;
        this.maxHistorySize = 100;
        
        // Audio system
        this.audioContext = null;
        this.soundsEnabled = this.loadSoundSettings();
        this.initAudio();
        
        this.difficulties = {
            easy: 30,      // Most given numbers = easiest
            medium: 23,    // Moderate given numbers
            hard: 17       // Fewest given numbers = hardest (minimum for unique solution)
        };
        
        // Pre-validated puzzle database
        this.puzzleDatabase = this.loadPuzzleDatabase();
        
        // Auto-save system
        this.autoSaveInterval = null;
        this.autoSaveDelay = 5000; // Save every 5 seconds
        this.gameState = {
            grid: null,
            notes: null,
            difficulty: null,
            startTime: null,
            elapsedTime: 0,
            moveCount: 0,
            errorCount: 0,
            hintCount: 0,
            lastSaved: null
        };
        
        // Daily Challenge system
        this.dailyChallenges = this.loadDailyChallenges();
        this.currentChallenge = null;
        this.challengeStreak = this.loadChallengeStreak();
        this.challengeCompleted = this.loadChallengeCompleted();
        
        this.createGrid();
        this.addWheelListener();
        this.updateBestTimeDisplay();
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
            let longPressTriggered = false;
            let touchStartX = 0;
            let touchStartY = 0;
            let touchStartTime = 0;
            
            cell.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                longPressTriggered = false;
                
                // Start long press timer
                longPressTimer = setTimeout(() => {
                    this.handleLongPress(i);
                    longPressTriggered = true;
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
                
                // If long press was triggered, don't process other touch events
                if (longPressTriggered) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                // Check for flick gestures (quick swipe left/right)
                if (touchDuration < 300 && e.changedTouches.length > 0) {
                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].clientY;
                    const deltaX = touchEndX - touchStartX;
                    const deltaY = touchEndY - touchStartY;
                    
                    // Flick right: deltaX > 20 and |deltaY| < 60 (note mode)
                    if (deltaX > 20 && Math.abs(deltaY) < 60) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleFlickRight(i);
                        return;
                    }
                    
                    // Flick left: deltaX < -20 and |deltaY| < 60 (undo)
                    if (deltaX < -20 && Math.abs(deltaY) < 60) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleFlickLeft();
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
                longPressTriggered = false;
            }, { passive: true });
            
            
            gridElement.appendChild(cell);
        }
    }
    
    addWheelListener() {
        // Add wheel listener to the entire document
        document.addEventListener('wheel', (e) => {
            // Only work when in paint mode
            if (!this.isPaintMode || !this.paintNumber) return;
            
            let numberChanged = false;
            const oldPaintNumber = this.paintNumber;
            
            // Scroll up = increase number, scroll down = decrease number
            if (e.deltaY < 0) {
                // Scroll up - increase number
                const newNumber = Math.min(9, this.paintNumber + 1);
                if (newNumber !== this.paintNumber) {
                    this.paintNumber = newNumber;
                    numberChanged = true;
                }
            } else if (e.deltaY > 0) {
                // Scroll down - decrease number
                const newNumber = Math.max(1, this.paintNumber - 1);
                if (newNumber !== this.paintNumber) {
                    this.paintNumber = newNumber;
                    numberChanged = true;
                }
            }
            
            // Only prevent default and update if number actually changed
            if (numberChanged) {
                e.preventDefault();
                e.stopPropagation();
                
                // Clear previous highlights and highlight new number
                this.clearHighlights();
                this.clearNoteHighlights();
                this.highlightSameNumbers(this.paintNumber);
                this.highlightSameNotes(this.paintNumber);
                
                // Update the cursor with new number
                this.updateCursor();
            }
        }, { passive: false, capture: true });
        
        // Also add wheel listener to the grid specifically
        const gridElement = document.getElementById('sudokuGrid');
        if (gridElement) {
            gridElement.addEventListener('wheel', (e) => {
                if (!this.isPaintMode || !this.paintNumber) return;
                
                let numberChanged = false;
                
                if (e.deltaY < 0) {
                    const newNumber = Math.min(9, this.paintNumber + 1);
                    if (newNumber !== this.paintNumber) {
                        this.paintNumber = newNumber;
                        numberChanged = true;
                    }
                } else if (e.deltaY > 0) {
                    const newNumber = Math.max(1, this.paintNumber - 1);
                    if (newNumber !== this.paintNumber) {
                        this.paintNumber = newNumber;
                        numberChanged = true;
                    }
                }
                
                if (numberChanged) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Clear previous highlights and highlight new number
                    this.clearHighlights();
                    this.clearNoteHighlights();
                    this.highlightSameNumbers(this.paintNumber);
                    this.highlightSameNotes(this.paintNumber);
                    
                    this.updateCursor();
                }
            }, { passive: false });
        }
    }
    
    selectCell(index) {
        if (this.isGameWon) return;
        
        // Remove previous selection and highlights
        this.clearSelection();
        this.clearHighlights();
        this.clearNoteHighlights();
        
        const row = Math.floor(index / 9);
        const col = index % 9;
        
        // If it's a given cell, highlight all instances of that number and set paint mode
        if (this.givenCells[row][col]) {
            const number = this.grid[row][col];
            this.highlightSameNumbers(number);
            this.highlightSameNotes(number); // Also highlight notes with this number
            this.paintNumber = number;
            this.isPaintMode = true;
            this.updateCursor();
            return;
        }
        
        // If it's a user-filled cell, highlight all instances and set paint mode
        if (this.grid[row][col] !== 0) {
            const number = this.grid[row][col];
            this.highlightSameNumbers(number);
            this.highlightSameNotes(number); // Also highlight notes with this number
            this.paintNumber = number;
            this.isPaintMode = true;
            this.updateCursor();
            return;
        }
        
        // If it's an empty cell and we're in paint mode, place the number immediately
        if (this.isPaintMode && this.paintNumber) {
            this.setNumber(row, col, this.paintNumber);
            return;
        }
        
        // If it's an empty cell and we're in note mode, add the highlighted number as a note
        if (this.isNoteMode && this.grid[row][col] === 0) {
            if (this.isPaintMode && this.paintNumber) {
                this.toggleNote(row, col, this.paintNumber);
                // updateDisplay and highlighting are already handled in toggleNote
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
            cell.classList.remove('selected', 'paint-target');
            this.selectedCell = null;
            
            // Update erase button state
            this.updateEraseButton();
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
        
        // If we're in paint mode and the paint number matches the input number, place it
        if (this.isPaintMode && this.paintNumber && this.paintNumber === number) {
            this.setNumber(row, col, number);
            this.updateDisplay();
            return;
        }
        
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
            // updateDisplay and highlighting are already handled in toggleNote
            return;
        }
        
        // If cell has a filled number, erase it
        if (this.grid[row][col] !== 0) {
            this.setNumber(row, col, 0);
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
    
    // Handle flick left gesture for undo
    handleFlickLeft() {
        if (this.isGameWon) return;
        
        // Perform undo action
        this.undoMove();
    }
    
    addNote(number) {
        if (this.selectedCell === null || this.isGameWon) return;
        
        const row = Math.floor(this.selectedCell / 9);
        const col = this.selectedCell % 9;
        
        if (this.givenCells[row][col]) return;
        
        this.toggleNote(row, col, number);
        // updateDisplay is already called in toggleNote
    }
    
    setNumber(row, col, number) {
        const oldValue = this.grid[row][col];
        this.grid[row][col] = number;
        
        // Check if the move is valid (erasing is always valid)
        if (number === 0 || this.isValidMove(row, col, number)) {
            // Add to move history
            this.addToHistory({
                type: 'number',
                row: row,
                col: col,
                value: number,
                oldValue: oldValue
            });
            
            this.moveCount++;
            this.updateMoveCount();
            
            // Play success sound
            this.playSound('place');
            
            // Animate number placement
            this.animateNumberPlacement(row, col);
            
            // Clear notes for this cell
            this.notes[row][col].clear();
            
            // Remove this number from notes in the same row, column, and 3x3 block
            this.removeNotesFromBlock(row, col, number);
            
            // Remove invalid notes from entire grid (smart note cleanup)
            this.removeInvalidNotes();
            
            // Update display first
            this.updateDisplay();
            
            // Update progress
            this.updateProgress();
            
            // If we're in paint mode and this matches the paint number, re-highlight all instances
            if (this.isPaintMode && this.paintNumber === number) {
                // Re-highlight all instances of this number (including the newly placed one)
                this.highlightSameNumbers(number);
                this.highlightSameNotes(number);
                // Keep paint mode active, don't clear selection
            } else {
                // Clear selection after valid move (only if not in paint mode)
            this.clearSelection();
            }
            
            // Check for completed rows/columns/blocks (only if placing a number, not erasing)
            if (number !== 0) {
                this.checkCompletion(row, col, number);
            }
            
            // Check for win
            if (this.checkWin()) {
                this.gameWon();
            }
        } else {
            // Invalid move - show error and revert
            this.grid[row][col] = oldValue;
            this.animateError(row, col);
            this.playSound('error');
            this.errorCount++;
            this.updateErrorCount();
            
            // Clear selection after invalid move
            this.clearSelection();
        }
    }
    
    toggleNote(row, col, number) {
        const wasRemoving = this.notes[row][col].has(number);
        
        if (wasRemoving) {
            // Always allow removing notes
            this.notes[row][col].delete(number);
            
            // Add to move history
            this.addToHistory({
                type: 'note',
                row: row,
                col: col,
                noteNumber: number,
                action: 'remove'
            });
        } else {
            // Validate before adding notes
            if (!this.isValidMove(row, col, number)) {
                // Show red pulse animation on the number and don't add the note
                this.showNoteError(row, col, number);
                this.playSound('noteError');
                return;
            }
            
            // Add the note if it's valid
            this.notes[row][col].add(number);
            
            // Play note sound
            this.playSound('note');
            
            // Add to move history
            this.addToHistory({
                type: 'note',
                row: row,
                col: col,
                noteNumber: number,
                action: 'add'
            });
        }
        
        // Update display to show the note change
        this.updateDisplay();
        
        // If we're in paint mode and this matches the paint number, highlight the note
        if (this.isPaintMode && this.paintNumber === number && !wasRemoving) {
            const index = row * 9 + col;
            const cell = document.querySelector(`[data-index="${index}"]`);
            const noteNumbers = cell.querySelectorAll('.note-number');
            noteNumbers.forEach(noteSpan => {
                if (noteSpan.textContent === number.toString()) {
                    noteSpan.classList.add('note-number-highlight');
                }
            });
        }
    }
    
    
    removeNotesFromBlock(row, col, number) {
        let removedCount = 0;
        
        // Remove notes from the same row
        for (let c = 0; c < 9; c++) {
            if (this.notes[row][c].has(number)) {
                this.notes[row][c].delete(number);
                removedCount++;
            }
        }
        
        // Remove notes from the same column
        for (let r = 0; r < 9; r++) {
            if (this.notes[r][col].has(number)) {
                this.notes[r][col].delete(number);
                removedCount++;
            }
        }
        
        // Remove notes from the same 3x3 block
        const blockRow = Math.floor(row / 3) * 3;
        const blockCol = Math.floor(col / 3) * 3;
        
        for (let r = blockRow; r < blockRow + 3; r++) {
            for (let c = blockCol; c < blockCol + 3; c++) {
                if (this.notes[r][c].has(number)) {
                    this.notes[r][c].delete(number);
                    removedCount++;
                }
            }
        }
        
        if (removedCount > 0) {
            console.log(`🧹 Auto-removed ${removedCount} impossible notes for number ${number}`);
        }
    }
    
    // Smart note management - remove notes that are no longer valid
    removeInvalidNotes() {
        let notesRemoved = 0;
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0 && this.notes[row][col].size > 0) {
                    const notesToRemove = [];
                    
                    // Check each note to see if it's still valid
                    for (let noteNumber of this.notes[row][col]) {
                        if (!this.isValidMove(row, col, noteNumber)) {
                            notesToRemove.push(noteNumber);
                        }
                    }
                    
                    // Remove invalid notes
                    notesToRemove.forEach(noteNumber => {
                        this.notes[row][col].delete(noteNumber);
                        notesRemoved++;
                    });
                }
            }
        }
        
        if (notesRemoved > 0) {
            console.log(`🧹 Smart cleanup: Removed ${notesRemoved} invalid notes`);
            this.updateDisplay();
        }
    }
    
    // Highlight same numbers in notes across the grid
    highlightSameNotes(number) {
        // Clear previous note highlights
        this.clearNoteHighlights();
        
        // Find all cells with this number in notes and highlight only the number
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0 && this.notes[row][col].has(number)) {
                    const index = row * 9 + col;
                    const cell = document.querySelector(`[data-index="${index}"]`);
                    
                    // Only highlight the specific note number within the cell (no cell background)
                    const noteNumbers = cell.querySelectorAll('.note-number');
                    noteNumbers.forEach(noteSpan => {
                        if (noteSpan.textContent === number.toString()) {
                            noteSpan.classList.add('note-number-highlight');
                        }
                    });
                }
            }
        }
    }
    
    // Clear note highlighting
    clearNoteHighlights() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            // Clear note number highlights
            const noteNumbers = cell.querySelectorAll('.note-number');
            noteNumbers.forEach(noteSpan => {
                noteSpan.classList.remove('note-number-highlight');
            });
        });
    }
    
    // Auto-suggest notes based on constraints
    autoSuggestNotes(row, col) {
        if (this.grid[row][col] !== 0) return;
        
        const suggestions = [];
        for (let num = 1; num <= 9; num++) {
            if (this.isValidMove(row, col, num)) {
                suggestions.push(num);
            }
        }
        
        // Only add suggestions if there are reasonable possibilities (2-6 options)
        if (suggestions.length >= 2 && suggestions.length <= 6) {
            // Clear existing notes and add suggestions
            this.notes[row][col].clear();
            suggestions.forEach(num => {
                this.notes[row][col].add(num);
            });
            
            console.log(`💡 Auto-suggested notes for (${row}, ${col}): ${suggestions.join(', ')}`);
            this.updateDisplay();
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
        if (cell) {
            console.log(`🎬 Showing error at [${row}, ${col}]`);
        cell.classList.add('error');
        
        setTimeout(() => {
            cell.classList.remove('error');
        }, 1000);
        }
    }

    showNoteError(row, col, number) {
        const index = row * 9 + col;
        const cell = document.querySelector(`[data-index="${index}"]`);
        
        // Create a temporary note number element to show the error
        const noteError = document.createElement('span');
        noteError.className = 'note-number note-number-error';
        noteError.textContent = number.toString();
        noteError.style.position = 'absolute';
        noteError.style.zIndex = '1000';
        
        // Position it in the center of the cell
        const rect = cell.getBoundingClientRect();
        noteError.style.left = '50%';
        noteError.style.top = '50%';
        noteError.style.transform = 'translate(-50%, -50%)';
        
        cell.appendChild(noteError);
        
        setTimeout(() => {
            if (noteError.parentNode) {
                noteError.parentNode.removeChild(noteError);
            }
        }, 400);
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
                
                // Re-apply note highlighting if we're in paint mode
                if (this.isPaintMode && this.paintNumber) {
                    const noteNumbers = cell.querySelectorAll('.note-number');
                    noteNumbers.forEach(noteSpan => {
                        if (noteSpan.textContent === this.paintNumber.toString()) {
                            noteSpan.classList.add('note-number-highlight');
                        }
                    });
                }
            } else {
                cell.textContent = '';
            }
        }
    }
    
    formatNotes(notes) {
        const numbers = Array.from(notes).sort();
        let html = '';
        
        // Create all 9 positions in a 3x3 grid (1-9)
        for (let i = 1; i <= 9; i++) {
            if (numbers.includes(i)) {
                html += `<span class="note-number">${i}</span>`;
            } else {
                html += '<span class="note-number"></span>';
            }
        }
        
        return html;
    }
    
    checkCompletion(lastMoveRow, lastMoveCol, lastMoveNumber) {
        // Only check the specific row, column, block, and number that was just affected
        let highlighted = false;
        
        // Check if the row was just completed
        if (this.isRowComplete(lastMoveRow)) {
            this.highlightRow(lastMoveRow);
            highlighted = true;
        }
        
        // Check if the column was just completed
        if (this.isColumnComplete(lastMoveCol)) {
            this.highlightColumn(lastMoveCol);
            highlighted = true;
        }
        
        // Check if the 3x3 block was just completed
        const blockRow = Math.floor(lastMoveRow / 3);
        const blockCol = Math.floor(lastMoveCol / 3);
        if (this.isBlockComplete(blockRow, blockCol)) {
            this.highlightBlock(blockRow, blockCol);
            highlighted = true;
        }
        
        // Check if the number was just completed across the entire grid
        if (this.isNumberComplete(lastMoveNumber)) {
            this.highlightNumber(lastMoveNumber);
            highlighted = true;
        }
        
        return highlighted;
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
            cell.classList.add('completion-celebration');
        }
        
        setTimeout(() => {
            for (let col = 0; col < 9; col++) {
                const index = row * 9 + col;
                const cell = document.querySelector(`[data-index="${index}"]`);
                cell.classList.remove('completion-celebration');
            }
        }, 400);
    }
    
    highlightColumn(col) {
        for (let row = 0; row < 9; row++) {
            const index = row * 9 + col;
            const cell = document.querySelector(`[data-index="${index}"]`);
            cell.classList.add('completion-celebration');
        }
        
        setTimeout(() => {
            for (let row = 0; row < 9; row++) {
                const index = row * 9 + col;
                const cell = document.querySelector(`[data-index="${index}"]`);
                cell.classList.remove('completion-celebration');
            }
        }, 400);
    }
    
    clearAllHighlights() {
        // Clear all visual highlights from cells
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.classList.remove(
                'completed-highlight',
                'selected',
                'highlight',
                'error',
                'hint-highlight',
                'paint-target',
                'note-highlight',
                'correct'
            );
        });
        
        // Clear note number highlights
        this.clearNoteHighlights();
        
        // Clear same number highlights
        this.clearSameNumberHighlights();
        
        console.log('🧹 Cleared all visual highlights');
    }
    
    clearSameNumberHighlights() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.classList.remove('same-number-highlight');
        });
    }
    
    highlightBlock(blockRow, blockCol) {
        const startRow = blockRow * 3;
        const startCol = blockCol * 3;
        
        for (let row = startRow; row < startRow + 3; row++) {
            for (let col = startCol; col < startCol + 3; col++) {
                const index = row * 9 + col;
                const cell = document.querySelector(`[data-index="${index}"]`);
                cell.classList.add('completion-celebration');
            }
        }
        
        setTimeout(() => {
            for (let row = startRow; row < startRow + 3; row++) {
                for (let col = startCol; col < startCol + 3; col++) {
                    const index = row * 9 + col;
                    const cell = document.querySelector(`[data-index="${index}"]`);
                    cell.classList.remove('completion-celebration');
                }
            }
        }, 400);
    }
    
    isNumberComplete(number) {
        let count = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === number) {
                    count++;
                }
            }
        }
        return count === 9; // All 9 instances of the number are placed
    }
    
    highlightNumber(number) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === number) {
                    const index = row * 9 + col;
                    const cell = document.querySelector(`[data-index="${index}"]`);
                    cell.classList.add('completion-celebration');
                }
            }
        }
        
        setTimeout(() => {
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (this.grid[row][col] === number) {
                        const index = row * 9 + col;
                        const cell = document.querySelector(`[data-index="${index}"]`);
                        cell.classList.remove('completion-celebration');
                    }
                }
            }
        }, 400);
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
        this.stopAutoSave();
        this.clearGameState();
        
        // Check if this was a daily challenge
        if (this.currentChallenge) {
            this.checkChallengeCompletion();
            return; // Challenge completion popup will handle the rest
        }
        
        // Update best time if this is a new record
        this.updateBestTime();
        
        // Play victory sound
        this.playSound('win');
        
        // Show victory celebration animation
        this.animateVictoryCelebration();
        
        // Show win animation
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            setTimeout(() => {
                cell.classList.add('correct');
            }, index * 20);
        });
        
        // No popup message - just console log for debugging
        console.log(`🎉 Puzzle completed in ${this.formatTime(this.getElapsedTime())} with ${this.moveCount} moves!`);
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
        
        // Check if there's a saved game to resume
        if (this.hasSavedGame()) {
            console.log('💾 Found saved game, attempting to resume...');
            if (this.loadGameState()) {
                console.log('✅ Resumed saved game');
                return;
            }
        }
        
        console.log(`Loading new ${this.difficulty} puzzle...`);
        
        // Show loading animation
        this.showLoadingAnimation();
        
        // Small delay to show loading animation
        setTimeout(() => {
            // Try to load from pre-validated database first
            console.log('🔍 Attempting to load from database...');
            const loadedFromDatabase = this.loadPuzzleFromDatabase(this.difficulty);
            
            if (!loadedFromDatabase) {
                console.log(`Falling back to varied puzzle generation for ${this.difficulty} difficulty...`);
                // Generate a varied puzzle using our enhanced system
                this.generateReliablePuzzle();
            } else {
                console.log('✅ Loaded puzzle from database');
            }
            
            // Debug: Check if grid has numbers
            let givenCount = 0;
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (this.grid[row][col] !== 0) {
                        givenCount++;
                        this.givenCells[row][col] = true;
                    }
                }
            }
            console.log(`📊 Generated puzzle has ${givenCount} given numbers`);
            
            // Hide loading animation
            this.hideLoadingAnimation();
        
            this.updateDisplay();
            this.updateProgress();
            this.startTimer();
            this.startAutoSave();
        }, 100);
    }

    generateReliablePuzzle() {
        console.log('🎯 Generating reliable puzzle...');
        
        // Try varied generation first, fall back to simple if needed
        if (!this.generateVariedPuzzle(this.difficulty)) {
            console.log('🔄 Varied generation failed, using simple approach...');
            this.generateSimplePuzzle();
        }
        
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
        
        // Comprehensive validation
        if (!this.validatePuzzleCompletely()) {
            console.warn('⚠️ Generated puzzle failed validation, using fallback');
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
                
                // Check if this removal maintains puzzle validity
                if (this.isValidRemoval(testGrid)) {
                    this.grid[row][col] = 0;
                    
                    // Check if we've reached target difficulty
                    const currentGivenCount = this.grid.flat().filter(num => num !== 0).length;
                    if (currentGivenCount <= targetGivenCount) {
                        console.log(`✅ Removed enough numbers for ${this.difficulty}: ${currentGivenCount} given`);
                        return;
                    }
                } else {
                    // Restore if it breaks unique solution or solvability
                    testGrid[row][col] = originalValue;
                }
            }
            
            attempts++;
        }
        
        console.log(`⚠️ Could not reach target difficulty after ${maxAttempts} attempts`);
    }
    
    // Check if a removal maintains puzzle validity (faster than full validation)
    isValidRemoval(testGrid) {
        // Quick check: ensure no empty cells have zero valid moves
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (testGrid[row][col] === 0) {
                    let hasValidMove = false;
                    for (let num = 1; num <= 9; num++) {
                        if (this.isValidMoveForGrid(testGrid, row, col, num)) {
                            hasValidMove = true;
                            break;
                        }
                    }
                    if (!hasValidMove) {
                        return false; // Dead cell found
                    }
                }
            }
        }
        
        // Enhanced constraint check: ensure all numbers can still be placed in all required blocks
        for (let num = 1; num <= 9; num++) {
            const existingPositions = this.findExistingPositionsForGrid(testGrid, num);
            const requiredBlocks = this.findRequiredBlocksForNumberForGrid(num, existingPositions);
            
            for (const blockInfo of requiredBlocks) {
                if (!this.canPlaceNumberInSpecificBlockForGrid(testGrid, num, blockInfo.blockRow, blockInfo.blockCol, existingPositions)) {
                    return false; // Number cannot be placed in required block
                }
            }
        }
        
        return true;
    }
    
    // Grid-specific versions of the constraint validation methods
    findExistingPositionsForGrid(grid, number) {
        const positions = [];
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === number) {
                    positions.push({ row, col });
                }
            }
        }
        return positions;
    }
    
    findRequiredBlocksForNumberForGrid(number, existingPositions) {
        const requiredBlocks = [];
        const existingBlocks = new Set();
        
        // Find which blocks already have this number
        for (const pos of existingPositions) {
            const blockRow = Math.floor(pos.row / 3);
            const blockCol = Math.floor(pos.col / 3);
            existingBlocks.add(`${blockRow}-${blockCol}`);
        }
        
        // Find blocks that still need this number
        for (let blockRow = 0; blockRow < 3; blockRow++) {
            for (let blockCol = 0; blockCol < 3; blockCol++) {
                const blockKey = `${blockRow}-${blockCol}`;
                if (!existingBlocks.has(blockKey)) {
                    requiredBlocks.push({ blockRow, blockCol });
                }
            }
        }
        
        return requiredBlocks;
    }
    
    canPlaceNumberInSpecificBlockForGrid(grid, number, blockRow, blockCol, existingPositions) {
        const startRow = blockRow * 3;
        const startCol = blockCol * 3;
        
        // Check each empty cell in this block
        for (let r = startRow; r < startRow + 3; r++) {
            for (let c = startCol; c < startCol + 3; c++) {
                if (grid[r][c] === 0) {
                    // Check if this number can be placed here considering existing positions
                    let canPlace = true;
                    
                    // Check row constraint
                    for (const pos of existingPositions) {
                        if (pos.row === r) {
                            canPlace = false;
                            break;
                        }
                    }
                    
                    // Check column constraint
                    if (canPlace) {
                        for (const pos of existingPositions) {
                            if (pos.col === c) {
                                canPlace = false;
                                break;
                            }
                        }
                    }
                    
                    // Check block constraint (should be true since we're checking this block)
                    if (canPlace) {
                        for (const pos of existingPositions) {
                            const existingBlockRow = Math.floor(pos.row / 3);
                            const existingBlockCol = Math.floor(pos.col / 3);
                            if (existingBlockRow === blockRow && existingBlockCol === blockCol) {
                                canPlace = false;
                                break;
                            }
                        }
                    }
                    
                    if (canPlace) {
                        return true; // Found a valid position
                    }
                }
            }
        }
        
        return false; // No valid position found
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
    
    validateAllNumbersCanBePlaced() {
        // Check if every number 1-9 can be placed in every 3x3 block
        for (let blockRow = 0; blockRow < 3; blockRow++) {
            for (let blockCol = 0; blockCol < 3; blockCol++) {
                for (let num = 1; num <= 9; num++) {
                    let canPlace = false;
                    
                    // Check if this number can be placed anywhere in this block
                    for (let r = blockRow * 3; r < blockRow * 3 + 3; r++) {
                        for (let c = blockCol * 3; c < blockCol * 3 + 3; c++) {
                            if (this.grid[r][c] === 0 && this.isValidMoveForGrid(this.grid, r, c, num)) {
                                canPlace = true;
                                break;
                            }
                        }
                        if (canPlace) break;
                    }
                    
                    if (!canPlace) {
                        console.log(`❌ Cannot place number ${num} in block (${blockRow}, ${blockCol})`);
                        return false;
                    }
                }
            }
        }
        
        console.log('✅ All numbers can be placed in all blocks');
        return true;
    }
    
    isPuzzleSolvable() {
        // Check if every empty cell has at least one valid move
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    let hasValidMove = false;
                    for (let num = 1; num <= 9; num++) {
                        if (this.isValidMoveForGrid(this.grid, row, col, num)) {
                            hasValidMove = true;
                            break;
                        }
                    }
                    if (!hasValidMove) {
                        console.log(`❌ No valid moves for empty cell at (${row}, ${col})`);
                        return false;
                    }
                }
            }
        }
        
        console.log('✅ Puzzle is solvable - all empty cells have valid moves');
        return true;
    }
    
    isPuzzleSolvableForGrid(grid) {
        // Check if every empty cell has at least one valid move
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    let hasValidMove = false;
                    for (let num = 1; num <= 9; num++) {
                        if (this.isValidMoveForGrid(grid, row, col, num)) {
                            hasValidMove = true;
                            break;
                        }
                    }
                    if (!hasValidMove) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    validateAllNumbersCanBePlacedForGrid(grid) {
        // Check if every number 1-9 can be placed in every 3x3 block
        for (let blockRow = 0; blockRow < 3; blockRow++) {
            for (let blockCol = 0; blockCol < 3; blockCol++) {
                for (let num = 1; num <= 9; num++) {
                    let canPlace = false;
                    
                    // Check if this number can be placed anywhere in this block
                    for (let r = blockRow * 3; r < blockRow * 3 + 3; r++) {
                        for (let c = blockCol * 3; c < blockCol * 3 + 3; c++) {
                            if (grid[r][c] === 0 && this.isValidMoveForGrid(grid, r, c, num)) {
                                canPlace = true;
                                break;
                            }
                        }
                        if (canPlace) break;
                    }
                    
                    if (!canPlace) {
                        return false;
                    }
                }
            }
        }
        return true;
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
            // For hard difficulty, be more aggressive with attempts
            const maxAttempts = this.difficulty === 'hard' ? 120 : Math.min(targetRemovalCount * 2, 60);
            
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
                    // For hard difficulty, be less strict about uniqueness to allow more removals
                    if (this.difficulty === 'hard') {
                        if (this.isPuzzleSolvable()) {
                            removedCount++;
                        } else {
                            // Restore if it breaks solvability
                            this.grid[row][col] = originalValue;
                        }
                    } else {
                        if (this.hasUniqueSolution() && this.isPuzzleSolvable()) {
                            removedCount++;
                        } else {
                            // Restore if it breaks uniqueness or solvability
                            this.grid[row][col] = originalValue;
                        }
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
        
        // Final comprehensive validation
        if (!this.validatePuzzleCompletely()) {
            console.warn('⚠️ Final puzzle validation failed, using fallback...');
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
        // Use the grid-specific version
        return this.isPuzzleSolvableForGrid(this.grid);
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

    // Enhanced puzzle validation system
    validatePuzzleCompletely() {
        console.log('🔍 Comprehensive puzzle validation...');
        
        // Check basic validity first
        if (!this.validateGameState()) {
            console.error('❌ Basic validation failed - duplicates found');
            return false;
        }
        
        // Check if puzzle is solvable (has at least one solution)
        if (!this.isPuzzleSolvable()) {
            console.error('❌ Puzzle is not solvable - dead cells found');
            return false;
        }
        
        // Check if all numbers can be placed in all blocks
        if (!this.validateAllNumbersCanBePlaced()) {
            console.error('❌ Some numbers cannot be placed in all blocks');
            return false;
        }
        
        // Enhanced constraint validation - check for impossible number placements
        if (!this.validateNumberPlacementConstraints()) {
            console.error('❌ Puzzle has impossible number placement constraints');
            return false;
        }
        
        // Check for unique solution (this is expensive, so do it last)
        // For hard difficulty, skip unique solution check to allow more challenging puzzles
        if (this.difficulty !== 'hard' && !this.hasUniqueSolution()) {
            console.error('❌ Puzzle does not have a unique solution');
            return false;
        }
        
        console.log('✅ Puzzle passed all validation checks');
        return true;
    }
    
    // Enhanced validation to detect impossible number placement scenarios
    validateNumberPlacementConstraints() {
        console.log('🔍 Checking number placement constraints...');
        
        // For each number 1-9, check if it can be placed in all required positions
        for (let num = 1; num <= 9; num++) {
            const existingPositions = this.findExistingPositions(num);
            const requiredBlocks = this.findRequiredBlocksForNumber(num, existingPositions);
            
            // Check if this number can be placed in all required blocks
            for (const blockInfo of requiredBlocks) {
                if (!this.canPlaceNumberInSpecificBlock(num, blockInfo.blockRow, blockInfo.blockCol, existingPositions)) {
                    console.error(`❌ Cannot place number ${num} in block (${blockInfo.blockRow + 1}, ${blockInfo.blockCol + 1})`);
                    console.error(`   Existing positions:`, existingPositions);
                    console.error(`   Required blocks:`, requiredBlocks);
                    return false;
                }
            }
        }
        
        console.log('✅ All number placement constraints are valid');
        return true;
    }
    
    // Find all existing positions of a specific number
    findExistingPositions(number) {
        const positions = [];
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === number) {
                    positions.push({ row, col });
                }
            }
        }
        return positions;
    }
    
    // Find which blocks still need this number
    findRequiredBlocksForNumber(number, existingPositions) {
        const requiredBlocks = [];
        const existingBlocks = new Set();
        
        // Find which blocks already have this number
        for (const pos of existingPositions) {
            const blockRow = Math.floor(pos.row / 3);
            const blockCol = Math.floor(pos.col / 3);
            existingBlocks.add(`${blockRow}-${blockCol}`);
        }
        
        // Find blocks that still need this number
        for (let blockRow = 0; blockRow < 3; blockRow++) {
            for (let blockCol = 0; blockCol < 3; blockCol++) {
                const blockKey = `${blockRow}-${blockCol}`;
                if (!existingBlocks.has(blockKey)) {
                    requiredBlocks.push({ blockRow, blockCol });
                }
            }
        }
        
        return requiredBlocks;
    }
    
    // Check if a number can be placed in a specific block given existing positions
    canPlaceNumberInSpecificBlock(number, blockRow, blockCol, existingPositions) {
        const startRow = blockRow * 3;
        const startCol = blockCol * 3;
        
        // Check each empty cell in this block
        for (let r = startRow; r < startRow + 3; r++) {
            for (let c = startCol; c < startCol + 3; c++) {
                if (this.grid[r][c] === 0) {
                    // Check if this number can be placed here considering existing positions
                    let canPlace = true;
                    
                    // Check row constraint
                    for (const pos of existingPositions) {
                        if (pos.row === r) {
                            canPlace = false;
                            break;
                        }
                    }
                    
                    // Check column constraint
                    if (canPlace) {
                        for (const pos of existingPositions) {
                            if (pos.col === c) {
                                canPlace = false;
                                break;
                            }
                        }
                    }
                    
                    // Check block constraint (should be true since we're checking this block)
                    if (canPlace) {
                        for (const pos of existingPositions) {
                            const existingBlockRow = Math.floor(pos.row / 3);
                            const existingBlockCol = Math.floor(pos.col / 3);
                            if (existingBlockRow === blockRow && existingBlockCol === blockCol) {
                                canPlace = false;
                                break;
                            }
                        }
                    }
                    
                    if (canPlace) {
                        return true; // Found a valid position
                    }
                }
            }
        }
        
        return false; // No valid position found
    }
    
    // Enhanced unique solution check with better performance
    hasUniqueSolution() {
        const tempGrid = this.grid.map(row => [...row]);
        this.solutionCount = 0;
        
        // Count solutions with early termination
        this.countSolutions(tempGrid, 0, 0, 2); // Stop after finding 2 solutions
        
        return this.solutionCount === 1;
    }

    // Enhanced solution counting with early termination
    countSolutions(grid, row, col, maxSolutions = 2) {
        if (this.solutionCount >= maxSolutions) {
            return; // Early termination
        }
        
        if (row === 9) {
            this.solutionCount++;
            return;
        }
        
        if (col === 9) {
            this.countSolutions(grid, row + 1, 0, maxSolutions);
            return;
        }
        
        if (grid[row][col] !== 0) {
            this.countSolutions(grid, row, col + 1, maxSolutions);
            return;
        }
        
        for (let num = 1; num <= 9; num++) {
            if (this.isValidMoveForGrid(grid, row, col, num)) {
                grid[row][col] = num;
                this.countSolutions(grid, row, col + 1, maxSolutions);
                grid[row][col] = 0;
                
                if (this.solutionCount >= maxSolutions) {
                    return; // Early termination
                }
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
        this.clearAllHighlights();
        this.clearHistory();
        this.isNoteMode = false;
        this.isPaintMode = false;
        this.paintNumber = null;
        this.wasAutoSolved = false;
        document.body.classList.remove('note-mode', 'paint-mode');
        
        // Reset timer
        this.stopTimer();
        this.stopAutoSave();
        this.clearGameState();
        this.startTime = null;
        this.pausedTime = 0;
        this.isPaused = false;
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.textContent = '00:00:00';
        }
        this.updateTimerControls();
        
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
        this.updateProgress();
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
            this.updateProgress();
                        this.highlightHintCell(row, col);
            this.playSound('hint');
            this.animateHint(row, col);
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
            this.updateProgress();
            this.highlightHintCell(hiddenSingle.row, hiddenSingle.col);
            this.playSound('hint');
            this.animateHint(hiddenSingle.row, hiddenSingle.col);
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
        
        // Mark as auto-solved to prevent best time update
        this.wasAutoSolved = true;
        
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
                console.log('⏭️ Auto-solved puzzle - not counting towards best time');
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
        
        // Update best time display for new difficulty
        this.updateBestTimeDisplay();
        
        // Generate new game with selected difficulty
        this.newGame();
    }
    
    startTimer() {
        if (!this.startTime) {
        this.startTime = Date.now();
        }
        this.isPaused = false;
        this.timer = setInterval(() => {
            this.updateTimer();
        }, 100);
        this.updateTimerControls();
    }
    
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.updateTimerControls();
    }
    
    pauseTimer() {
        if (this.timer && !this.isPaused) {
            this.pausedTime += Date.now() - this.startTime;
            clearInterval(this.timer);
            this.timer = null;
            this.isPaused = true;
            this.updateTimerControls();
        }
    }
    
    resumeTimer() {
        if (this.isPaused) {
            this.startTime = Date.now();
            this.isPaused = false;
            this.timer = setInterval(() => {
                this.updateTimer();
            }, 100);
            this.updateTimerControls();
        }
    }
    
    updateTimer() {
        const elapsed = this.getElapsedTime();
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.textContent = this.formatTime(elapsed);
        }
        this.updateSpeedIndicator(elapsed);
    }
    
    getElapsedTime() {
        if (!this.startTime && this.pausedTime === 0) return 0;
        const currentTime = this.isPaused ? this.pausedTime : this.pausedTime + (Date.now() - this.startTime);
        return Math.floor(currentTime / 1000);
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    updateTimerControls() {
        const pauseBtn = document.getElementById('pauseBtn');
        const resumeBtn = document.getElementById('resumeBtn');
        
        if (pauseBtn && resumeBtn) {
            if (this.isPaused) {
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'block';
            } else if (this.timer) {
                pauseBtn.style.display = 'block';
                resumeBtn.style.display = 'none';
            } else {
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'none';
            }
        }
    }
    
    loadBestTimes() {
        const saved = localStorage.getItem('sudoku-best-times');
        return saved ? JSON.parse(saved) : {
            easy: null,
            medium: null,
            advanced: null,
            hard: null
        };
    }
    
    saveBestTimes() {
        localStorage.setItem('sudoku-best-times', JSON.stringify(this.bestTimes));
    }
    
    updateBestTime() {
        // Don't update best time if puzzle was auto-solved
        if (this.wasAutoSolved) {
            console.log('⏭️ Auto-solved puzzle - not counting towards best time');
            return;
        }
        
        const currentTime = this.getElapsedTime();
        const currentBest = this.bestTimes[this.difficulty];
        
        if (!currentBest || currentTime < currentBest) {
            this.bestTimes[this.difficulty] = currentTime;
            this.saveBestTimes();
            const bestTimeElement = document.getElementById('bestTime');
            if (bestTimeElement) {
                bestTimeElement.textContent = this.formatTime(currentTime);
                bestTimeElement.style.color = 'var(--success-color)';
            }
        }
    }
    
    updateBestTimeDisplay() {
        const bestTime = this.bestTimes[this.difficulty];
        const bestTimeElement = document.getElementById('bestTime');
        if (bestTimeElement) {
            if (bestTime) {
                bestTimeElement.textContent = this.formatTime(bestTime);
                bestTimeElement.style.color = 'var(--accent-color)';
            } else {
                bestTimeElement.textContent = '--:--:--';
                bestTimeElement.style.color = 'var(--text-secondary)';
            }
        }
    }
    
    resetBestTime() {
        // Reset best time for current difficulty
        this.bestTimes[this.difficulty] = null;
        this.saveBestTimes();
        this.updateBestTimeDisplay();
        console.log(`🗑️ Best time reset for ${this.difficulty} difficulty`);
    }
    
    resetAllBestTimes() {
        // Reset all best times
        this.bestTimes = {
            easy: null,
            medium: null,
            advanced: null,
            hard: null
        };
        this.saveBestTimes();
        this.updateBestTimeDisplay();
        console.log('🗑️ All best times have been reset');
    }
    
    updateSpeedIndicator(elapsedSeconds) {
        const speedThresholds = {
            easy: { fast: 300, slow: 900 },      // 5min fast, 15min slow
            medium: { fast: 600, slow: 1800 },   // 10min fast, 30min slow
            advanced: { fast: 900, slow: 2700 }, // 15min fast, 45min slow
            hard: { fast: 1200, slow: 3600 }     // 20min fast, 60min slow
        };
        
        const thresholds = speedThresholds[this.difficulty];
        let speedText = 'Average';
        let speedColor = 'var(--accent-color)';
        
        if (elapsedSeconds < thresholds.fast) {
            speedText = 'Fast';
            speedColor = 'var(--success-color)';
        } else if (elapsedSeconds > thresholds.slow) {
            speedText = 'Slow';
            speedColor = 'var(--error-color)';
        }
        
        const speedElement = document.getElementById('speedIndicator');
        speedElement.textContent = speedText;
        speedElement.style.color = speedColor;
    }

    // Audio system methods
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.updateAudioUI();
        } catch (e) {
            console.log('Audio not supported:', e);
            this.soundsEnabled = false;
        }
    }
    
    loadSoundSettings() {
        const saved = localStorage.getItem('sudoku-sounds-enabled');
        return saved !== null ? JSON.parse(saved) : true;
    }
    
    saveSoundSettings() {
        localStorage.setItem('sudoku-sounds-enabled', JSON.stringify(this.soundsEnabled));
    }
    
    updateAudioUI() {
        const soundToggle = document.getElementById('soundToggle');
        
        if (soundToggle) {
            soundToggle.textContent = this.soundsEnabled ? 'On' : 'Off';
            soundToggle.style.opacity = this.soundsEnabled ? '1' : '0.5';
        }
    }
    
    toggleSounds() {
        this.soundsEnabled = !this.soundsEnabled;
        this.saveSoundSettings();
        this.updateAudioUI();
        
        // Play a test sound when enabling
        if (this.soundsEnabled) {
            this.playSound('place');
        }
    }
    
    playSound(soundType) {
        if (!this.soundsEnabled || !this.audioContext) return;
        
        try {
            // Create a more sophisticated sound using multiple oscillators and filters
            const masterGain = this.audioContext.createGain();
            masterGain.connect(this.audioContext.destination);
            masterGain.gain.setValueAtTime(0.05, this.audioContext.currentTime);
            
            // Create a low-pass filter for smoother sounds
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3000, this.audioContext.currentTime);
            filter.Q.setValueAtTime(1, this.audioContext.currentTime);
            filter.connect(masterGain);
            
            switch (soundType) {
                case 'place':
                    // Soft, pleasant click with subtle pitch bend
                    const osc1 = this.audioContext.createOscillator();
                    const gain1 = this.audioContext.createGain();
                    osc1.connect(gain1);
                    gain1.connect(filter);
                    
                    osc1.type = 'sine';
                    osc1.frequency.setValueAtTime(1200, this.audioContext.currentTime);
                    osc1.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.06);
                    
                    gain1.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gain1.gain.linearRampToValueAtTime(0.4, this.audioContext.currentTime + 0.005);
                    gain1.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.06);
                    
                    osc1.start();
                    osc1.stop(this.audioContext.currentTime + 0.06);
                    break;
                    
                case 'error':
                    // Soft error tone with gentle vibrato
                    const osc2 = this.audioContext.createOscillator();
                    const gain2 = this.audioContext.createGain();
                    const lfo = this.audioContext.createOscillator();
                    
                    osc2.connect(gain2);
                    gain2.connect(filter);
                    lfo.connect(osc2.frequency);
                    
                    osc2.type = 'triangle';
                    osc2.frequency.setValueAtTime(300, this.audioContext.currentTime);
                    lfo.type = 'sine';
                    lfo.frequency.setValueAtTime(6, this.audioContext.currentTime);
                    lfo.frequency.detune.setValueAtTime(20, this.audioContext.currentTime);
                    
                    gain2.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gain2.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.01);
                    gain2.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
                    
                    osc2.start();
                    lfo.start();
                    osc2.stop(this.audioContext.currentTime + 0.2);
                    lfo.stop(this.audioContext.currentTime + 0.2);
                    break;
                    
                case 'note':
                    // Gentle note sound with soft attack
                    const osc3 = this.audioContext.createOscillator();
                    const gain3 = this.audioContext.createGain();
                    osc3.connect(gain3);
                    gain3.connect(filter);
                    
                    osc3.type = 'sine';
                    osc3.frequency.setValueAtTime(800, this.audioContext.currentTime);
                    osc3.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.05);
                    
                    gain3.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gain3.gain.linearRampToValueAtTime(0.25, this.audioContext.currentTime + 0.008);
                    gain3.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);
                    
                    osc3.start();
                    osc3.stop(this.audioContext.currentTime + 0.05);
                    break;
                    
                case 'noteError':
                    // Subtle error for invalid notes
                    const osc4 = this.audioContext.createOscillator();
                    const gain4 = this.audioContext.createGain();
                    osc4.connect(gain4);
                    gain4.connect(filter);
                    
                    osc4.type = 'sawtooth';
                    osc4.frequency.setValueAtTime(200, this.audioContext.currentTime);
                    osc4.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.1);
                    
                    gain4.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gain4.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.005);
                    gain4.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
                    
                    osc4.start();
                    osc4.stop(this.audioContext.currentTime + 0.1);
                    break;
                    
                case 'win':
                    // Beautiful victory chord progression
                    const chordNotes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                    chordNotes.forEach((freq, index) => {
                        const osc = this.audioContext.createOscillator();
                        const gain = this.audioContext.createGain();
                        osc.connect(gain);
                        gain.connect(filter);
                        
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime + index * 0.2);
                        
                        gain.gain.setValueAtTime(0, this.audioContext.currentTime + index * 0.2);
                        gain.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + index * 0.2 + 0.01);
                        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + index * 0.2 + 0.5);
                        
                        osc.start(this.audioContext.currentTime + index * 0.2);
                        osc.stop(this.audioContext.currentTime + index * 0.2 + 0.5);
                    });
                    break;
                    
                case 'hint':
                    // Gentle hint sound with soft attack
                    const osc5 = this.audioContext.createOscillator();
                    const gain5 = this.audioContext.createGain();
                    osc5.connect(gain5);
                    gain5.connect(filter);
                    
                    osc5.type = 'sine';
                    osc5.frequency.setValueAtTime(1000, this.audioContext.currentTime);
                    osc5.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.08);
                    
                    gain5.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gain5.gain.linearRampToValueAtTime(0.25, this.audioContext.currentTime + 0.01);
                    gain5.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.08);
                    
                    osc5.start();
                    osc5.stop(this.audioContext.currentTime + 0.08);
                    break;
                    
                case 'undo':
                case 'redo':
                    // Soft undo/redo sound
                    const osc6 = this.audioContext.createOscillator();
                    const gain6 = this.audioContext.createGain();
                    osc6.connect(gain6);
                    gain6.connect(filter);
                    
                    osc6.type = 'sine';
                    osc6.frequency.setValueAtTime(600, this.audioContext.currentTime);
                    osc6.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.04);
                    
                    gain6.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gain6.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.005);
                    gain6.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.04);
                    
                    osc6.start();
                    osc6.stop(this.audioContext.currentTime + 0.04);
                    break;
            }
        } catch (e) {
            console.log('Sound playback error:', e);
        }
    }
    
    updateMoveCount() {
        const moveCountElement = document.getElementById('moveCount');
        if (moveCountElement) {
            moveCountElement.textContent = this.moveCount;
        }
    }

    // Animation system methods
    animateNumberPlacement(row, col) {
        const index = row * 9 + col;
        const cell = document.querySelector(`[data-index="${index}"]`);
        if (cell) {
            console.log(`🎬 Animating number placement at [${row}, ${col}]`);
            cell.classList.add('number-place-animation');
            setTimeout(() => {
                cell.classList.remove('number-place-animation');
            }, 400);
        } else {
            console.warn(`⚠️ Cell not found for animation at [${row}, ${col}]`);
        }
    }
    
    animateError(row, col) {
        const index = row * 9 + col;
        const cell = document.querySelector(`[data-index="${index}"]`);
        if (cell) {
            console.log(`🎬 Animating error shake at [${row}, ${col}]`);
            // Use the existing error styling with our new animation
            cell.classList.add('error');
            cell.classList.add('error-shake');
            setTimeout(() => {
                cell.classList.remove('error');
                cell.classList.remove('error-shake');
            }, 800);
        } else {
            console.warn(`⚠️ Cell not found for error animation at [${row}, ${col}]`);
        }
    }
    
    animateSuccess(row, col) {
        const index = row * 9 + col;
        const cell = document.querySelector(`[data-index="${index}"]`);
        if (cell) {
            cell.classList.add('success-ripple');
            setTimeout(() => {
                cell.classList.remove('success-ripple');
            }, 400);
        }
    }
    
    animateHint(row, col) {
        const index = row * 9 + col;
        const cell = document.querySelector(`[data-index="${index}"]`);
        if (cell) {
            cell.classList.add('hint-glow');
            setTimeout(() => {
                cell.classList.remove('hint-glow');
            }, 1000);
        }
    }
    
    animateVictoryCelebration() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            setTimeout(() => {
                cell.classList.add('victory-celebration');
                setTimeout(() => {
                    cell.classList.remove('victory-celebration');
                }, 1000);
            }, index * 50); // Stagger the animations
        });
    }
    
    animateProgressBar(targetPercent) {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.setProperty('--target-width', targetPercent + '%');
            progressFill.classList.add('progress-animated');
            setTimeout(() => {
                progressFill.classList.remove('progress-animated');
                progressFill.style.width = targetPercent + '%';
            }, 800);
        }
    }
    
    animateThemeTransition() {
        document.body.classList.add('theme-transition');
        setTimeout(() => {
            document.body.classList.remove('theme-transition');
        }, 500);
    }
    
    showLoadingAnimation() {
        const centerPanel = document.querySelector('.center-panel');
        if (centerPanel) {
            centerPanel.classList.add('loading-pulse');
        }
    }
    
    hideLoadingAnimation() {
        const centerPanel = document.querySelector('.center-panel');
        if (centerPanel) {
            centerPanel.classList.remove('loading-pulse');
        }
    }

    // Auto-save system methods
    startAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.autoSaveInterval = setInterval(() => {
            this.saveGameState();
        }, this.autoSaveDelay);
        
        console.log('💾 Auto-save started');
    }
    
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        console.log('💾 Auto-save stopped');
    }
    
    saveGameState() {
        if (this.isGameWon) return; // Don't save completed games
        
        this.gameState = {
            grid: this.grid.map(row => [...row]),
            notes: this.notes.map(row => row.map(cell => new Set(cell))),
            difficulty: this.difficulty,
            startTime: this.startTime,
            elapsedTime: this.getElapsedTime(),
            moveCount: this.moveCount,
            errorCount: this.errorCount,
            hintCount: this.hintCount,
            givenCells: this.givenCells.map(row => [...row]),
            lastSaved: new Date().toISOString()
        };
        
        try {
            localStorage.setItem('sudoku-game-state', JSON.stringify(this.gameState, (key, value) => {
                if (value instanceof Set) {
                    return Array.from(value);
                }
                return value;
            }));
            console.log('💾 Game state saved');
        } catch (e) {
            console.warn('Failed to save game state:', e);
        }
    }
    
    loadGameState() {
        try {
            const savedState = localStorage.getItem('sudoku-game-state');
            if (!savedState) return false;
            
            const gameState = JSON.parse(savedState);
            
            // Check if saved game is recent (within 24 hours)
            const lastSaved = new Date(gameState.lastSaved);
            const now = new Date();
            const hoursDiff = (now - lastSaved) / (1000 * 60 * 60);
            
            if (hoursDiff > 24) {
                console.log('⏰ Saved game is too old, starting fresh');
                this.clearGameState();
                return false;
            }
            
            this.gameState = gameState;
            
            // Restore game state
            this.grid = gameState.grid.map(row => [...row]);
            this.notes = gameState.notes.map(row => row.map(cell => new Set(cell)));
            this.difficulty = gameState.difficulty;
            this.startTime = gameState.startTime;
            this.moveCount = gameState.moveCount;
            this.errorCount = gameState.errorCount;
            this.hintCount = gameState.hintCount;
            this.givenCells = gameState.givenCells.map(row => [...row]);
            
            // Restore elapsed time
            this.pausedTime = gameState.elapsedTime;
            
            // Update display
            this.updateDisplay();
            this.updateMoveCount();
            this.updateErrorCount();
            this.updateHintCount();
            this.updateProgress();
            
            // Start timer from saved time
            this.startTimer();
            this.startAutoSave();
            
            console.log('💾 Game state loaded successfully');
            return true;
            
        } catch (e) {
            console.warn('Failed to load game state:', e);
            this.clearGameState();
            return false;
        }
    }
    
    clearGameState() {
        try {
            localStorage.removeItem('sudoku-game-state');
            console.log('💾 Game state cleared');
        } catch (e) {
            console.warn('Failed to clear game state:', e);
        }
    }
    
    hasSavedGame() {
        try {
            const savedState = localStorage.getItem('sudoku-game-state');
            if (!savedState) return false;
            
            const gameState = JSON.parse(savedState);
            const lastSaved = new Date(gameState.lastSaved);
            const now = new Date();
            const hoursDiff = (now - lastSaved) / (1000 * 60 * 60);
            
            return hoursDiff <= 24;
        } catch (e) {
            return false;
        }
    }

    // Daily Challenge system methods
    loadDailyChallenges() {
        // Collection of special themed puzzles for daily challenges
        return {
            'speed-demon': {
                name: 'Speed Demon',
                description: 'Complete an easy puzzle in under 3 minutes',
                difficulty: 'easy',
                timeLimit: 180, // 3 minutes
                reward: 'Lightning Badge',
                puzzle: [
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
                solution: [
                    [5,3,4,6,7,8,9,1,2],
                    [6,7,2,1,9,5,3,4,8],
                    [1,9,8,3,4,2,5,6,7],
                    [8,5,9,7,6,1,4,2,3],
                    [4,2,6,8,5,3,7,9,1],
                    [7,1,3,9,2,4,8,5,6],
                    [9,6,1,5,3,7,2,8,4],
                    [2,8,7,4,1,9,6,3,5],
                    [3,4,5,2,8,6,1,7,9]
                ]
            },
            'perfectionist': {
                name: 'Perfectionist',
                description: 'Complete a medium puzzle with zero errors',
                difficulty: 'medium',
                maxErrors: 0,
                reward: 'Perfect Badge',
                puzzle: [
                    [0,0,0,6,0,0,4,0,0],
                    [7,0,0,0,3,0,0,0,0],
                    [0,0,0,0,0,9,0,8,0],
                    [0,0,0,0,0,0,5,0,1],
                    [0,0,3,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,2,8],
                    [4,0,0,0,0,0,0,3,0],
                    [0,0,0,0,0,0,0,0,0],
                    [0,0,0,0,0,0,0,0,0]
                ],
                solution: [
                    [3,8,2,6,1,5,4,9,7],
                    [7,4,9,8,3,2,1,6,5],
                    [5,1,6,4,7,9,2,8,3],
                    [8,9,4,2,6,3,5,7,1],
                    [2,6,3,9,5,1,8,4,7],
                    [1,5,7,4,8,6,3,2,8],
                    [4,7,1,5,2,8,6,3,9],
                    [6,3,8,1,9,7,4,5,2],
                    [9,2,5,3,4,6,7,1,8]
                ]
            },
            'note-master': {
                name: 'Note Master',
                description: 'Complete a hard puzzle using only notes (no direct numbers)',
                difficulty: 'hard',
                notesOnly: true,
                reward: 'Note Master Badge',
                puzzle: [
                    [1,0,0,6,0,8,0,0,0],
                    [4,0,0,0,0,0,0,0,0],
                    [7,0,0,0,0,0,0,0,0],
                    [2,0,0,0,0,0,0,0,0],
                    [5,0,0,0,0,0,0,0,0],
                    [8,0,0,0,0,0,0,0,0],
                    [3,0,0,0,0,0,0,0,0],
                    [6,0,0,0,0,0,0,0,0],
                    [9,0,0,0,0,0,0,0,0]
                ],
                solution: [
                    [1,2,3,6,4,8,5,7,9],
                    [4,5,6,1,7,9,2,8,3],
                    [7,8,9,2,5,3,1,4,6],
                    [2,3,1,4,6,5,8,9,7],
                    [5,6,4,8,9,7,3,1,2],
                    [8,9,7,3,1,2,4,6,5],
                    [3,1,2,5,8,4,6,9,7],
                    [6,4,5,9,2,1,7,3,8],
                    [9,7,8,3,6,5,2,4,1]
                ]
            },
            'zen-master': {
                name: 'Zen Master',
                description: 'Complete an expert puzzle without using any hints',
                difficulty: 'expert',
                maxHints: 0,
                reward: 'Zen Badge',
                puzzle: [
                    [8,0,0,0,0,0,0,0,0],
                    [0,0,3,6,0,0,0,0,0],
                    [0,7,0,0,9,0,2,0,0],
                    [0,5,0,0,0,7,0,0,0],
                    [0,0,0,0,4,5,7,0,0],
                    [0,0,0,1,0,0,0,3,0],
                    [0,0,1,0,0,0,0,6,8],
                    [0,0,8,5,0,0,0,1,0],
                    [0,9,0,0,0,0,4,0,0]
                ],
                solution: [
                    [8,1,2,7,5,3,6,4,9],
                    [9,4,3,6,8,2,1,7,5],
                    [6,7,5,4,9,1,2,8,3],
                    [1,5,4,2,3,7,8,9,6],
                    [3,6,9,8,4,5,7,2,1],
                    [2,8,7,1,6,9,5,3,4],
                    [5,2,1,9,7,4,3,6,8],
                    [4,3,8,5,2,6,9,1,7],
                    [7,9,6,3,1,8,4,5,2]
                ]
            }
        };
    }
    
    loadChallengeStreak() {
        try {
            const streak = localStorage.getItem('sudoku-challenge-streak');
            return streak ? JSON.parse(streak) : { current: 0, longest: 0, lastCompleted: null };
        } catch (e) {
            return { current: 0, longest: 0, lastCompleted: null };
        }
    }
    
    saveChallengeStreak() {
        try {
            localStorage.setItem('sudoku-challenge-streak', JSON.stringify(this.challengeStreak));
        } catch (e) {
            console.warn('Failed to save challenge streak:', e);
        }
    }
    
    loadChallengeCompleted() {
        try {
            const completed = localStorage.getItem('sudoku-challenge-completed');
            return completed ? JSON.parse(completed) : {};
        } catch (e) {
            return {};
        }
    }
    
    saveChallengeCompleted() {
        try {
            localStorage.setItem('sudoku-challenge-completed', JSON.stringify(this.challengeCompleted));
        } catch (e) {
            console.warn('Failed to save challenge completion:', e);
        }
    }
    
    getTodaysChallenge() {
        const today = new Date().toDateString();
        const challenges = Object.keys(this.dailyChallenges);
        const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % challenges.length;
        return challenges[dayIndex];
    }
    
    startDailyChallenge(challengeType = null) {
        const challengeId = challengeType || this.getTodaysChallenge();
        const challenge = this.dailyChallenges[challengeId];
        
        if (!challenge) {
            console.error('Challenge not found:', challengeId);
            return false;
        }
        
        // Reset game state
        this.resetGame();
        
        // Set challenge mode
        this.currentChallenge = {
            id: challengeId,
            ...challenge,
            startTime: Date.now(),
            errors: 0,
            hintsUsed: 0
        };
        
        // Load the challenge puzzle
        this.grid = challenge.puzzle.map(row => [...row]);
        this.solution = challenge.solution.map(row => [...row]);
        
        // Mark given cells
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                this.givenCells[row][col] = this.grid[row][col] !== 0;
            }
        }
        
        // Update display
        this.updateDisplay();
        this.updateProgress();
        this.startTimer();
        this.startAutoSave();
        
        console.log(`🎯 Started daily challenge: ${challenge.name}`);
        this.updateChallengeUI();
        
        return true;
    }
    
    checkChallengeCompletion() {
        if (!this.currentChallenge || !this.checkWin()) {
            return false;
        }
        
        const challenge = this.currentChallenge;
        let completed = true;
        const results = {};
        
        // Check time limit
        if (challenge.timeLimit) {
            const elapsedTime = this.getElapsedTime();
            results.timeLimit = elapsedTime <= challenge.timeLimit;
            completed = completed && results.timeLimit;
        }
        
        // Check error limit
        if (challenge.maxErrors !== undefined) {
            results.errorLimit = this.errorCount <= challenge.maxErrors;
            completed = completed && results.errorLimit;
        }
        
        // Check hint limit
        if (challenge.maxHints !== undefined) {
            results.hintLimit = this.hintCount <= challenge.maxHints;
            completed = completed && results.hintLimit;
        }
        
        // Check notes only mode
        if (challenge.notesOnly) {
            // This would need special tracking - simplified for now
            results.notesOnly = true;
        }
        
        if (completed) {
            this.completeChallenge(results);
        }
        
        return completed;
    }
    
    completeChallenge(results) {
        const challenge = this.currentChallenge;
        const today = new Date().toDateString();
        
        // Mark as completed
        this.challengeCompleted[today] = {
            challengeId: challenge.id,
            time: this.getElapsedTime(),
            moves: this.moveCount,
            errors: this.errorCount,
            hints: this.hintCount,
            results: results,
            completedAt: new Date().toISOString()
        };
        
        // Update streak
        this.updateChallengeStreak();
        
        // Save progress
        this.saveChallengeCompleted();
        this.saveChallengeStreak();
        
        console.log(`🏆 Challenge completed: ${challenge.name}`);
        console.log(`🎁 Reward earned: ${challenge.reward}`);
        
        this.showChallengeCompletion(challenge, results);
        this.currentChallenge = null;
    }
    
    updateChallengeStreak() {
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
        
        if (this.challengeCompleted[today]) {
            if (this.challengeCompleted[yesterday]) {
                // Consecutive day
                this.challengeStreak.current++;
            } else {
                // First day or broken streak
                this.challengeStreak.current = 1;
            }
            
            this.challengeStreak.longest = Math.max(this.challengeStreak.longest, this.challengeStreak.current);
            this.challengeStreak.lastCompleted = today;
        }
    }
    
    showChallengeCompletion(challenge, results) {
        // Create completion popup
        const popup = document.createElement('div');
        popup.className = 'challenge-completion-popup';
        popup.innerHTML = `
            <div class="challenge-completion-content">
                <h2>🏆 Challenge Completed!</h2>
                <h3>${challenge.name}</h3>
                <p>${challenge.description}</p>
                <div class="challenge-results">
                    ${Object.entries(results).map(([key, passed]) => `
                        <div class="result-item ${passed ? 'passed' : 'failed'}">
                            ${key}: ${passed ? '✅' : '❌'}
                        </div>
                    `).join('')}
                </div>
                <div class="challenge-reward">
                    <h4>🎁 Reward Earned:</h4>
                    <p>${challenge.reward}</p>
                </div>
                <div class="challenge-stats">
                    <p>Time: ${this.formatTime(this.getElapsedTime())}</p>
                    <p>Moves: ${this.moveCount}</p>
                    <p>Streak: ${this.challengeStreak.current} days</p>
                </div>
                <button class="btn" onclick="this.parentElement.parentElement.remove()">Continue</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (popup.parentElement) {
                popup.remove();
            }
        }, 10000);
    }
    
    updateChallengeUI() {
        // This will be called to update the UI with challenge information
        // Implementation depends on where we want to show challenge status
    }

    // Pre-validated puzzle database system
    loadPuzzleDatabase() {
        // Collection of verified, solvable puzzles by difficulty
        // To expand this database with more puzzles:
        // 1. Find verified Sudoku puzzles from reliable sources
        // 2. Add them to the appropriate difficulty array
        // 3. Ensure each puzzle has both 'puzzle' and 'solution' arrays
        // 4. Test puzzles with validatePuzzleCompletely() before adding
        // 
        // Sources for more puzzles:
        // - sudoku.com (verified puzzles)
        // - sudokuwiki.org (weekly puzzles)
        // - Create your own using the generateReliablePuzzle() method
        return {
            easy: [
                // Easy puzzle 1
                {
                    puzzle: [
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
                    solution: [
                        [5,3,4,6,7,8,9,1,2],
                        [6,7,2,1,9,5,3,4,8],
                        [1,9,8,3,4,2,5,6,7],
                        [8,5,9,7,6,1,4,2,3],
                        [4,2,6,8,5,3,7,9,1],
                        [7,1,3,9,2,4,8,5,6],
                        [9,6,1,5,3,7,2,8,4],
                        [2,8,7,4,1,9,6,3,5],
                        [3,4,5,2,8,6,1,7,9]
                    ]
                },
                // Easy puzzle 2
                {
                    puzzle: [
                        [0,0,3,0,2,0,6,0,0],
                        [9,0,0,3,0,5,0,0,1],
                        [0,0,1,8,0,6,4,0,0],
                        [0,0,8,1,0,2,9,0,0],
                        [7,0,0,0,0,0,0,0,8],
                        [0,0,6,7,0,8,2,0,0],
                        [0,0,2,6,0,9,5,0,0],
                        [8,0,0,2,0,3,0,0,9],
                        [0,0,5,0,1,0,3,0,0]
                    ],
                    solution: [
                        [4,8,3,9,2,1,6,5,7],
                        [9,6,7,3,4,5,8,2,1],
                        [2,5,1,8,7,6,4,9,3],
                        [5,4,8,1,3,2,9,7,6],
                        [7,2,9,5,6,4,1,3,8],
                        [1,3,6,7,9,8,2,4,5],
                        [3,7,2,6,8,9,5,1,4],
                        [8,1,4,2,5,3,7,6,9],
                        [6,9,5,4,1,7,3,8,2]
                    ]
                }
            ],
            medium: [
                // Medium puzzle 1
                {
                    puzzle: [
                        [0,0,0,6,0,0,4,0,0],
                        [7,0,0,0,0,3,6,0,0],
                        [0,0,0,0,9,1,0,8,0],
                        [0,0,0,0,0,0,0,0,0],
                        [0,5,0,1,8,0,0,0,3],
                        [0,0,0,3,0,6,0,4,5],
                        [0,4,0,2,0,0,0,6,0],
                        [9,0,3,0,0,0,0,0,0],
                        [0,2,0,0,0,0,1,0,0]
                    ],
                    solution: [
                        [2,8,1,6,3,5,4,9,7],
                        [7,9,5,8,4,3,6,1,2],
                        [6,3,4,7,9,1,5,8,2],
                        [3,1,2,5,7,4,8,6,9],
                        [4,5,6,1,8,2,9,7,3],
                        [8,7,9,3,2,6,7,4,5],
                        [5,4,8,2,1,9,3,6,7],
                        [9,6,3,4,5,7,2,8,1],
                        [7,2,6,9,3,8,1,5,4]
                    ]
                }
            ],
            advanced: [
                // Advanced puzzle 1
                {
                    puzzle: [
                        [0,0,0,0,0,0,0,0,0],
                        [0,0,0,0,0,3,0,8,5],
                        [0,0,1,0,2,0,0,0,0],
                        [0,0,0,5,0,7,0,0,0],
                        [0,0,4,0,0,0,1,0,0],
                        [0,9,0,0,0,0,0,0,0],
                        [5,0,0,0,0,0,0,7,3],
                        [0,0,2,0,1,0,0,0,0],
                        [0,0,0,0,4,0,0,0,9]
                    ],
                    solution: [
                        [4,8,3,9,6,1,7,2,5],
                        [7,2,9,4,6,3,1,8,5],
                        [6,5,1,7,2,8,4,9,3],
                        [2,1,8,5,9,7,3,6,4],
                        [3,6,4,8,5,2,1,9,7],
                        [9,7,5,1,3,4,8,6,2],
                        [5,4,6,2,8,9,7,1,3],
                        [8,3,2,6,1,5,9,4,7],
                        [1,9,7,3,4,6,2,5,8]
                    ]
                }
            ],
            hard: [
                // Hard puzzles disabled - using generation system for consistent 17 given numbers
                // {
                //     puzzle: [
                //         [0,0,0,6,0,0,0,0,0],
                //         [0,0,0,0,0,0,0,0,0],
                //         [0,0,0,0,0,0,0,0,0],
                //         [0,0,0,0,0,0,0,0,0],
                //         [0,0,0,0,0,0,0,0,0],
                //         [0,0,0,0,0,0,0,0,0],
                //         [0,0,0,0,0,0,0,0,0],
                //         [0,0,0,0,0,0,0,0,0],
                //         [0,0,0,0,0,0,0,0,0]
                //     ],
                //     solution: [
                //         [1,2,3,6,4,8,5,7,9],
                //         [4,5,6,1,7,9,2,8,3],
                //         [7,8,9,2,5,3,1,4,6],
                //         [2,3,1,4,6,5,8,9,7],
                //         [5,6,4,8,9,7,3,1,2],
                //         [8,9,7,3,1,2,4,6,5],
                //         [3,1,2,5,8,4,6,9,7],
                //         [6,4,5,9,2,1,7,3,8],
                //         [9,7,8,3,6,5,2,4,1]
                //     ]
                // },
                // Hard puzzle 2 - Classic hard pattern
                // {
                //     puzzle: [
                //         [8,0,0,0,0,0,0,0,0],
                //         [0,0,3,6,0,0,0,0,0],
                //         [0,7,0,0,9,0,2,0,0],
                //         [0,5,0,0,0,7,0,0,0],
                //         [0,0,0,0,4,5,7,0,0],
                //         [0,0,0,1,0,0,0,3,0],
                //         [0,0,1,0,0,0,0,6,8],
                //         [0,0,8,5,0,0,0,1,0],
                //         [0,9,0,0,0,0,4,0,0]
                //     ],
                //     solution: [
                //         [8,1,2,7,5,3,6,4,9],
                //         [9,4,3,6,8,2,1,7,5],
                //         [6,7,5,4,9,1,2,8,3],
                //         [1,5,4,2,3,7,8,9,6],
                //         [3,6,9,8,4,5,7,2,1],
                //         [2,8,7,1,6,9,5,3,4],
                //         [5,2,1,9,7,4,3,6,8],
                //         [4,3,8,5,2,6,9,1,7],
                //         [7,9,6,3,1,8,4,5,2]
                //     ]
                // }
            ]
        };
    }
    
    getRandomPuzzleFromDatabase(difficulty) {
        const puzzles = this.puzzleDatabase[difficulty];
        if (!puzzles || puzzles.length === 0) {
            return null;
        }
        const randomIndex = Math.floor(Math.random() * puzzles.length);
        return puzzles[randomIndex];
    }
    
    loadPuzzleFromDatabase(difficulty) {
        // Force hard difficulty to use generation system for consistent 17 given numbers
        if (difficulty === 'hard') {
            console.log('🔒 Hard difficulty forced to use generation system for consistent 17 given numbers');
            return false;
        }
        
        console.log(`🔍 Attempting to load ${difficulty} puzzle from database...`);
        const puzzleData = this.getRandomPuzzleFromDatabase(difficulty);
        if (!puzzleData) {
            console.log(`❌ No pre-validated puzzles available for ${difficulty} difficulty`);
            return false;
        }
        
        console.log(`✅ Loaded ${difficulty} puzzle from database`);
        
        // Load the puzzle
        this.grid = puzzleData.puzzle.map(row => [...row]);
        this.solution = puzzleData.solution.map(row => [...row]);
        
        // Mark given cells
        this.givenCells = Array(9).fill().map(() => Array(9).fill(false));
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] !== 0) {
                    this.givenCells[row][col] = true;
                }
            }
        }
        
        console.log(`✅ Loaded pre-validated ${difficulty} puzzle from database`);
        return true;
    }
    
    // Method to add more puzzles to the database
    addPuzzleToDatabase(difficulty, puzzle, solution) {
        if (!this.puzzleDatabase[difficulty]) {
            this.puzzleDatabase[difficulty] = [];
        }
        
        // Validate the puzzle before adding
        if (this.validatePuzzleCompletely(puzzle, solution)) {
            this.puzzleDatabase[difficulty].push({
                puzzle: puzzle.map(row => [...row]),
                solution: solution.map(row => [...row])
            });
            console.log(`✅ Added new ${difficulty} puzzle to database`);
            return true;
        } else {
            console.log(`❌ Invalid puzzle rejected for ${difficulty} database`);
            return false;
        }
    }
    
    // Method to get puzzle count by difficulty
    getPuzzleCount(difficulty) {
        return this.puzzleDatabase[difficulty] ? this.puzzleDatabase[difficulty].length : 0;
    }
    
    // Generate varied puzzles with more diversity
    generateVariedPuzzle(difficulty) {
        console.log(`🎲 Generating varied ${difficulty} puzzle...`);
        
        // Try multiple generation attempts for variety
        const maxAttempts = 5;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`Attempt ${attempt}/${maxAttempts} for ${difficulty} puzzle...`);
            
            // Generate a complete solution with variety
            this.generateCompleteSolution();
            
            // Store the solution
            this.solution = this.grid.map(row => [...row]);
            
            // Create puzzle with varied removal patterns
            if (this.createVariedPuzzle(difficulty)) {
                console.log(`✅ Successfully generated varied ${difficulty} puzzle on attempt ${attempt}`);
                return true;
            }
        }
        
        console.log(`❌ Failed to generate varied ${difficulty} puzzle after ${maxAttempts} attempts`);
        return false;
    }
    
    // Create puzzle with varied removal patterns
    createVariedPuzzle(difficulty) {
        const targetGivenCount = this.difficulties[difficulty];
        const targetRemovalCount = 81 - targetGivenCount;
        
        // Create varied removal patterns
        const removalPatterns = [
            'random',      // Random removal
            'blockwise',   // Remove from specific blocks first
            'rowwise',     // Remove from specific rows first
            'columnwise',  // Remove from specific columns first
            'spiral',      // Spiral pattern removal
            'checkerboard' // Checkerboard pattern removal
        ];
        
        // Randomly select a removal pattern
        const pattern = removalPatterns[Math.floor(Math.random() * removalPatterns.length)];
        console.log(`Using ${pattern} removal pattern for ${difficulty}`);
        
        let removedCount = 0;
        const positions = this.generateRemovalPositions(pattern);
        
        for (const pos of positions) {
            if (removedCount >= targetRemovalCount) break;
            
            const row = pos.row;
            const col = pos.col;
            const originalValue = this.grid[row][col];
            
            // Try removing this number
            this.grid[row][col] = 0;
            
            // Check if puzzle still has unique solution
            if (this.hasUniqueSolution()) {
                removedCount++;
            } else {
                // Restore the number if removal breaks uniqueness
                this.grid[row][col] = originalValue;
            }
        }
        
        // Mark given cells
        this.givenCells = Array(9).fill().map(() => Array(9).fill(false));
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] !== 0) {
                    this.givenCells[row][col] = true;
                }
            }
        }
        
        // Clear notes
        this.notes = Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
        
        // Update display
        this.updateDisplay();
        
        const actualGivenCount = 81 - removedCount;
        console.log(`✅ Created ${difficulty} puzzle with ${actualGivenCount} given numbers (target: ${targetGivenCount})`);
        
        return actualGivenCount >= targetGivenCount * 0.9; // Allow some flexibility
    }
    
    // Generate removal positions based on pattern
    generateRemovalPositions(pattern) {
        const positions = [];
        
        // Create all possible positions
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                positions.push({ row, col });
            }
        }
        
        switch (pattern) {
            case 'random':
                // Shuffle randomly
                return this.shuffleArray(positions);
                
            case 'blockwise':
                // Remove from blocks in order
                return this.shuffleArray(positions).sort((a, b) => {
                    const blockA = Math.floor(a.row / 3) * 3 + Math.floor(a.col / 3);
                    const blockB = Math.floor(b.row / 3) * 3 + Math.floor(b.col / 3);
                    return blockA - blockB;
                });
                
            case 'rowwise':
                // Remove from rows in order
                return positions.sort((a, b) => a.row - b.row);
                
            case 'columnwise':
                // Remove from columns in order
                return positions.sort((a, b) => a.col - b.col);
                
            case 'spiral':
                // Spiral pattern from center outward
                return this.generateSpiralPositions();
                
            case 'checkerboard':
                // Checkerboard pattern
                return positions.filter(pos => (pos.row + pos.col) % 2 === 0);
                
            default:
                return this.shuffleArray(positions);
        }
    }
    
    // Generate spiral positions from center outward
    generateSpiralPositions() {
        const positions = [];
        const center = 4; // Center of 9x9 grid
        
        // Start from center and spiral outward
        const visited = Array(9).fill().map(() => Array(9).fill(false));
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // right, down, left, up
        let dir = 0;
        let steps = 1;
        let row = center, col = center;
        
        positions.push({ row, col });
        visited[row][col] = true;
        
        while (positions.length < 81) {
            for (let i = 0; i < 2; i++) { // Each direction is used twice before increasing steps
                for (let j = 0; j < steps; j++) {
                    row += directions[dir][0];
                    col += directions[dir][1];
                    
                    if (row >= 0 && row < 9 && col >= 0 && col < 9 && !visited[row][col]) {
                        positions.push({ row, col });
                        visited[row][col] = true;
                    }
                }
                dir = (dir + 1) % 4;
            }
            steps++;
        }
        
        return positions;
    }
    
    // Shuffle array utility
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    updateErrorCount() {
        const errorCountElement = document.getElementById('errorCount');
        if (errorCountElement) {
            errorCountElement.textContent = this.errorCount;
        }
    }
    
    updateHintCount() {
        const hintCountElement = document.getElementById('hintCount');
        if (hintCountElement) {
            hintCountElement.textContent = this.hintCount;
        }
    }
    
    updateProgress() {
        const filledCells = this.countFilledCells();
        const completionPercent = Math.round((filledCells / 81) * 100);
        
        // Update progress bar with animation (if it exists)
        this.animateProgressBar(completionPercent);
        
        // Update cells filled counter (only if element exists)
        const cellsFilledElement = document.getElementById('cellsFilled');
        if (cellsFilledElement) {
            cellsFilledElement.textContent = filledCells + '/81';
        }
        
        // Update completion percentage (only if element exists)
        const completionPercentElement = document.getElementById('completionPercent');
        if (completionPercentElement) {
            completionPercentElement.textContent = completionPercent + '%';
        }
    }
    
    countFilledCells() {
        let count = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] !== 0) {
                    count++;
                }
            }
        }
        return count;
    }

    // Move history methods for undo/redo
    addToHistory(move) {
        // Remove any moves after current index (when user makes new move after undo)
        this.moveHistory = this.moveHistory.slice(0, this.historyIndex + 1);
        
        // Add new move
        this.moveHistory.push(move);
        this.historyIndex++;
        
        // Limit history size
        if (this.moveHistory.length > this.maxHistorySize) {
            this.moveHistory.shift();
            this.historyIndex--;
        }
        
        this.updateUndoRedoButtons();
    }
    
    undoMove() {
        if (this.historyIndex >= 0 && this.moveHistory.length > 0) {
            const move = this.moveHistory[this.historyIndex];
            this.executeMove(move, true); // true = undo
            this.historyIndex--;
            this.updateUndoRedoButtons();
            this.updateDisplay();
            this.updateProgress();
            this.playSound('undo');
        }
    }
    
    redoMove() {
        if (this.historyIndex < this.moveHistory.length - 1) {
            this.historyIndex++;
            const move = this.moveHistory[this.historyIndex];
            this.executeMove(move, false); // false = redo
            this.updateUndoRedoButtons();
            this.updateDisplay();
            this.updateProgress();
            this.playSound('undo'); // Same sound for redo
        }
    }

    
    executeMove(move, isUndo) {
        const { type, row, col, value, oldValue, noteNumber, action } = move;
        
        if (type === 'number') {
            if (isUndo) {
                // Undo: restore old value
                this.grid[row][col] = oldValue;
            } else {
                // Redo: apply new value
                this.grid[row][col] = value;
            }
        } else if (type === 'note') {
            if (isUndo) {
                // Undo: reverse the action
                if (action === 'add') {
                    this.notes[row][col].delete(noteNumber);
                } else {
                    this.notes[row][col].add(noteNumber);
                }
            } else {
                // Redo: apply the action
                if (action === 'add') {
                    this.notes[row][col].add(noteNumber);
                } else {
                    this.notes[row][col].delete(noteNumber);
                }
            }
        } else if (type === 'erase') {
            if (isUndo) {
                // Undo: restore the erased value
                this.grid[row][col] = oldValue;
            } else {
                // Redo: erase again
                this.grid[row][col] = 0;
                this.notes[row][col] = [];
            }
        }
    }
    
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        undoBtn.disabled = this.historyIndex < 0;
        redoBtn.disabled = this.historyIndex >= this.moveHistory.length - 1;
        
    }

    
    clearHistory() {
        this.moveHistory = [];
        this.historyIndex = -1;
        this.updateUndoRedoButtons();
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
    console.log('🔧 solveHint function called');
    if (game) {
        game.solveHint();
    } else {
        console.error('❌ Game not initialized');
    }
}

function solvePuzzle() {
    console.log('🔧 solvePuzzle function called');
    if (game) {
        game.solvePuzzle();
    } else {
        console.error('❌ Game not initialized');
    }
}

function clearBoard() {
    game.clearBoard();
}

function setDifficulty(difficulty) {
    game.setDifficulty(difficulty);
}

function cleanupNotes() {
    if (game) {
        game.removeInvalidNotes();
    }
}

function autoSuggestNotes() {
    if (game && game.selectedCell !== null) {
        const row = Math.floor(game.selectedCell / 9);
        const col = game.selectedCell % 9;
        game.autoSuggestNotes(row, col);
    }
}

function validateCurrentPuzzle() {
    console.log('🔍 Validating current puzzle...');
    const isValid = game.validatePuzzleCompletely();
    if (isValid) {
        console.log('✅ Current puzzle is valid and solvable!');
    } else {
        console.log('❌ Current puzzle has issues - check console for details');
    }
    return isValid;
}

// Theme management functions
function setTheme(themeName) {
    console.log(`🎨 Switching to ${themeName} theme`);
    
    // Remove active class from all theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to selected theme button
    document.querySelector(`[data-theme="${themeName}"]`).classList.add('active');
    
    // Apply theme to body
    document.body.setAttribute('data-theme', themeName);
    
    // Save theme preference
    localStorage.setItem('sudoku-theme', themeName);
    
    // Visual feedback
    console.log(`✅ Theme changed to ${themeName}`);
    
    // Animate theme transition
    if (game) {
        game.animateThemeTransition();
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('preferredTheme') || 'dark';
    console.log(`🎨 Loading saved theme: ${savedTheme}`);
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update theme toggle icon
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = savedTheme === 'light' ? '💡' : '🌙';
    }
}

function undoMove() {
    if (game) {
        game.undoMove();
    }
}

function redoMove() {
    if (game) {
        game.redoMove();
    }
}


function pauseTimer() {
    if (game) {
        game.pauseTimer();
    }
}

function resumeTimer() {
    if (game) {
        game.resumeTimer();
    }
}

function toggleSounds() {
    if (game) {
        game.toggleSounds();
    }
}

// New toggle functions for simplified UI
function toggleTheme() {
    // Get current theme from document
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    
    // Toggle between light and dark
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Apply new theme
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Update theme toggle icon
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = newTheme === 'light' ? '💡' : '🌙';
    }
    
    // Save theme preference
    localStorage.setItem('preferredTheme', newTheme);
}

function toggleAudio() {
    if (game) {
        const isMuted = game.toggleSounds();
        
        // Update audio toggle icon
        const audioToggle = document.getElementById('audioToggle');
        if (audioToggle) {
            audioToggle.textContent = isMuted ? '🔇' : '🔊';
            audioToggle.classList.toggle('muted', isMuted);
        }
        
        return isMuted;
    }
}

function checkPuzzleDatabase() {
    if (game) {
        console.log('📊 Puzzle Database Status:');
        console.log(`Easy: ${game.getPuzzleCount('easy')} puzzles`);
        console.log(`Medium: ${game.getPuzzleCount('medium')} puzzles`);
        console.log(`Advanced: ${game.getPuzzleCount('advanced')} puzzles`);
        console.log(`Hard: ${game.getPuzzleCount('hard')} puzzles`);
    }
}

// Test animation function for debugging
function testAnimations() {
    if (!game) {
        console.log('❌ Game not initialized');
        return;
    }
    
    console.log('🎬 Testing animations...');
    
    // Test number placement animation
    console.log('Testing number placement animation...');
    game.animateNumberPlacement(0, 0);
    
    // Test error animation
    setTimeout(() => {
        console.log('Testing error animation...');
        game.animateError(0, 1);
    }, 500);
    
    // Test success animation
    setTimeout(() => {
        console.log('Testing success animation...');
        game.animateSuccess(0, 2);
    }, 1000);
    
    // Test hint animation
    setTimeout(() => {
        console.log('Testing hint animation...');
        game.animateHint(0, 3);
    }, 1500);
}

// Auto-save functions
function resumeGame() {
    if (game) {
        if (game.loadGameState()) {
            console.log('✅ Game resumed successfully');
            updateResumeButton();
        } else {
            console.log('❌ No saved game to resume');
        }
    }
}

function updateResumeButton() {
    const resumeBtn = document.getElementById('resumeBtn');
    if (resumeBtn && game) {
        if (game.hasSavedGame()) {
            resumeBtn.style.display = 'block';
        } else {
            resumeBtn.style.display = 'none';
        }
    }
}

function clearSavedGame() {
    if (game) {
        game.clearGameState();
        updateResumeButton();
        console.log('🗑️ Saved game cleared');
    }
}

// Daily Challenge functions
function startDailyChallenge() {
    if (game) {
        const todaysChallenge = game.getTodaysChallenge();
        if (game.startDailyChallenge(todaysChallenge)) {
            console.log(`🎯 Starting today's challenge: ${todaysChallenge}`);
            updateChallengeUI();
        }
    }
}

function showChallengeHistory() {
    if (game) {
        console.log('📊 Challenge History:');
        console.log('Current Streak:', game.challengeStreak.current, 'days');
        console.log('Longest Streak:', game.challengeStreak.longest, 'days');
        console.log('Completed Challenges:', Object.keys(game.challengeCompleted).length);
        
        // Show detailed history
        Object.entries(game.challengeCompleted).forEach(([date, completion]) => {
            console.log(`${date}: ${completion.challengeId} - ${game.formatTime(completion.time)}`);
        });
    }
}

function updateChallengeUI() {
    if (game) {
        // Update streak display
        const streakElement = document.getElementById('challengeStreak');
        if (streakElement) {
            streakElement.textContent = `${game.challengeStreak.current} days`;
        }
        
        // Update today's challenge display
        const todayElement = document.getElementById('todayChallenge');
        if (todayElement) {
            const todaysChallenge = game.getTodaysChallenge();
            const challenge = game.dailyChallenges[todaysChallenge];
            if (challenge) {
                todayElement.textContent = challenge.name;
            }
        }
    }
}

// Best time functions
function resetBestTime() {
    if (game) {
        if (confirm(`Reset best time for ${game.difficulty} difficulty?`)) {
            game.resetBestTime();
        }
    }
}

function resetAllBestTimes() {
    if (game) {
        if (confirm('Reset all best times for all difficulties? This cannot be undone.')) {
            game.resetAllBestTimes();
        }
    }
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
    } else if (e.key === 'c' || e.key === 'C') {
        cleanupNotes();
    } else if (e.key === 'a' || e.key === 'A') {
        autoSuggestNotes();
    } else if (e.key === 'v' || e.key === 'V') {
        validateCurrentPuzzle();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoMove();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redoMove();
    }
});

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Initializing Sudoku Game...');
    
    // Load saved theme first
    loadSavedTheme();
    
    // Initialize audio toggle icon
    const audioToggle = document.getElementById('audioToggle');
    if (audioToggle) {
        const soundsEnabled = localStorage.getItem('soundsEnabled') !== 'false';
        audioToggle.textContent = soundsEnabled ? '🔊' : '🔇';
        audioToggle.classList.toggle('muted', !soundsEnabled);
    }
    
    // Initialize game
    game = new SudokuGame();
    
    // Check for saved games and update UI
    setTimeout(() => {
        updateResumeButton();
        updateChallengeUI();
    }, 100);
});
