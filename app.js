// ============================================================
// CSC428/CSC2514 Assignment 2 — Full Factorial Experiment
// 3 IVs: Technique (Bubble/Point/Area) × Size (S/M/L) × Distance (Near/Mid/Far)
// ============================================================

// ---- Configuration ----
var TECHNIQUES = ["BUBBLE", "POINT", "AREA"];
var SIZE_LEVELS = [10, 20, 30];           // target radii (small, medium, large)
var DISTANCE_PROPORTIONS = [0.10, 0.25, 0.40]; // proportion of canvas diagonal
var TRIALS_PER_CONDITION = 15;
var AREA_CURSOR_RADIUS = 50;
var TARGET_DENSITY = 0.12;                // fraction of canvas covered by targets
var MIN_SEP = 20;                         // min gap between targets
var PRACTICE_TARGET_SIZE = 20;            // medium size for practice

// Submovement detection
var SPEED_THRESHOLD_RATIO = 0.15;         // dip below this × peak → reversal
var DIRECTION_CHANGE_ANGLE = 45;          // degrees
var TRAJECTORY_SAMPLE_INTERVAL = 8;       // ms (~120 Hz)

// Latin square for technique order only (rows = participant mod 3)
var TECHNIQUE_LATIN_SQUARE = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1]
];

// Technique descriptions for practice screen
var TECHNIQUE_DESCRIPTIONS = {
  BUBBLE: "BUBBLE CURSOR: The cursor automatically expands to reach the nearest target. " +
          "Just move toward a target — the bubble will snap to it. Click to select the highlighted target.",
  POINT:  "POINT CURSOR: A standard cursor. You must click directly inside a target to select it.",
  AREA:   "AREA CURSOR: The cursor has a large circular activation area. " +
          "If exactly one target is within the gray circle, it is selected. " +
          "If multiple targets overlap the circle, you must click directly inside one."
};

// ---- States ----
var STATE_REST = "REST";
var STATE_TRIAL_ACTIVE = "TRIAL_ACTIVE";
var STATE_PRACTICE = "PRACTICE";
var STATE_PRACTICE_ACTIVE = "PRACTICE_ACTIVE";
var STATE_STUDY_COMPLETE = "STUDY_COMPLETE";

// ---- Canvas ----
var w = window.innerWidth;
var h = window.innerHeight;
var canvasDiagonal = Math.sqrt(w * w + h * h);
var pendingResize = false;

// ---- Participant ----
var participant = prompt("Please enter the participant number (1-3):", "1");
participant = parseInt(participant) || 1;

// ---- Experiment state ----
var conditionSequence = [];   // array of trial descriptor objects
var conditionIndex = 0;       // index into conditionSequence
var currentState = STATE_REST;
var currentTechnique = "POINT";
var currentTargetSize = 20;
var targets = [];
var clickTarget = -1;
var lastClickPos = [w / 2, h / 2];
var trialStartTime = 0;
var trajectoryPoints = [];
var lastTrajectorySampleTime = 0;
var practicedTechniques = {};  // tracks which techniques have been practiced
var nextTechniqueNeedsPractice = true;

// CSV output
var csvContent = "participant,technique,targetSize,distance,distanceProportion,trial,block,time,error,errorDistance,velocityReversals,directionChanges\n";

// ---- Build condition sequence ----
// Latin square for technique (IV1) only; IV2 × IV3 randomized within each technique block
function getExperimentOrder(pNum) {
  var idx = (pNum - 1) % 3;
  return {
    techniqueOrder: TECHNIQUE_LATIN_SQUARE[idx].slice()
  };
}

