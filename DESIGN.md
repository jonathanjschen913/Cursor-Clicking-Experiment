# Experiment Design Document

## Overview
Controlled experiment comparing three cursor selection techniques: Point, Bubble, and Area cursors. Within-subjects full factorial design.

## Independent Variables (3 × 3 × 3 = 27 conditions)

### 1. Technique (3 levels)
- **Point Cursor**: Standard cursor defined by a single 2D point
- **Bubble Cursor**: Dynamically sized area cursor that always selects exactly one target
- **Area Cursor**: Fixed-size circular cursor that selects any intersected target; disambiguates via center point if multiple targets overlap

### 2. Target Size — radius in px (3 levels, configurable)
- Small: 10 px
- Medium: 20 px
- Large: 30 px

### 3. Distance to Target — proportional to canvas diagonal (3 levels, configurable)
- Near: 10% of canvas diagonal
- Medium: 25% of canvas diagonal
- Far: 40% of canvas diagonal

Distance is measured as Euclidean distance from the previous click location to the center of the next highlighted target. Actual pixel values depend on canvas/display size and will be reported for the specific hardware used.

## Dependent Variables

1. **Selection time** (ms): Time from trial start (target highlight) to the participant's click. Every click (correct or error) ends the trial.
2. **Error** (binary): Whether the participant clicked the wrong target (1) or correct target (0)
3. **Error distance** (px): On errors, Euclidean distance from click point to nearest edge of the intended target. 0 on correct selections.
4. **Velocity reversals** (count): Number of times mouse speed drops below a threshold then increases during the trial — indicates corrective submovements
5. **Direction changes** (count): Number of significant changes in movement direction (angle exceeding threshold) in the trajectory — indicates corrective adjustments

Submovements (velocity reversals and direction changes) are computed in real-time in the browser during each trial. Only the final counts are logged.

## Experiment Structure

### Trials
- **15 trials per condition**
- 27 conditions × 15 trials = **405 trials per participant**
- Target experiment duration: ~20-30 minutes

### Blocking and Ordering
- **Technique order (IV1)**: Counterbalanced across 3 participants using a **Latin square**
  - P1: Bubble → Point → Area
  - P2: Point → Area → Bubble
  - P3: Area → Bubble → Point
- **Size × Distance combinations (IV2 × IV3)**: All 9 combinations are **randomized** within each technique block
- Within each condition: 15 consecutive trials

### Practice
- Before each technique, participants see a description of the cursor's look and feel
- Free practice mode: participants click targets until comfortable, then press Space to begin real trials
- Practice data is not logged

### Rest Breaks
- Between technique blocks (when switching techniques), preceded by practice for the new technique
- Between each condition (every 15 trials) within a technique block
- Participant clicks to continue after each break
- Progress bar shows per-condition progress during trials and overall progress during breaks

## Target Presentation

- Multiple targets (distractors + 1 highlighted target) displayed simultaneously
- **Distractor count**: Auto-calculated based on target size to maintain consistent canvas coverage (density ~12%) across size levels
- Targets are regenerated when target size or technique changes; they persist across trials within the same condition
- Next highlighted target is chosen as the existing target closest to the specified distance from the last click location

## Frontend Display

- **Dynamic fullscreen canvas**: Auto-sizes to browser window; resizes are deferred to the next rest break if mid-trial
- **Progress bar**: Shows per-condition progress (blue) during trials and overall progress (green) during rest breaks
- **Trial/block info**: Current technique, size level, trial number displayed during trials
- **Feedback**: Green/red border flash (300ms) after each click indicating correct/incorrect selection

## Data Output

- **CSV file**: One row per trial with all IVs and DVs
- Columns: `participant, technique, targetSize, distance, distanceProportion, trial, block, time, error, errorDistance, velocityReversals, directionChanges`
- File saved via FileSaver.js on experiment completion
- Filename format: `P{participant}_experiment_data.csv`

## Participants
- 3 participants (within-subjects, all do all conditions)
- Verbal consent obtained before participation

## Hardware
- 16" Legion Pro 5i Gen 10 Intel, RTX 5070 Ti
- 144Hz display
- Chrome browser
- Mouse input
