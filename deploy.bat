@echo off
echo Setting up Git repository for Sudoku game...

REM Initialize git repository
git init

REM Add all files
git add .

REM Create initial commit
git commit -m "Initial Sudoku game with multiple themes and touch support"

REM Set main branch
git branch -M main

echo.
echo Repository initialized successfully!
echo.
echo Next steps:
echo 1. Create a new repository on GitHub.com
echo 2. Copy the repository URL (e.g., https://github.com/username/sudoku-game.git)
echo 3. Run: git remote add origin YOUR_REPOSITORY_URL
echo 4. Run: git push -u origin main
echo 5. Enable GitHub Pages in repository settings
echo.
echo Your game will be live at: https://YOUR_USERNAME.github.io/REPOSITORY_NAME/
echo.
pause