function buildConditionSequence(pNum) {
  var order = getExperimentOrder(pNum);
  var seq = [];
  var blockNum = 0;

  for (var ti = 0; ti < 3; ti++) {
    var techIdx = order.techniqueOrder[ti];
    var technique = TECHNIQUES[techIdx];

    // Build all 9 size×distance combinations
    var combos = [];
    for (var si = 0; si < SIZE_LEVELS.length; si++) {
      for (var di = 0; di < DISTANCE_PROPORTIONS.length; di++) {
        combos.push({
          targetSize: SIZE_LEVELS[si],
          distanceProportion: DISTANCE_PROPORTIONS[di]
        });
      }
    }
    // Shuffle the 9 combos
    shuffleArray(combos);

    blockNum++;

    // For each combo, run TRIALS_PER_CONDITION trials
    for (var ci = 0; ci < combos.length; ci++) {
      for (var t = 0; t < TRIALS_PER_CONDITION; t++) {
        seq.push({
          technique: technique,
          targetSize: combos[ci].targetSize,
          distanceProportion: combos[ci].distanceProportion,
          trialIndex: t,
          blockLabel: blockNum,
          techniqueIndex: ti,
          comboIndex: ci
        });
      }
    }
  }
  return seq;  // 3 techniques × 9 combos × 15 trials = 405 trials
}

function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

conditionSequence = buildConditionSequence(participant);

// ---- SVG setup ----
var svg = d3.select("#bubbleCursor").append("svg:svg")
  .attr("width", w)
  .attr("height", h);

// Background
svg.append("rect")
  .attr("class", "backgroundRect")
  .attr("width", w)
  .attr("height", h)
  .attr("fill", "white")
  .attr("stroke", "black");

// Feedback border (flashes green/red)
var feedbackRect = svg.append("rect")
  .attr("class", "feedbackRect")
  .attr("width", w)
  .attr("height", h)
  .attr("fill", "none")
  .attr("stroke", "none")
  .attr("stroke-width", 6)
  .style("pointer-events", "none");

// Progress bar
var PROGRESS_BAR_HEIGHT = 6;
svg.append("rect")
  .attr("class", "progressBg")
  .attr("x", 0).attr("y", 0)
  .attr("width", w).attr("height", PROGRESS_BAR_HEIGHT)
  .attr("fill", "#ddd");

var progressFill = svg.append("rect")
  .attr("class", "progressFill")
  .attr("x", 0).attr("y", 0)
  .attr("width", 0).attr("height", PROGRESS_BAR_HEIGHT)
  .attr("fill", "#4CAF50");

// Progress label (right-aligned, shows what the bar means)
svg.append("text").attr("class", "progressLabel")
  .attr("x", w - 10).attr("y", PROGRESS_BAR_HEIGHT + 14)
  .attr("text-anchor", "end")
  .attr("font-size", "11px")
  .attr("font-family", "Arial, sans-serif")
  .attr("fill", "#999");

// Cursor circles (behind targets)
svg.append("circle")
  .attr("class", "cursorCircle")
  .attr("cx", 0).attr("cy", 0).attr("r", 0)
  .attr("fill", "lightgray")
  .attr("opacity", 0.3)
  .attr("stroke", "gray")
  .attr("stroke-width", 1);

svg.append("circle")
  .attr("class", "cursorMorphCircle")
  .attr("cx", 0).attr("cy", 0).attr("r", 0)
  .attr("fill", "none")
  .attr("stroke", "gray")
  .attr("stroke-width", 2)
  .attr("stroke-dasharray", "4,4");

// Status text
svg.append("text").attr("class", "studyStatusText1")
  .attr("x", w / 2).attr("y", h / 2 - 60)
  .attr("text-anchor", "middle")
  .attr("font-size", "24px")
  .attr("font-family", "Arial, sans-serif");

svg.append("text").attr("class", "studyStatusText2")
  .attr("x", w / 2).attr("y", h / 2 - 20)
  .attr("text-anchor", "middle")
  .attr("font-size", "16px")
  .attr("font-family", "Arial, sans-serif")
  .attr("fill", "#333");

svg.append("text").attr("class", "studyStatusText3")
  .attr("x", w / 2).attr("y", h / 2 + 20)
  .attr("text-anchor", "middle")
  .attr("font-size", "18px")
  .attr("font-family", "Arial, sans-serif");

svg.append("text").attr("class", "studyStatusText4")
  .attr("x", w / 2).attr("y", h / 2 + 50)
  .attr("text-anchor", "middle")
  .attr("font-size", "14px")
  .attr("font-family", "Arial, sans-serif")
  .attr("fill", "#666");

