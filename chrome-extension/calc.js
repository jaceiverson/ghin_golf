// Port of the handicap-spread math in ghin.py / util.py, operating on the
// raw score/handicap JSON GHIN.com's own frontend already fetched (captured
// by injected.js). No network requests are made from this file.

function round1(value) {
  return Math.round(value * 10) / 10;
}

// GHIN always displays handicaps/differentials with exactly one decimal
// (7.0, not 7) - JS drops trailing zeros by default, so every handicap or
// differential figure shown in the UI should be run through this.
function fmt1(value) {
  return typeof value === "number" ? value.toFixed(1) : value;
}

// generic great-circle distance, used by the What-If simulator to sort
// course search results by proximity to the golfer's last-played course.
function haversineDistanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth's radius in miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sum(list) {
  return list.reduce((a, b) => a + b, 0);
}

function mean(list) {
  return sum(list) / list.length;
}

function stdevSample(list) {
  const m = mean(list);
  const variance = sum(list.map((x) => (x - m) ** 2)) / (list.length - 1);
  return Math.sqrt(variance);
}

// mirrors util.get_differential_distribution
function differentialDistribution(differentials, handicap) {
  const aboveHandicap = differentials.filter((x) => x > handicap).length;
  if (aboveHandicap === 1) return 0;
  return aboveHandicap / 7;
}

function orderedScores(scoresById) {
  return Object.values(scoresById).sort((a, b) => {
    const dateDiff = new Date(b.played_at) - new Date(a.played_at);
    if (dateDiff !== 0) return dateDiff;
    return (b.order_number || 0) - (a.order_number || 0);
  });
}

// WHS rules cap a handicap index at 54.0, and -10 is roughly as low as a
// scratch-plus golfer's index gets - anything outside that is corrupted
// data (GHIN's API has been observed returning sentinel values like 999),
// not a real handicap, so treat it as missing rather than a real reading.
const MIN_HANDICAP_INDEX = -10;
const MAX_HANDICAP_INDEX = 54;

function isValidHandicapIndex(value) {
  return typeof value === "number" && value >= MIN_HANDICAP_INDEX && value <= MAX_HANDICAP_INDEX;
}

// handicap_history.json (the endpoint ghin.py reads the live handicap from)
// doesn't fire on every GHIN.com page. Every posted score also carries the
// golfer's handicap_index at the time it posted, so fall back to whichever
// captured score has the highest order_number when no direct capture exists.
function deriveHandicapFallback(scoresById) {
  let best = null;
  for (const score of Object.values(scoresById)) {
    if (!isValidHandicapIndex(score?.handicap_index) || score?.order_number == null) continue;
    if (!best || score.order_number > best.order_number) best = score;
  }
  return best ? best.handicap_index : null;
}

