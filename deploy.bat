@echo off
echo ========================================
echo  Zudoku - Standalone Sudoku Game Setup
echo ========================================
echo.

REM Initialize git repository
echo Initializing Git repository...
git init

REM Add all files except node_modules
echo Adding files to repository...
git add .
git reset HEAD node_modules/

REM Create initial commit
echo Creating initial commit...
git commit -m "Initial Zudoku release - standalone Sudoku game with glassmorphism design

Features:
- Completely standalone (no dependencies)
- Multiple themes (Glassmorphism, Light, Dark)
- Touch support for mobile devices
- Smart note management
- Undo/Redo functionality
- Timer and best times tracking
- Daily challenges
- Auto-save functionality
- Modern audio effects
- Responsive design"

REM Set main branch
git branch -M main

echo.
echo ========================================
echo  Repository initialized successfully!
echo ========================================
echo.
echo NEXT STEPS TO PUBLISH:
echo.
echo 1. Create a new repository on GitHub.com:
echo    - Go to https://github.com/new
echo    - Repository name: zudoku
echo    - Description: A beautiful standalone Sudoku game with glassmorphism design
echo    - Make it PUBLIC
echo    - DON'T initialize with README (we already have one)
echo.
echo 2. Connect your local repository:
echo    git remote add origin https://github.com/YOUR_USERNAME/zudoku.git
echo.
echo 3. Push to GitHub:
echo    git push -u origin main
echo.
echo 4. Enable GitHub Pages:
echo    - Go to repository Settings ^> Pages
echo    - Source: Deploy from a branch
echo    - Branch: main / (root)
echo    - Click Save
echo.
echo 5. Your game will be live at:
echo    https://YOUR_USERNAME.github.io/zudoku/
echo.
echo STANDALONE FEATURES:
echo - No dependencies required
echo - Works offline by opening index.html
echo - No build process needed
echo - Pure HTML/CSS/JavaScript
echo.
pause