// Info text (top-left, below progress bar)
svg.append("text").attr("class", "infoText")
  .attr("x", 10).attr("y", 24)
  .attr("font-size", "12px")
  .attr("font-family", "Arial, sans-serif")
  .attr("fill", "#999");

// ---- Utility ----
function distance(ptA, ptB) {
  var dx = ptB[0] - ptA[0];
  var dy = ptB[1] - ptA[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// ---- Target management ----
function calculateNumTargets(targetRadius) {
  var canvasArea = w * h;
  var targetArea = Math.PI * targetRadius * targetRadius;
  var count = Math.floor(TARGET_DENSITY * canvasArea / targetArea);
  return Math.max(10, Math.min(count, 200));
}

function initTargets(numTargets, targetRadius, minSep) {
  var margin = targetRadius + 10;
  var minX = margin, maxX = w - margin, xRange = maxX - minX;
  var minY = margin + PROGRESS_BAR_HEIGHT, maxY = h - margin, yRange = maxY - minY;

  var targets = [];
  var maxAttempts = numTargets * 200;
  var attempts = 0;

  for (var i = 0; i < numTargets && attempts < maxAttempts; i++) {
    var placed = false;
    while (!placed && attempts < maxAttempts) {
      attempts++;
      var pt = [Math.random() * xRange + minX, Math.random() * yRange + minY];

      var collision = false;
      for (var j = 0; j < targets.length; j++) {
        if (distance(pt, targets[j][0]) < targetRadius * 2 + minSep) {
          collision = true;
          break;
        }
      }
      if (!collision) {
        targets.push([pt, targetRadius]);
        placed = true;
      }
    }
  }
  return targets;
}

function selectTargetAtDistance(targets, fromPos, desiredDistance) {
  var bestIdx = 0;
  var bestDiff = Infinity;
  for (var i = 0; i < targets.length; i++) {
    var d = Math.abs(distance(fromPos, targets[i][0]) - desiredDistance);
    if (d < bestDiff) {
      bestDiff = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ---- Draw targets helper ----
function drawTargets() {
  svg.selectAll(".targetCircles").remove();
  svg.selectAll("targetCircles")
    .data(targets)
    .enter()
    .append("circle")
    .attr("class", "targetCircles")
    .attr("cx", function (d) { return d[0][0]; })
    .attr("cy", function (d) { return d[0][1]; })
    .attr("r", function (d) { return d[1] - 1; })
    .attr("stroke-width", 2)
    .attr("stroke", "limegreen")
    .attr("fill", "white");
}

// ---- Cursor techniques ----
function getTargetCapturedByBubbleCursor(mouse, targets) {
  if (currentState !== STATE_TRIAL_ACTIVE && currentState !== STATE_PRACTICE_ACTIVE) {
    svg.select(".cursorCircle").attr("cx", mouse[0]).attr("cy", mouse[1]).attr("r", 0);
    svg.select(".cursorMorphCircle").attr("cx", 0).attr("cy", 0).attr("r", 0);
    return -1;
  }

  var mousePt = [mouse[0], mouse[1]];
  var numT = targets.length;
  var dists = [], containDists = [], intersectDists = [];
  var currMinIdx = 0;

  for (var idx = 0; idx < numT; idx++) {
    var targetPt = targets[idx][0];
    var currDist = distance(mousePt, targetPt);
    var tRadius = targets[idx][1];
    dists.push(currDist);
    containDists.push(currDist + tRadius);
    intersectDists.push(currDist - tRadius);
    if (intersectDists[idx] < intersectDists[currMinIdx]) {
      currMinIdx = idx;
    }
  }

  var secondMinIdx = (currMinIdx + 1) % numT;
  for (var idx = 0; idx < numT; idx++) {
    if (idx !== currMinIdx && intersectDists[idx] < intersectDists[secondMinIdx]) {
      secondMinIdx = idx;
    }
  }

  var cursorRadius = Math.min(containDists[currMinIdx], intersectDists[secondMinIdx]);
  svg.select(".cursorCircle")
    .attr("cx", mouse[0]).attr("cy", mouse[1]).attr("r", cursorRadius)
    .attr("fill", "lightgray");

  if (cursorRadius < containDists[currMinIdx]) {
    svg.select(".cursorMorphCircle")
      .attr("cx", targets[currMinIdx][0][0])
      .attr("cy", targets[currMinIdx][0][1])
      .attr("r", targets[currMinIdx][1] + 5);
  } else {
    svg.select(".cursorMorphCircle").attr("cx", 0).attr("cy", 0).attr("r", 0);
  }
  return currMinIdx;
}

function getTargetCapturedByPointCursor(mouse, targets) {
  var mousePt = [mouse[0], mouse[1]];
  var capturedIdx = -1;
  for (var idx = 0; idx < targets.length; idx++) {
    var currDist = distance(mousePt, targets[idx][0]);
    if (currDist <= targets[idx][1]) {
      capturedIdx = idx;
    }
  }
  svg.select(".cursorCircle").attr("cx", mouse[0]).attr("cy", mouse[1]).attr("r", 0);
  svg.select(".cursorMorphCircle").attr("cx", 0).attr("cy", 0).attr("r", 0);
  return capturedIdx;
}

function getTargetCapturedByAreaCursor(mouse, targets) {
  var mousePt = [mouse[0], mouse[1]];
  var capturedAreaIdx = -1;
  var capturedPointIdx = -1;
  var numCaptured = 0;

  for (var idx = 0; idx < targets.length; idx++) {
    var currDist = distance(mousePt, targets[idx][0]);
    var tRadius = targets[idx][1];
    if (currDist <= tRadius + AREA_CURSOR_RADIUS) {
      capturedAreaIdx = idx;
      numCaptured++;
    }
    if (currDist <= tRadius) {
      capturedPointIdx = idx;
    }
  }

  var capturedIdx = -1;
  if (capturedPointIdx > -1) capturedIdx = capturedPointIdx;
  else if (numCaptured === 1) capturedIdx = capturedAreaIdx;

  var isActive = (currentState === STATE_TRIAL_ACTIVE || currentState === STATE_PRACTICE_ACTIVE);
  var rad = isActive ? AREA_CURSOR_RADIUS : 0;
  svg.select(".cursorCircle")
    .attr("cx", mouse[0]).attr("cy", mouse[1]).attr("r", rad)
    .attr("fill", "lightgray");
  svg.select(".cursorMorphCircle").attr("cx", 0).attr("cy", 0).attr("r", 0);

  return capturedIdx;
}

function getCapturedTarget(mouse, targets) {
  if (currentTechnique === "BUBBLE") return getTargetCapturedByBubbleCursor(mouse, targets);
  if (currentTechnique === "POINT") return getTargetCapturedByPointCursor(mouse, targets);
  if (currentTechnique === "AREA") return getTargetCapturedByAreaCursor(mouse, targets);
  return -1;
}

// ---- Target fill ----
function updateTargetsFill(currentCapturedTarget, clickTarget) {
  svg.selectAll(".targetCircles").attr("fill", function (d, i) {
    if (i === clickTarget && i === currentCapturedTarget) return "darkred";
    if (i === clickTarget) return "lightsalmon";
    if (i === currentCapturedTarget) return "limegreen";
    return "white";
  });
}

// ---- Trajectory & submovement analysis ----
function countVelocityReversals(traj) {
  if (traj.length < 3) return 0;

  var speeds = [];
  for (var i = 1; i < traj.length; i++) {
    var dx = traj[i].x - traj[i - 1].x;
    var dy = traj[i].y - traj[i - 1].y;
    var dt = traj[i].t - traj[i - 1].t;
    if (dt <= 0) dt = 1;
    speeds.push(Math.sqrt(dx * dx + dy * dy) / dt);
  }

  // 3-point smoothing
  var smoothed = [];
  for (var i = 0; i < speeds.length; i++) {
    if (i === 0 || i === speeds.length - 1) {
      smoothed.push(speeds[i]);
    } else {
      smoothed.push((speeds[i - 1] + speeds[i] + speeds[i + 1]) / 3);
    }
  }

  var peakSpeed = 0;
  for (var i = 0; i < smoothed.length; i++) {
    if (smoothed[i] > peakSpeed) peakSpeed = smoothed[i];
  }
  if (peakSpeed === 0) return 0;

  var threshold = SPEED_THRESHOLD_RATIO * peakSpeed;
  var reversals = 0;
  var belowThreshold = false;
  for (var i = 0; i < smoothed.length; i++) {
    if (smoothed[i] < threshold) {
      if (!belowThreshold) {
        reversals++;
        belowThreshold = true;
      }
    } else {
      belowThreshold = false;
    }
  }
  return reversals;
}

function countDirectionChanges(traj) {
  if (traj.length < 3) return 0;

  var angles = [];
  for (var i = 1; i < traj.length; i++) {
    var dx = traj[i].x - traj[i - 1].x;
    var dy = traj[i].y - traj[i - 1].y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) continue;  // filter micro-movements
    angles.push(Math.atan2(dy, dx));
  }

  var changes = 0;
  var threshRad = DIRECTION_CHANGE_ANGLE * Math.PI / 180;
  for (var i = 1; i < angles.length; i++) {
    var diff = Math.abs(angles[i] - angles[i - 1]);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > threshRad) changes++;
  }
  return changes;
}

// ---- Status text ----
function setStatusText(text1, text2, text3, text4) {
  svg.select(".studyStatusText1").text(text1 || "");
  svg.select(".studyStatusText2").text(text2 || "");
  svg.select(".studyStatusText3").text(text3 || "");
  svg.select(".studyStatusText4").text(text4 || "");
}

// Find the start index of the current condition (same technique + comboIndex)
function getConditionRange(idx) {
  if (idx >= conditionSequence.length) idx = conditionSequence.length - 1;
  if (idx < 0) return { start: 0, end: 0 };
  var cond = conditionSequence[idx];
  var start = idx, end = idx;
  while (start > 0 &&
    conditionSequence[start - 1].technique === cond.technique &&
    conditionSequence[start - 1].comboIndex === cond.comboIndex) {
    start--;
  }
  while (end < conditionSequence.length - 1 &&
    conditionSequence[end + 1].technique === cond.technique &&
    conditionSequence[end + 1].comboIndex === cond.comboIndex) {
    end++;
  }
  return { start: start, end: end + 1 }; // end is exclusive
}

function updateProgressBar(showOverall) {
  if (showOverall) {
    // Overall progress (shown during rest breaks)
    var progress = conditionIndex / conditionSequence.length;
    progressFill.attr("width", progress * w).attr("fill", "#4CAF50");
    svg.select(".progressLabel").text("Overall: " + conditionIndex + " / " + conditionSequence.length);
  } else {
    // Per-condition progress (shown during active trials)
    var range = getConditionRange(conditionIndex);
    var condTrialsDone = conditionIndex - range.start;
    var condTrialsTotal = range.end - range.start;
    var progress = condTrialsDone / condTrialsTotal;
    progressFill.attr("width", progress * w).attr("fill", "#2196F3");
    svg.select(".progressLabel").text("Condition: " + condTrialsDone + " / " + condTrialsTotal);
  }
}

function updateInfoText() {
  if (currentState === STATE_TRIAL_ACTIVE && conditionIndex < conditionSequence.length) {
    var cond = conditionSequence[conditionIndex];
    var text = "Technique: " + cond.technique +
      "  |  Size: " + cond.targetSize +
      "  |  Trial " + (conditionIndex + 1) + " / " + conditionSequence.length;
    svg.select(".infoText").text(text);
  } else if (currentState === STATE_PRACTICE_ACTIVE) {
    svg.select(".infoText").text("PRACTICE — " + currentTechnique + " cursor (click targets to practice, press Space when ready)");
  } else {
    svg.select(".infoText").text("");
  }
}

// ---- Feedback flash ----
function flashFeedback(isCorrect) {
  var color = isCorrect ? "#4CAF50" : "#f44336";
  feedbackRect
    .attr("stroke", color)
    .attr("stroke-width", 6)
    .transition()
    .duration(300)
    .attr("stroke-width", 0);
}

// ---- Check if breaks are needed ----
function needsTechniqueBreak(prevIndex, nextIndex) {
  if (nextIndex >= conditionSequence.length) return false;
  var prev = conditionSequence[prevIndex];
  var next = conditionSequence[nextIndex];
  return prev.technique !== next.technique;
}

// Per-condition break: triggers when size or distance changes (i.e., new combo)
function needsConditionBreak(prevIndex, nextIndex) {
  if (nextIndex >= conditionSequence.length) return false;
  var prev = conditionSequence[prevIndex];
  var next = conditionSequence[nextIndex];
  if (prev.technique !== next.technique) return false; // technique break handles this
  return prev.comboIndex !== next.comboIndex;
}

// ---- Resize helper ----
function applyResize() {
  w = window.innerWidth;
  h = window.innerHeight;
  canvasDiagonal = Math.sqrt(w * w + h * h);
  svg.attr("width", w).attr("height", h);
  svg.select(".backgroundRect").attr("width", w).attr("height", h);
  feedbackRect.attr("width", w).attr("height", h);
  svg.select(".progressBg").attr("width", w);
  svg.select(".studyStatusText1").attr("x", w / 2).attr("y", h / 2 - 60);
  svg.select(".studyStatusText2").attr("x", w / 2).attr("y", h / 2 - 20);
  svg.select(".studyStatusText3").attr("x", w / 2).attr("y", h / 2 + 20);
  svg.select(".studyStatusText4").attr("x", w / 2).attr("y", h / 2 + 50);
  svg.select(".progressLabel").attr("x", w - 10);
  lastClickPos = [w / 2, h / 2];
}

// ---- Practice mode ----
function startPracticeScreen(technique) {
  currentState = STATE_PRACTICE;
  currentTechnique = technique;
  svg.selectAll(".targetCircles").remove();
  svg.select(".cursorCircle").attr("r", 0);
  svg.select(".cursorMorphCircle").attr("r", 0);
  updateInfoText();

  var desc = TECHNIQUE_DESCRIPTIONS[technique];
  setStatusText(
    "Practice: " + technique + " Cursor",
    desc,
    "Click anywhere to start practicing.",
    "Press SPACE when you are ready to begin the real trials."
  );
}

function startPracticeActive() {
  currentState = STATE_PRACTICE_ACTIVE;

  var numT = calculateNumTargets(PRACTICE_TARGET_SIZE);
  targets = initTargets(numT, PRACTICE_TARGET_SIZE, MIN_SEP);
  drawTargets();

  svg.select(".cursorCircle").style("visibility", "visible");
  svg.select(".cursorMorphCircle").style("visibility", "visible");

  clickTarget = Math.floor(Math.random() * targets.length);
  updateTargetsFill(-1, clickTarget);
  setStatusText("", "", "", "");
  updateInfoText();
}

function endPractice() {
  practicedTechniques[currentTechnique] = true;
  svg.selectAll(".targetCircles").remove();
  svg.select(".cursorCircle").attr("r", 0);
  svg.select(".cursorMorphCircle").attr("r", 0);
  nextTechniqueNeedsPractice = false;

  // Now show the rest screen for the real trials
  startRest();
}

// ---- Start rest / break ----
function startRest() {
  currentState = STATE_REST;
  svg.selectAll(".targetCircles").remove();
  svg.select(".cursorCircle").attr("r", 0);
  svg.select(".cursorMorphCircle").attr("r", 0);
  updateProgressBar(true);
  updateInfoText();

  if (conditionIndex >= conditionSequence.length) {
    endStudy();
    return;
  }

  // Check if next technique needs practice
  var next = conditionSequence[conditionIndex];
  if (!practicedTechniques[next.technique]) {
    nextTechniqueNeedsPractice = true;
    startPracticeScreen(next.technique);
    return;
  }

  // Determine if this is a between-technique break or a per-condition break
  var isNewTechnique = (conditionIndex === 0) ||
    conditionSequence[conditionIndex - 1].technique !== next.technique;

  if (isNewTechnique) {
    setStatusText(
      "Next: " + next.technique + " cursor",
      "",
      "Click anywhere to continue",
      "Trial " + (conditionIndex + 1) + " of " + conditionSequence.length
    );
  } else {
    setStatusText(
      "Short Break",
      "Technique: " + next.technique + "  |  Next target size: " + next.targetSize,
      "Click anywhere to continue",
      "Trial " + (conditionIndex + 1) + " of " + conditionSequence.length
    );
  }

  // Handle pending resize
  if (pendingResize) {
    pendingResize = false;
    applyResize();
  }
}

// ---- Start next trial (within a condition, no rest break in between) ----
function startNextTrial() {
  var cond = conditionSequence[conditionIndex];
  currentTechnique = cond.technique;
  currentTargetSize = cond.targetSize;

  var desiredDistance = cond.distanceProportion * canvasDiagonal;
  clickTarget = selectTargetAtDistance(targets, lastClickPos, desiredDistance);

  trajectoryPoints = [];
  lastTrajectorySampleTime = 0;
  trialStartTime = performance.now();
  currentState = STATE_TRIAL_ACTIVE;

  updateTargetsFill(-1, clickTarget);
  updateProgressBar(false);
  updateInfoText();
  setStatusText("", "", "", "");
}

// ---- Start first trial after a rest break ----
function startNextTrialInBlock() {
  var cond = conditionSequence[conditionIndex];
  currentTechnique = cond.technique;
  currentTargetSize = cond.targetSize;

  var desiredDistance = cond.distanceProportion * canvasDiagonal;
  clickTarget = selectTargetAtDistance(targets, lastClickPos, desiredDistance);

  trajectoryPoints = [];
  lastTrajectorySampleTime = 0;
  trialStartTime = performance.now();
  currentState = STATE_TRIAL_ACTIVE;

  updateTargetsFill(-1, clickTarget);
  updateProgressBar(false);
  updateInfoText();
  setStatusText("", "", "", "");
}

// ---- Start a new block after rest ----
// Called after every rest break — always redraws targets since rest clears them
function startBlock() {
  var cond = conditionSequence[conditionIndex];
  currentTechnique = cond.technique;
  currentTargetSize = cond.targetSize;

  // Check if we need fresh random targets or can reuse existing array
  var needNewTargets = (conditionIndex === 0);
  if (!needNewTargets) {
    var prev = conditionSequence[conditionIndex - 1];
    if (prev.targetSize !== cond.targetSize || prev.technique !== cond.technique) {
      needNewTargets = true;
    }
  }

  if (needNewTargets) {
    var numT = calculateNumTargets(currentTargetSize);
    targets = initTargets(numT, currentTargetSize, MIN_SEP);
    lastClickPos = [w / 2, h / 2];
  }

  // Always redraw since startRest() removes circles from DOM
  drawTargets();
  svg.select(".cursorCircle").style("visibility", "visible");
  svg.select(".cursorMorphCircle").style("visibility", "visible");

  // Now start the first trial of this condition
  startNextTrialInBlock();
}

// ---- End study ----
function endStudy() {
  currentState = STATE_STUDY_COMPLETE;
  svg.selectAll(".targetCircles").remove();
  svg.select(".cursorCircle").attr("r", 0);
  svg.select(".cursorMorphCircle").attr("r", 0);
  updateProgressBar(true);

  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, "P" + participant + "_experiment_data.csv");

  setStatusText(
    "Study Complete!",
    "",
    "Please ensure the data file has been downloaded.",
    "Thank you for participating!"
  );
}

// ---- Initial screen ----
startRest();

// ---- Resize handler ----
window.onresize = function () {
  if (currentState === STATE_REST || currentState === STATE_STUDY_COMPLETE ||
      currentState === STATE_PRACTICE) {
    applyResize();
  } else {
    pendingResize = true;
  }
};

// ---- Keyboard handler (Space to end practice) ----
d3.select("body").on("keydown", function () {
  if (d3.event.keyCode === 32) { // Space
    d3.event.preventDefault();
    if (currentState === STATE_PRACTICE_ACTIVE || currentState === STATE_PRACTICE) {
      endPractice();
    }
  }
});

// ---- Mousemove handler ----
svg.on("mousemove", function () {
  var mouse = d3.mouse(this);

  // Sample trajectory during active trial
  if (currentState === STATE_TRIAL_ACTIVE) {
    var now = performance.now();
    if (now - lastTrajectorySampleTime >= TRAJECTORY_SAMPLE_INTERVAL) {
      trajectoryPoints.push({ x: mouse[0], y: mouse[1], t: now });
      lastTrajectorySampleTime = now;
    }
  }

  // Update cursor visuals during active states
  var isActive = (currentState === STATE_TRIAL_ACTIVE || currentState === STATE_PRACTICE_ACTIVE);
  if (isActive && targets.length > 0) {
    var capturedIdx = getCapturedTarget(mouse, targets);
    updateTargetsFill(capturedIdx, clickTarget);
  }
});

// ---- Click handler ----
svg.on("click", function () {
  var mouse = d3.mouse(this);

  // PRACTICE screen → start practice active
  if (currentState === STATE_PRACTICE) {
    startPracticeActive();
    return;
  }

  // PRACTICE_ACTIVE → just cycle targets (no data logged)
  if (currentState === STATE_PRACTICE_ACTIVE) {
    var capturedIdx = getCapturedTarget(mouse, targets);
    if (capturedIdx === clickTarget) {
      flashFeedback(true);
      var newTarget = clickTarget;
      while (newTarget === clickTarget) {
        newTarget = Math.floor(Math.random() * targets.length);
      }
      clickTarget = newTarget;
      updateTargetsFill(-1, clickTarget);
    } else {
      flashFeedback(false);
    }
    return;
  }

  // REST → start block
  if (currentState === STATE_REST) {
    if (conditionIndex >= conditionSequence.length) return;
    startBlock();
    return;
  }

  // TRIAL_ACTIVE → process trial
  if (currentState === STATE_TRIAL_ACTIVE) {
    var capturedIdx = getCapturedTarget(mouse, targets);
    var cond = conditionSequence[conditionIndex];
    var trialEndTime = performance.now();
    var trialTime = trialEndTime - trialStartTime;

    // Compute DVs
    var isError = (capturedIdx !== clickTarget) ? 1 : 0;

    // Error distance: distance from click to target edge (0 if correct)
    var errorDist = 0;
    if (isError) {
      var targetCenter = targets[clickTarget][0];
      var targetRad = targets[clickTarget][1];
      var distToCenter = distance(mouse, targetCenter);
      errorDist = Math.max(0, distToCenter - targetRad);
    }

    // Actual distance from last click position to target center
    var actualDistance = distance(lastClickPos, targets[clickTarget][0]);

    // Submovements
    var velReversals = countVelocityReversals(trajectoryPoints);
    var dirChanges = countDirectionChanges(trajectoryPoints);

    // Append CSV row
    csvContent += participant + "," +
      cond.technique + "," +
      cond.targetSize + "," +
      Math.round(actualDistance) + "," +
      cond.distanceProportion + "," +
      (cond.trialIndex + 1) + "," +
      cond.blockLabel + "," +
      Math.round(trialTime) + "," +
      isError + "," +
      Math.round(errorDist) + "," +
      velReversals + "," +
      dirChanges + "\n";

    // Feedback
    flashFeedback(!isError);

    // Update last click position
    lastClickPos = [mouse[0], mouse[1]];

    // Advance
    conditionIndex++;
    updateProgressBar(false);

    // Check if study is complete
    if (conditionIndex >= conditionSequence.length) {
      startRest();
      return;
    }

    // Check if technique changed → need break + practice
    if (needsTechniqueBreak(conditionIndex - 1, conditionIndex)) {
      startRest();
      return;
    }

    // Check if condition (size×distance combo) changed → per-condition break
    if (needsConditionBreak(conditionIndex - 1, conditionIndex)) {
      startRest();
      return;
    }

    // Continue to next trial (no break needed)
    startNextTrial();
  }
});
