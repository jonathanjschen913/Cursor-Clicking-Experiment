# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CSC428/CSC2514h Assignment 2: A controlled experiment comparing three cursor selection techniques (Point, Bubble, Area cursors). Built with D3.js v3 as a browser-based experiment framework.

## Running

Open `code5.html` in a browser. The app prompts for participant number and technique (1=Bubble, 2=Point, 3=Area). No build step required.

## Architecture

Single-page app: `code5.html` loads D3.js v3 and `app.js`.

**app.js** contains all experiment logic:
- **Cursor techniques**: `getTargetCapturedByBubbleCursor()`, `getTargetCapturedByPointCursor()`, `getTargetCapturedByAreaCursor()` — each computes which target is selected and renders cursor visuals
- **Experiment flow**: Block/trial state machine driven by click handler on SVG. States: rest-before-block → study-running → block-complete (repeat) → study-complete
- **Data logging**: Tab-separated trial data (`participant`, `trial`, `technique`, `time`) accumulated in `trialFileContent` string, saved via FileSaver.js on completion
- **Target generation**: `initTargets()` places non-overlapping circles with random position/radius

## Key Experiment Parameters (top of app.js)

- `numTargets` — set to 0 initially, becomes 40 when a block starts
- `totalBlock`, `totalTrials` — control experiment length
- `minRadius`, `maxRadius`, `minSep` — target sizing/spacing
- `areaRadius` — fixed radius for the Area cursor (default 50)

## Assignment Requirements

The assignment requires a within-subjects full factorial design with 3 IVs (technique + 2 others, 3 levels each = 27 conditions), ~30 min experiment, 3 participants. The starter code must be modified to implement the full experimental design, automate condition presentation, and log dependent variables.
