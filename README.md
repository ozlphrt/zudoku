# Zudoku

A modern, interactive Sudoku game with multiple themes and full touch support. **Completely standalone** - no dependencies, no installation required!

🚀 **Live Demo**: [Play Now](https://ozlphrt.github.io/zudoku/)

## Features

- 🎮 **Logic-Rated Difficulty**: Easy, Medium, Hard, Expert, and Master labels based on required solving techniques
- 🎨 **Multiple Themes**: Glassmorphism, Minimal, Dark
- 📱 **Touch Support**: Works on mobile devices with touch controls
- 🎯 **Smart Hints**: Educational hints that teach solving strategies
- ✏️ **Note Mode**: Take notes in cells for complex puzzles
- 🎨 **Paint Mode**: Click numbers to paint them into empty cells

## How to Play

1. **Click or touch** a number
2. **Left-click or tap** empty cell to place
3. **Right-click or hold** empty cell for notes

## Live Demo

Play the game online: [https://ozlphrt.github.io/zudoku/](https://ozlphrt.github.io/zudoku/)

## Themes

- **Main Theme**: Glassmorphism design with blue accents
- **Minimal Theme**: Clean, minimal interface
- **Dark Theme**: Dark mode with neon highlights

## Installation

**No installation required!** This is a completely standalone game that works directly in your browser:

1. **Online**: Visit the [live demo](https://ozlphrt.github.io/zudoku/)
2. **Offline**: Simply download and open `index.html` in any modern web browser
3. **Local server**: Run `python -m http.server 8000` and visit `http://localhost:8000`

No dependencies, no build process, no installation needed!

## Difficulty and puzzle validation

The dial selects Easy, Medium, Hard, Expert, or Master. Each tier is validated against the hardest logical technique required by the solver using Sudoku Explainer-compatible technique weights. Starting clue counts remain an internal generation detail. AUTO progression requires three completions before advancing to the next named difficulty and remains on Master after the highest tier is reached.

Master uses a bundled catalog of 100 public-domain puzzles from the [Sudoku Exchange puzzle bank](https://github.com/grantm/sudoku-exchange-puzzle-bank). Every Master puzzle has a Sukaku Explainer rating of 6.2 or higher, where solving requires advanced chains or similarly demanding logic. The bundled solutions are independently checked for consistency and uniqueness by the local validation command.

Master progresses internally after every three completions while the visible dial continues to say `MASTER`: Master I uses SE 6.2–6.9, Master II uses 7.0–7.6, Master III uses 7.7–8.3, and Master IV uses 8.4–9.3. After Master IV, each additional three-puzzle streak remains in the highest band.

The active 17–21 clue master banks are checked for valid givens, a valid stored solution, and exactly one solution. Generated puzzles also pass the same exact uniqueness requirement before play. To repeat the full bank audit, run:

```bash
npm run validate:puzzles
```

## Files

- `index.html` - Main game (Glassmorphism theme)
- `sudoku-minimal.html` - Minimal theme
- `sudoku-dark.html` - Dark theme
- `script.js` - Game logic and functionality

## Technologies Used

- HTML5
- CSS3 (Flexbox, Grid, Animations)
- Vanilla JavaScript
- Touch Events API
- CSS Custom Properties
