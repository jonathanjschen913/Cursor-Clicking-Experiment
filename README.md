# CSC428/CSC2514 Assignment 2: Cursor Selection Experiment

A controlled experiment comparing three cursor selection techniques — **Point**, **Bubble**, and **Area** cursors — built with D3.js as a browser-based experiment framework.

## What This Is

This is a within-subjects full factorial experiment with 3 independent variables:

| IV | Levels |
|----|--------|
| **Technique** | Point Cursor, Bubble Cursor, Area Cursor |
| **Target Size** (radius) | 10px, 20px, 30px |
| **Distance** (% of canvas diagonal) | 10%, 25%, 40% |

3 x 3 x 3 = 27 conditions, 15 trials each = **405 trials per participant** (~20-30 minutes).

Dependent variables logged: selection time, error, error distance, velocity reversals, and direction changes.

## How to Run the Experiment

### Option A: GitHub Pages (recommended for participants)

Visit the hosted version:
**https://jonathanjschen913.github.io/CSC428-A2-cursor-experiment-/code5.html**

### Option B: Local

Open `code5.html` in a modern browser (Chrome recommended). No build step or server required.

### Running a Participant

1. Open the experiment link. You will be prompted for a **participant number** (1, 2, or 3). This controls the Latin square counterbalancing of technique order.

2. **Practice phase**: Before each new cursor technique, a description screen explains how the cursor works. Click to enter free practice mode where you can try clicking targets. Press **Space** when you feel comfortable to begin the real trials.

3. **Trials**: A highlighted target (salmon/pink) appears among white distractor targets. Select the highlighted target using the current cursor technique. Every click counts — errors are logged, not retried.
   - **Green flash** = correct selection
   - **Red flash** = error (wrong target or miss)

4. **Breaks**: Short breaks appear between each condition block (every 15 trials). Click to continue. The progress bar shows overall progress during breaks.

5. **Completion**: After all 405 trials, a CSV file automatically downloads to your computer.

### Cursor Techniques

- **Point Cursor**: Standard cursor. You must click directly inside a target.
- **Bubble Cursor**: The cursor automatically expands to reach the nearest target. Move toward a target and the bubble snaps to it.
- **Area Cursor**: A large gray circle. If exactly one target is within the circle, it is selected. If multiple targets overlap, you must click directly inside one.

## Experiment Setup Guidelines

- Use a desktop/laptop with a mouse (not trackpad)
- Use Chrome in fullscreen (F11) for consistent canvas size
- Run in a quiet environment with minimal distractions
- Use the same setup (hardware, display, location) across all participants
- Obtain verbal consent before starting

## Output

A CSV file is saved at the end: `P{number}_experiment_data.csv`

Columns:
```
participant, technique, targetSize, distance, distanceProportion,
trial, block, time, error, errorDistance, velocityReversals, directionChanges
```

## Files

| File | Description |
|------|-------------|
| `code5.html` | Entry point — loads D3.js and app |
| `app.js` | All experiment logic |
| `DESIGN.md` | Detailed experimental design document |
| `assignment.txt` | Original assignment specification |