// mirrors GHIN.get_handicap_spread. Returns null (with a `reason`) when
// there isn't enough captured data yet to compute the spread.
function computeHandicapSpread(golfer) {
  const handicap = isValidHandicapIndex(golfer.handicap) ? golfer.handicap : deriveHandicapFallback(golfer.scoresById);
  if (handicap == null) {
    return { error: `no handicap captured yet for ${golfer.name || golfer.id}` };
  }
  // GHIN scores handicaps off the 20 most recent rounds - the extension may
  // have accumulated more than 20 in scoresById just from browsing multiple
  // pages, so cap to the most recent 20 here to match GHIN's own math.
  const scores = orderedScores(golfer.scoresById).slice(0, 20);
  if (scores.length < 9) {
    return { error: `only ${scores.length} score(s) captured for ${golfer.name || golfer.id} (need >= 9)` };
  }

  const baseDifferentials = scores.map((s) => s.differential ?? null);
  const scaledDifferentials = scores.map((s) => s.scaled_up_differential ?? null);
  const adjustedDifferentials = scores.map((s) => s.adjusted_scaled_up_differential ?? null);
  const scaledDifferences = scores.map((s, i) =>
    scaledDifferentials[i] != null ? round1(scaledDifferentials[i] - baseDifferentials[i]) : null
  );
  const numberOfHoles = scores.map((s) => s.number_of_holes);
  const pcc = scores.map((s) => s.pcc);
  const courseNames = scores.map((s) => s.ghin_course_name_display);
  const playedDates = scores.map((s) => s.played_at);
  const teeSetSides = scores.map((s) => s.tee_set_side);

  const differentialTimeOrdered = adjustedDifferentials.map(
    (a, i) => a || scaledDifferentials[i] || baseDifferentials[i]
  );

  const mostRecentEight = round1(mean(differentialTimeOrdered.slice(0, 8)));
  const mostRecentFour = round1(mean(differentialTimeOrdered.slice(0, 4)));
  const fallingOffRounds = differentialTimeOrdered.slice(-4).reverse();

  const differential = [...differentialTimeOrdered].sort((a, b) => a - b);

  const worst8Handicap = round1(mean(differential.slice(-8)));
  const worst12Handicap = round1(mean(differential.slice(-12)));
  const all20Handicap = round1(mean(differential));
  const drop4HighLow = round1(mean(differential.slice(4, -4)));

  const carryPercentage = differentialDistribution(differential.slice(0, 8), handicap);

  const next4RoundsToFallOff = fallingOffRounds.map((x) => ({
    value: round1(x),
    isScoring: x <= differential[7],
  }));

  const worstPotentialHandicap =
    fallingOffRounds[0] <= differential[7] ? round1(mean(differential.slice(1, 9))) : handicap;

  const best7Sum = sum(differential.slice(0, 7));
  const differentialToLowerByPointFive = round1(8 * (handicap - 0.5) - best7Sum);
  const differentialToLowerByOne = round1(8 * (handicap - 1) - best7Sum);

  // prefer GHIN's own lifetime totals over recomputing from just the 20
  // rounds used for handicap math - fall back to every captured score (not
  // just the capped 20) when we haven't seen that metadata yet.
  const allCapturedScores = Object.values(golfer.scoresById);
  const allAdjustedGross = allCapturedScores.map((s) => s.adjusted_gross_score).filter((x) => x != null);
  const stats = golfer.historicalStats;
  const totalScores = stats?.totalCount ?? allCapturedScores.length;
  const highestScore = stats?.highestScore ?? (allAdjustedGross.length ? Math.max(...allAdjustedGross) : null);
  const lowestScore = stats?.lowestScore ?? (allAdjustedGross.length ? Math.min(...allAdjustedGross) : null);
  const averageScore = stats?.average ?? (allAdjustedGross.length ? round1(mean(allAdjustedGross)) : null);

  return {
    id: golfer.id,
    name: golfer.name || `Golfer ${golfer.id}`,
    baseDifferentials,
    scaledDifferentials,
    adjustedDifferentials,
    scaledDifferences,
    numberOfHoles,
    pcc,
    courseNames,
    playedDates,
    teeSetSides,
    best8Handicap: handicap,
    worst8Handicap,
    last8Rounds: mostRecentEight,
    last4Rounds: mostRecentFour,
    all20Handicap,
    drop4HighAndLowHandicap: drop4HighLow,
    handicapStdDev: round1(stdevSample(differential)),
    differentialRange: round1(differential[differential.length - 1] - differential[0]),
    carryPercentage,
    worstScoredDifferential: differential[7],
    worstPotentialHandicap,
    differentialToLowerByPointFive,
    differentialToLowerByOne,
    next4RoundsToFallOff,
    lowHandicap: golfer.lowHandicap != null ? golfer.lowHandicap : handicap,
    lowHandicapDate: golfer.lowHandicapDate || new Date().toISOString().slice(0, 10),
    totalScores,
    highestScore,
    lowestScore,
    averageScore,
    consistencyScoreBest8All20: (handicap / all20Handicap) * 100,
    consistencyScoreBest8Worst12: (handicap / worst12Handicap) * 100,
    // the raw, unmodified score objects (same order/length as the arrays
    // above) - kept around so the Scoring Differentials column picker can
    // show literally any field GHIN's API returned, not just the curated
    // subset the tables use.
    rawScores: scores,
    // most-recent-first, length <=20 - the exact set of differentials the
    // best-8 average is computed from, exposed for the "What If?" simulator.
    orderedDifferentials: differentialTimeOrdered,
  };
}

// USGA/WHS differential formula - public, documented, no GHIN-API-shape
// guessing needed: (113 / Slope) x (Adjusted Gross Score - Course Rating -
// PCC). PCC (Playing Conditions Calculation) is only knowable after a round
// is actually played and course conditions assessed, so a hypothetical
// future round assumes 0.
function differentialFromScore(grossScore, courseRating, slopeRating) {
  return round1((113 / slopeRating) * (grossScore - courseRating));
}

// WHS scales a 9-hole differential up to an 18-hole equivalent by adding an
// "expected" second-9 differential based on the golfer's current index
// (0.52 x Index + 1.2) - validated against this codebase's own captured
// data: predicted vs GHIN's actual scaled_up_differential matched exactly
// on half the sample rounds and averaged 0.11 off on the rest, well within
// intermediate-rounding noise.
function nineHoleExpectedDifferential(handicapIndex) {
  return 0.52 * handicapIndex + 1.2;
}

function nineHoleScaledDifferential(baseNineHoleDifferential, handicapIndex) {
  return round1(baseNineHoleDifferential + nineHoleExpectedDifferential(handicapIndex));
}

// inverse of nineHoleScaledDifferential - given a target 18-hole-equivalent
// differential (e.g. "the differential my next round needs"), what 9-hole
// base differential would produce it, at this golfer's current index?
function nineHoleBaseFromScaledDifferential(targetScaledDifferential, handicapIndex) {
  return targetScaledDifferential - nineHoleExpectedDifferential(handicapIndex);
}

// inverse of differentialFromScore, rounded to a whole stroke. Lower score
// = lower (better) differential, so to GUARANTEE at least a given
// improvement the score must be at or below this value - floor, not round,
// or a fractional threshold would silently overstate what's needed.
function scoreThresholdFromDifferential(differential, courseRating, slopeRating) {
  return Math.floor(differential * (slopeRating / 113) + courseRating);
}

// same inversion, but for an "expected/typical" score rather than a
// pass/fail threshold - round to nearest instead of floor.
function expectedScoreFromDifferential(differential, courseRating, slopeRating) {
  return Math.round(differential * (slopeRating / 113) + courseRating);
}

// "if you shoot this score on this tee, what happens to your index?" -
// insert the hypothetical differential as the newest round, drop the 21st
// (oldest) if already at 20, and recompute the best-8 average exactly like
// the real handicap math does. Returns both a delta against that recompute
// and against GHIN's own posted index (best8Handicap) - GHIN can apply caps
// the recompute doesn't know about, so the two can differ slightly.
function simulateNextRoundHandicap(spread, newDifferential) {
  const current = spread.orderedDifferentials;
  const updated = [newDifferential, ...current].slice(0, 20);
  const currentBest8 = round1(mean([...current].sort((a, b) => a - b).slice(0, 8)));
  const updatedBest8 = round1(mean([...updated].sort((a, b) => a - b).slice(0, 8)));
  return {
    newDifferential: round1(newDifferential),
    recomputedCurrentHandicap: currentBest8,
    projectedHandicap: updatedBest8,
    changeFromRecomputedCurrent: round1(updatedBest8 - currentBest8),
    changeFromOfficial: round1(updatedBest8 - spread.best8Handicap),
  };
}

// 18-hole rounds never get scaled/adjusted (that's a 9-hole-only step), so
// adjusted_scaled_up_differential and scaled_up_differential are both null
// for them - fall back down the chain so they still show a number instead
// of a blank cell.
function effectiveDifferential(raw) {
  return raw.adjusted_scaled_up_differential || raw.scaled_up_differential || raw.differential;
}

// mirrors tables.format_scoring_differentials row ordering, but returns the
// raw score object per row (via spread.rawScores) instead of a curated
// subset, so callers can read any field GHIN's API returned.
function rankedScoringDifferentialRows(spread) {
  const scores = spread.rawScores;
  const effective = scores.map(effectiveDifferential);
  const rankedIndexes = scores.map((_, i) => i).sort((a, b) => effective[a] - effective[b]);
  return rankedIndexes.map((i, rank) => ({
    rank: rank + 1,
    raw: scores[i],
    isSectionEnd: rank + 1 === 8,
  }));
}

// Time-series data for the charts: unlike the handicap-spread calc, this
// uses every captured score (not capped to 20) - more browsing means a
// longer trend, which is a feature here rather than a mismatch with GHIN's
// own math. `handicap_index` is the golfer's handicap index at the moment
// each round posted, so plotting it over played_at approximates a handicap
// history even though handicap_history.json itself is never captured.
function buildTimeSeries(golfer) {
  const scores = Object.values(golfer.scoresById)
    .filter((s) => s.played_at)
    .sort((a, b) => new Date(a.played_at) - new Date(b.played_at));
  return {
    dates: scores.map((s) => s.played_at),
    differentials: scores.map((s) => {
      const value = s.adjusted_scaled_up_differential ?? s.scaled_up_differential ?? s.differential;
      return value == null ? null : value;
    }),
    handicaps: scores.map((s) => (isValidHandicapIndex(s.handicap_index) ? s.handicap_index : null)),
  };
}
