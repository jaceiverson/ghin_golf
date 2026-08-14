const STORAGE_KEY = "ghinData";

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  for (const child of children) node.appendChild(child);
  return node;
}

function cell(content, cls) {
  return el("td", { text: content, className: cls });
}

// thresholds retuned for the spread-based consistency formula in calc.js
// (see CONSISTENCY_SCORE_DESIGN.md) - real golfers now spread red/yellow/green
// roughly by how tight their spread actually is, instead of clustering almost
// entirely in yellow the way the old ratio-based score did.
function colorizeConsistency(pct) {
  const cls = pct < 50 ? "clr-red" : pct < 70 ? "clr-yellow" : "clr-green";
  return { text: `${pct.toFixed(1)}%`, cls };
}

// mirrors tables._colorize_worst_potential_handicap
function colorizeWorstPotential(worst, best8) {
  const change = worst - best8;
  const cls = change === 0 ? "clr-green" : change < 1 ? "clr-yellow" : "clr-red";
  return { text: fmt1(worst), cls };
}

// mirrors tables._colorize_scoring_differential. Yellow is reserved for an
// exact match (at the displayed 1-decimal precision) - not merely "close" -
// so round both sides the same way fmt1 displays them before comparing.
function colorizeDifferential(diff, handicap) {
  if (diff == null) return { text: "-", cls: "dash" };
  const cls = round1(diff) === round1(handicap) ? "clr-yellow" : diff < handicap ? "clr-green" : "clr-red";
  return { text: fmt1(diff), cls };
}

function coloredCell(colorized, extraClass) {
  return cell(colorized.text, `${colorized.cls || ""} ${extraClass || ""}`.trim());
}

function scrollWrap(table) {
  return el("div", { className: "table-scroll" }, [table]);
}

function buildTable(title, headers, rows) {
  const table = el("table");
  table.appendChild(el("caption", { text: title }));
  const headerCells = headers.map((h) => {
    const text = typeof h === "string" ? h : h.text;
    const className = typeof h === "string" ? undefined : h.className;
    return withDefinitionTooltip(el("th", { text, className }), text);
  });
  const thead = el("thead", {}, [el("tr", {}, headerCells)]);
  table.appendChild(thead);
  const tbody = el("tbody");
  for (const row of rows) {
    const className = [row.sectionEnd ? "section-end" : "", row.highlight ? "scoring-row" : ""].filter(Boolean).join(" ");
    const tr = el("tr", { className });
    for (const c of row.cells) tr.appendChild(c);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return scrollWrap(table);
}

function sortedSpreads(spreads) {
  return [...spreads].sort((a, b) => a.best8Handicap - b.best8Handicap);
}

// Golfer-per-row tables get wide fast in a narrow side panel, so these four
// multi-golfer tables run golfers as columns and metrics as rows instead.
function buildTransposedTable(title, spreads, rowDefs) {
  const table = el("table");
  table.appendChild(el("caption", { text: title }));
  const headerRow = el("tr", {}, [el("th", { text: "" }), ...spreads.map((s) => el("th", { text: s.name }))]);
  table.appendChild(el("thead", {}, [headerRow]));
  const tbody = el("tbody");
  for (const rowDef of rowDefs) {
    const labelTh = withDefinitionTooltip(el("th", { text: rowDef.label, className: "row-label" }), rowDef.label);
    const tr = el("tr", {}, [labelTh]);
    for (const s of spreads) tr.appendChild(rowDef.render(s));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return scrollWrap(table);
}

// mirrors tables._build_alternative_handicaps_table
function renderAlternativeHandicaps(container, spreads) {
  const sorted = sortedSpreads(spreads);
  container.appendChild(
    buildTransposedTable("Alternative Handicaps", sorted, [
      { label: "Best 8", render: (s) => cell(fmt1(s.best8Handicap), "clr-green") },
      { label: "Worst 8", render: (s) => cell(fmt1(s.worst8Handicap), "clr-red") },
      { label: "Last 8", render: (s) => cell(fmt1(s.last8Rounds), "clr-yellow") },
      { label: "Last 4", render: (s) => cell(fmt1(s.last4Rounds), "clr-yellow") },
      { label: "All 20", render: (s) => cell(fmt1(s.all20Handicap), "clr-yellow") },
      { label: "Drop 4HL", render: (s) => cell(fmt1(s.drop4HighAndLowHandicap), "clr-yellow") },
    ])
  );
}

// one segment per best-8 differential: below the handicap ("carry" - the
// good rounds pulling it down) is orange, above it ("drag" - the rounds
// holding it back) is violet, and an exact match (at the displayed
// 1-decimal precision) is a neutral gray - deliberately NOT red/green/yellow,
// so it can't be confused with the good/bad coloring used everywhere else
// (Scoring Differentials, consistency score, etc). This is the opposite
// mapping from colorizeDifferential (which colors below-handicap green) -
// deliberate, per how carry/drag are meant to read here. No counts anywhere -
// the bar segments and the two legend words are the whole story.
function carryDragRatioCell(best8Differentials, handicap) {
  const bar = el("div", { className: "ratio-bar" });
  for (const diff of best8Differentials) {
    const cls = round1(diff) === round1(handicap) ? "match" : diff < handicap ? "carry" : "drag";
    bar.appendChild(el("span", { className: `ratio-seg ${cls}` }));
  }
  const label = el("div", { className: "ratio-label" }, [
    el("span", { className: "clr-carry", text: "Carry" }),
    el("span", { text: "  " }),
    el("span", { className: "clr-drag", text: "Drag" }),
  ]);
  return el("td", {}, [bar, label]);
}

// a min-to-max line with a shaded band for avg +/- 1 std dev and a marker
// at the average - a lightweight stand-in for a full box plot, in the same
// inline-table-cell style as the Carry:Drag bar above.
function rangeStdDevStripCell(min, max, avg, stddev) {
  const range = max - min;
  const pct = (v) => (range > 0 ? Math.min(100, Math.max(0, ((v - min) / range) * 100)) : 50);
  const bandLowPct = pct(avg - stddev);
  const bandHighPct = pct(avg + stddev);
  const avgPct = pct(avg);

  const strip = el("div", { className: "range-strip" }, [
    el("div", { className: "range-track" }),
    el("div", { className: "range-stddev-band", attrs: { style: `left:${bandLowPct}%; width:${bandHighPct - bandLowPct}%` } }),
    el("div", { className: "range-avg-marker", attrs: { style: `left:${avgPct}%` } }),
  ]);
  const labels = el("div", { className: "range-labels" }, [
    el("span", { className: "range-min", text: fmt1(min) }),
    el("span", { className: "range-avg-label", text: `avg ${fmt1(avg)} ± ${fmt1(stddev)}` }),
    el("span", { className: "range-max", text: fmt1(max) }),
  ]);
  return el("td", {}, [strip, labels]);
}

// mirrors tables._build_statistics_table
function renderStatistics(container, spreads) {
  const sorted = sortedSpreads(spreads);
  container.appendChild(
    buildTransposedTable("Statistics", sorted, [
      {
        label: "Range & Std Dev (all 20 scores)",
        render: (s) => rangeStdDevStripCell(s.differentialMin, s.differentialMax, s.differentialAverage, s.handicapStdDev),
      },
      { label: "Carry:Drag", render: (s) => carryDragRatioCell(s.best8Differentials, s.best8Handicap) },
      {
        label: "Current Hot Streak",
        render: (s) => cell(`${s.hotStreakCurrent} ${"🔥".repeat(s.hotStreakCurrent)}`.trim(), s.hotStreakCurrent > 0 ? "clr-green" : ""),
      },
      {
        label: "Best Hot Streak",
        render: (s) => {
          // only fire up the record row when the active streak has actually
          // caught up to it - otherwise it's history, not something hot.
          const isCurrentlyTied = s.hotStreakCurrent > 0 && s.hotStreakCurrent >= s.hotStreakLongest;
          const fire = isCurrentlyTied ? ` ${"🔥".repeat(s.hotStreakLongest)}` : "";
          return cell(`${s.hotStreakLongest}${fire}`, s.hotStreakLongest > 0 ? "clr-green" : "");
        },
      },
      {
        label: "Current Cold Streak",
        render: (s) => cell(`${s.coldStreakCurrent} ${"🧊".repeat(s.coldStreakCurrent)}`.trim(), s.coldStreakCurrent > 0 ? "clr-red" : ""),
      },
      {
        label: "Worst Cold Streak",
        render: (s) => {
          const isCurrentlyTied = s.coldStreakCurrent > 0 && s.coldStreakCurrent >= s.coldStreakLongest;
          const ice = isCurrentlyTied ? ` ${"🧊".repeat(s.coldStreakLongest)}` : "";
          return cell(`${s.coldStreakLongest}${ice}`, s.coldStreakLongest > 0 ? "clr-red" : "");
        },
      },
      { label: "Consistency Score", render: (s) => coloredCell(colorizeConsistency(s.consistencyScoreBest8All20)) },
    ])
  );
}

// hot/cold streak round-detail tables are rebuilt fresh every render (state
// lives in this plain JS variable, not the button's own DOM node, since the
// button itself gets torn down and recreated each render too).
let showStreakDetails = false;

function renderStreakDetailsSection(container, spreads) {
  const anyStreaks = spreads.some((s) => s.hotStreakLongest > 0 || s.coldStreakLongest > 0);
  if (!anyStreaks) return;

  const toggleBtn = el("button", { className: "streak-toggle-btn", text: showStreakDetails ? "Hide Streaks" : "Show Streaks" });
  toggleBtn.addEventListener("click", () => {
    showStreakDetails = !showStreakDetails;
    render();
  });
  container.appendChild(toggleBtn);

  if (showStreakDetails) {
    renderStreakRoundsDetails(container, spreads, "hotStreakLongest", "hotStreakBestRounds", "🔥 Best Hot Streak Rounds");
    renderStreakRoundsDetails(container, spreads, "coldStreakLongest", "coldStreakBestRounds", "🧊 Worst Cold Streak Rounds");
  }
}

// the rounds that made up each golfer's best hot streak (or worst cold
// streak - same shape, just different fields/title) - broken out of the
// compact Statistics grid since "5 rounds" doesn't leave room for dates and
// scores. Only rendered for golfers with an actual streak (>0) to show.
function renderStreakRoundsDetails(container, spreads, lengthKey, roundsKey, titlePrefix) {
  const withStreaks = spreads.filter((s) => s[lengthKey] > 0 && s[roundsKey]?.length);
  if (!withStreaks.length) return;
  for (const s of sortedSpreads(withStreaks)) {
    const rows = s[roundsKey].map((r) => ({
      cells: [
        cell(rawText(r.played_at)),
        cell(rawText(r.course_name)),
        cell(rawText(r.adjusted_gross_score)),
        coloredCell(colorizeDifferential(effectiveDifferential(r), s.best8Handicap)),
        cell(isValidHandicapIndex(r.handicap_index) ? fmt1(r.handicap_index) : "-"),
      ],
    }));
    container.appendChild(
      buildTable(`${titlePrefix} (${s.name})`, ["Date", "Course", "Gross Score", "Differential", "Handicap at the Time"], rows)
    );
  }
}

// mirrors tables._build_next_round_helpers_table
function renderNextRoundHelpers(container, spreads) {
  const sorted = sortedSpreads(spreads);
  container.appendChild(
    buildTransposedTable("Next Round Helpers", sorted, [
      { label: "8th Scored", render: (s) => cell(fmt1(s.worstScoredDifferential), "clr-yellow") },
      {
        label: "Score Fall Off",
        render: (s) =>
          el("td", {}, [
            el(
              "div",
              { className: "falloff" },
              s.next4RoundsToFallOff.map((r) =>
                el("span", { text: r.value.toFixed(1), className: r.isScoring ? "clr-green" : "clr-red" })
              )
            ),
          ]),
      },
      {
        label: "Worst Potential Handicap",
        render: (s) => coloredCell(colorizeWorstPotential(s.worstPotentialHandicap, s.best8Handicap)),
      },
      { label: "To Lower by .5", render: (s) => cell(fmt1(s.differentialToLowerByPointFive), "clr-cyan") },
      { label: "To Lower by 1", render: (s) => cell(fmt1(s.differentialToLowerByOne), "clr-cyan") },
    ])
  );
}

// mirrors tables._build_historical_table
function renderHistorical(container, spreads) {
  const sorted = sortedSpreads(spreads);
  container.appendChild(
    buildTransposedTable("Historical Values", sorted, [
      { label: "Low Handicap", render: (s) => cell(fmt1(s.lowHandicap), "clr-green") },
      { label: "Low Date", render: (s) => cell(s.lowHandicapDate, "clr-green") },
      { label: "Total Scores", render: (s) => cell(s.totalScores, "clr-green") },
      { label: "Highest Score", render: (s) => cell(s.highestScore) },
      { label: "Lowest Score", render: (s) => cell(s.lowestScore) },
      { label: "Average Score", render: (s) => cell(s.averageScore) },
    ])
  );
}

const DETAIL_COL = "detail-col";
const TEE_SIDE_LABELS = { F9: "Front", B9: "Back" };

function boolText(v) {
  return v == null ? "-" : v ? "Yes" : "No";
}
function jsonText(v) {
  if (v == null) return "-";
  if (Array.isArray(v) && v.length === 0) return "-";
  if (typeof v === "object" && Object.keys(v).length === 0) return "-";
  return JSON.stringify(v);
}
function rawText(v) {
  return v == null || v === "" ? "-" : String(v);
}

// every column is toggleable via the "Columns" menu, grouped for that
// popup - including what used to be a fixed "always visible" set (now just
// the first group, defaulting to checked so nothing changes on first load).
const TOGGLE_COLUMN_GROUPS = [
  {
    group: "Default Columns",
    columns: [
      { key: "round", label: "Round", render: (r) => cell(r.rank, DETAIL_COL) },
      { key: "played_at", label: "Date", render: (r) => cell(rawText(r.raw.played_at), DETAIL_COL) },
      { key: "number_of_holes", label: "Holes", render: (r) => cell(rawText(r.raw.number_of_holes), DETAIL_COL) },
      { key: "course_name", label: "Course Name", render: (r) => cell(rawText(r.raw.course_name), DETAIL_COL) },
      {
        key: "tee_set_side",
        label: "Tee Side",
        render: (r) => cell(TEE_SIDE_LABELS[r.raw.tee_set_side] || rawText(r.raw.tee_set_side), DETAIL_COL),
      },
      { key: "adjusted_gross_score", label: "Gross Score", render: (r) => cell(rawText(r.raw.adjusted_gross_score), DETAIL_COL) },
      { key: "course_rating", label: "Course Rating", render: (r) => cell(fmt1(r.raw.course_rating), DETAIL_COL) },
      {
        key: "adjusted",
        label: "Adjusted",
        render: (r, spread) => coloredCell(colorizeDifferential(effectiveDifferential(r.raw), spread.best8Handicap), DETAIL_COL),
      },
    ],
  },
  {
    group: "Differentials",
    columns: [
      {
        key: "differential",
        label: "Base Differential",
        render: (r, spread) => coloredCell(colorizeDifferential(r.raw.differential, spread.best8Handicap), DETAIL_COL),
      },
      {
        key: "unadjusted_differential",
        label: "Unadjusted Differential",
        render: (r, spread) => coloredCell(colorizeDifferential(r.raw.unadjusted_differential, spread.best8Handicap), DETAIL_COL),
      },
      {
        key: "scaled_up_differential",
        label: "Scaled Differential",
        render: (r, spread) => coloredCell(colorizeDifferential(r.raw.scaled_up_differential, spread.best8Handicap), DETAIL_COL),
      },
      {
        key: "scaled_diff_computed",
        label: "Scaled Diff (+amount)",
        render: (r) => {
          const base = r.raw.differential;
          const scaled = r.raw.scaled_up_differential;
          const diff = scaled != null && base != null ? round1(scaled - base) : null;
          return cell(diff == null ? "-" : `+${fmt1(diff)}`, `${diff == null ? "dash" : ""} ${DETAIL_COL}`.trim());
        },
      },
      { key: "pcc", label: "PCC", render: (r) => cell(rawText(r.raw.pcc), DETAIL_COL) },
      { key: "net_score_differential", label: "Net Score Differential", render: (r) => cell(rawText(r.raw.net_score_differential), DETAIL_COL) },
    ],
  },
  {
    group: "Handicap Index",
    columns: [
      { key: "handicap_index_display", label: "Handicap Index (at time)", render: (r) => cell(rawText(r.raw.handicap_index_display), DETAIL_COL) },
    ],
  },
  {
    group: "Course & Tee",
    columns: [
      { key: "facility_name", label: "Facility Name", render: (r) => cell(rawText(r.raw.facility_name), DETAIL_COL) },
      { key: "tee_name", label: "Tee Name", render: (r) => cell(rawText(r.raw.tee_name), DETAIL_COL) },
      { key: "slope_rating", label: "Slope Rating", render: (r) => cell(rawText(r.raw.slope_rating), DETAIL_COL) },
      { key: "course_handicap", label: "Course Handicap", render: (r) => cell(rawText(r.raw.course_handicap), DETAIL_COL) },
      { key: "course_id", label: "Course ID", render: (r) => cell(rawText(r.raw.course_id), DETAIL_COL) },
      { key: "tee_set_id", label: "Tee Set ID", render: (r) => cell(rawText(r.raw.tee_set_id), DETAIL_COL) },
      { key: "ghin_course_name_display", label: "Course + Tee Display", render: (r) => cell(rawText(r.raw.ghin_course_name_display), DETAIL_COL) },
    ],
  },
  {
    group: "Scoring Detail",
    columns: [
      { key: "net_score", label: "Net Score", render: (r) => cell(rawText(r.raw.net_score), DETAIL_COL) },
      { key: "to_par_display_value", label: "To Par", render: (r) => cell(rawText(r.raw.to_par_display_value), DETAIL_COL) },
      { key: "score_type_display_full", label: "Score Type", render: (r) => cell(rawText(r.raw.score_type_display_full), DETAIL_COL) },
      { key: "status", label: "Status", render: (r) => cell(rawText(r.raw.status), DETAIL_COL) },
      { key: "number_of_played_holes", label: "Holes Played", render: (r) => cell(rawText(r.raw.number_of_played_holes), DETAIL_COL) },
    ],
  },
  {
    group: "Round Metadata",
    columns: [
      { key: "order_number", label: "Order Number", render: (r) => cell(rawText(r.raw.order_number), DETAIL_COL) },
      { key: "score_day_order", label: "Score Day Order", render: (r) => cell(rawText(r.raw.score_day_order), DETAIL_COL) },
      { key: "posted_at", label: "Posted At", render: (r) => cell(rawText(r.raw.posted_at), DETAIL_COL) },
      { key: "season_start_date_at", label: "Season Start", render: (r) => cell(rawText(r.raw.season_start_date_at), DETAIL_COL) },
      { key: "season_end_date_at", label: "Season End", render: (r) => cell(rawText(r.raw.season_end_date_at), DETAIL_COL) },
      { key: "golfer_id", label: "Golfer ID", render: (r) => cell(rawText(r.raw.golfer_id), DETAIL_COL) },
      { key: "gender", label: "Gender", render: (r) => cell(rawText(r.raw.gender), DETAIL_COL) },
    ],
  },
  {
    group: "Flags",
    columns: [
      { key: "is_manual", label: "Is Manual", render: (r) => cell(boolText(r.raw.is_manual), DETAIL_COL) },
      { key: "edited", label: "Edited", render: (r) => cell(boolText(r.raw.edited), DETAIL_COL) },
      { key: "exceptional", label: "Exceptional", render: (r) => cell(boolText(r.raw.exceptional), DETAIL_COL) },
      { key: "used", label: "Used", render: (r) => cell(boolText(r.raw.used), DETAIL_COL) },
      { key: "revision", label: "Revision", render: (r) => cell(boolText(r.raw.revision), DETAIL_COL) },
      { key: "is_recent", label: "Is Recent", render: (r) => cell(boolText(r.raw.is_recent), DETAIL_COL) },
      { key: "posted_on_home_course", label: "Posted On Home Course", render: (r) => cell(boolText(r.raw.posted_on_home_course), DETAIL_COL) },
      { key: "can_be_deleted", label: "Can Be Deleted", render: (r) => cell(boolText(r.raw.can_be_deleted), DETAIL_COL) },
      { key: "penalty", label: "Penalty", render: (r) => cell(boolText(r.raw.penalty), DETAIL_COL) },
      { key: "penalty_type", label: "Penalty Type", render: (r) => cell(rawText(r.raw.penalty_type), DETAIL_COL) },
      { key: "penalty_method", label: "Penalty Method", render: (r) => cell(rawText(r.raw.penalty_method), DETAIL_COL) },
      { key: "challenge_available", label: "Challenge Available", render: (r) => cell(boolText(r.raw.challenge_available), DETAIL_COL) },
      { key: "short_course", label: "Short Course", render: (r) => cell(boolText(r.raw.short_course), DETAIL_COL) },
      { key: "country_code", label: "Country Code", render: (r) => cell(rawText(r.raw.country_code), DETAIL_COL) },
    ],
  },
  {
    group: "Front/Back 9 Splits",
    columns: [
      { key: "front9_adjusted", label: "Front 9 Adjusted", render: (r) => cell(rawText(r.raw.front9_adjusted), DETAIL_COL) },
      { key: "back9_adjusted", label: "Back 9 Adjusted", render: (r) => cell(rawText(r.raw.back9_adjusted), DETAIL_COL) },
      { key: "front9_course_name", label: "Front 9 Course Name", render: (r) => cell(rawText(r.raw.front9_course_name), DETAIL_COL) },
      { key: "back9_course_name", label: "Back 9 Course Name", render: (r) => cell(rawText(r.raw.back9_course_name), DETAIL_COL) },
      { key: "front9_course_rating", label: "Front 9 Course Rating", render: (r) => cell(rawText(r.raw.front9_course_rating), DETAIL_COL) },
      { key: "back9_course_rating", label: "Back 9 Course Rating", render: (r) => cell(rawText(r.raw.back9_course_rating), DETAIL_COL) },
      { key: "front9_slope_rating", label: "Front 9 Slope Rating", render: (r) => cell(rawText(r.raw.front9_slope_rating), DETAIL_COL) },
      { key: "back9_slope_rating", label: "Back 9 Slope Rating", render: (r) => cell(rawText(r.raw.back9_slope_rating), DETAIL_COL) },
      { key: "front9_tee_name", label: "Front 9 Tee Name", render: (r) => cell(rawText(r.raw.front9_tee_name), DETAIL_COL) },
      { key: "back9_tee_name", label: "Back 9 Tee Name", render: (r) => cell(rawText(r.raw.back9_tee_name), DETAIL_COL) },
    ],
  },
  {
    group: "Other / Advanced",
    columns: [
      { key: "parent_id", label: "Parent ID", render: (r) => cell(rawText(r.raw.parent_id), DETAIL_COL) },
      { key: "adjustments", label: "Adjustments", render: (r) => cell(jsonText(r.raw.adjustments), DETAIL_COL) },
      { key: "hole_details", label: "Hole Details", render: (r) => cell(jsonText(r.raw.hole_details), DETAIL_COL) },
      { key: "statistics", label: "Statistics", render: (r) => cell(jsonText(r.raw.statistics), DETAIL_COL) },
      { key: "message_club_authorized", label: "Message Club Authorized", render: (r) => cell(rawText(r.raw.message_club_authorized), DETAIL_COL) },
    ],
  },
];

const ALL_TOGGLE_COLUMNS = TOGGLE_COLUMN_GROUPS.flatMap((g) => g.columns);
let visibleColumnKeys = new Set();

// term -> description shown on the Definitions tab and as a hover tooltip
// anywhere that term is used as a table/column header. Empty for now - fill
// these in as you go; blank entries just render as "-" and get no tooltip.
const METRIC_DEFINITIONS = {
  "Best 8": "This is what your posted handicap is. Your best 8 differentials of your last 20 rounds. We automatically include recent rounds, where GHIN takes some time. So if you have recent scoring rounds this number might be slightly different.",
  "Worst 8": "Alternatively, what would your handicap be if we took your worst 8 of your last 20. For obvious reasons this would be a terrible idea in a competitive environment, but for educational purposes it can be useful.",
  "Last 8": "What would your handicap be if we only took your most recent 8 scores. How are you playing lately? Same caveat about competitive integrity as worst 8 metric.",
  "Last 4": "Same as Last 8, but only take your most recent 4 scores. Even more, 'What have you done for me recently?'",
  "All 20": "Instead of taking your best 8, lets look at your 20 most recent rounds and give an average.",
  "Drop 4HL": "Drop your 4 lowest and 4 highest differentials and average our the remaining 12. I like this metric as it tells me how I am 'normally' playing.",
  "Range & Std Dev (all 20 scores)": "Min, Max, Average, and Standard Deviation of your 20 most recent differentials.",
  "Consistency Score": "Score used to determine how consistent you are playing. 100% consistency score would mean all 20 of your most recent rounds fall within 0.1 difference to your posted handicap. To not punish higher spread golfers we use a scaler value. More details and a visual are shown below.",
  "Carry:Drag": "Carry is how many scoring rounds you have BELOW your posted handicap. Drag is how many scoring rounds you have above your posted handicap. High carry suggests extraordinary rounds and high drag suggests your handicap will likely lower in your next few rounds.",
  "Current Hot Streak": "Hot Streak is how many consecutive rounds you post a scoring round.",
  "Best Hot Streak": "When you pull historical data we can see your best hot streak for all posted GHIN rounds.",
  "Current Cold Streak": "Cold Streak is how many consecutive rounds you post without a scoring round. The max possible is 12. We hope you don't get there.",
  "Worst Cold Streak": "When you pull historical data we can see your best hot streak for all posted GHIN rounds.",
  "8th Scored": "This is your highest scored differential. Score better than this and your handicap will go down.",
  "Score Fall Off": "The next 4 rounds to 'fall off' and no longer be considered in your last 20 rounds.",
  "Worst Potential Handicap": "What is the worst case for your handicap when you play your next round. If your next round to fall off isn't a scoring round, this number will match your current handicap.",
  "To Lower by .5": "What differential you need to score for your next round to lower your handicap by 0.5.",
  "To Lower by 1": "What differential you need to score for your next round to lower your handicap by 1.",
  "Low Handicap": "Your all time low handicap index.",
  "Low Date": "The date you help your lowest handicap.",
  "Total Scores": "How many rounds have you posted to GHIN?",
  "Highest Score": "Your highest posted gross score.",
  "Lowest Score": "Your lowest posted gross score.",
  "Average Score": "Your average posted score (18 holes)",
};

function definitionFor(term) {
  return METRIC_DEFINITIONS[term] || "";
}

// how long to hover before the tooltip appears - the native `title`
// attribute's delay is an OS setting we can't control, so headers/row labels
// with a definition use this instead. Lower = snappier, but too low makes it
// pop up on every incidental mouse pass over the table.
const TOOLTIP_DELAY_MS = 120;

let fastTooltipEl = null;
function showFastTooltip(target, text) {
  if (!fastTooltipEl) {
    fastTooltipEl = el("div", { className: "fast-tooltip" });
    document.body.appendChild(fastTooltipEl);
  }
  fastTooltipEl.textContent = text;
  fastTooltipEl.style.display = "block";
  const rect = target.getBoundingClientRect();
  const tipRect = fastTooltipEl.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - tipRect.width - 8);
  fastTooltipEl.style.left = `${Math.max(4, left)}px`;
  fastTooltipEl.style.top = `${rect.bottom + 4}px`;
}
function hideFastTooltip() {
  if (fastTooltipEl) fastTooltipEl.style.display = "none";
}

// attaches the fast hover tooltip to a header/row-label cell - a no-op if
// there's no definition yet, so undefined terms stay plain (no dotted
// underline promising a tooltip that isn't there).
function withDefinitionTooltip(node, term) {
  const definition = definitionFor(term);
  if (!definition) return node;
  node.classList.add("has-tooltip");
  let timer;
  node.addEventListener("mouseenter", () => {
    timer = setTimeout(() => showFastTooltip(node, definition), TOOLTIP_DELAY_MS);
  });
  node.addEventListener("mouseleave", () => {
    clearTimeout(timer);
    hideFastTooltip();
  });
  return node;
}

// grouped the same way the Columns picker groups them, plus the
// hand-written metrics above each in their own section - one row per term,
// ready to have its Definition cell filled in.
const DEFINITION_SECTIONS = [
  { section: "Alternative Handicaps", terms: ["Best 8", "Worst 8", "Last 8", "Last 4", "All 20", "Drop 4HL"] },
  {
    section: "Statistics",
    terms: [
      "Range & Std Dev (all 20 scores)",
      "Carry:Drag",
      "Current Hot Streak",
      "Best Hot Streak",
      "Current Cold Streak",
      "Worst Cold Streak",
      "Consistency Score",
    ],
  },
  {
    section: "Next Round Helpers",
    terms: ["8th Scored", "Score Fall Off", "Worst Potential Handicap", "To Lower by .5", "To Lower by 1"],
  },
  {
    section: "Historical Values",
    terms: ["Low Handicap", "Low Date", "Total Scores", "Highest Score", "Lowest Score", "Average Score"],
  },
  ...TOGGLE_COLUMN_GROUPS.map((g) => ({ section: `Scoring Differentials - ${g.group}`, terms: g.columns.map((c) => c.label) })),
];

// CONSISTENCY_RAMP_START/END, CONSISTENCY_SCALE_MIN/MAX, CONSISTENCY_BUFFER,
// and consistencyRampScale() all come from calc.js - reused directly (not
// redeclared here) so this illustration can't silently drift from the real
// formula consistencyScore() actually uses.

// four made-up golfers (no real names) spaced across the strict/ramp/lenient
// zones, just to show where a given spread lands on the curve.
const RAMP_CHART_EXAMPLE_SPREADS = [1, 4, 9, 16];

function buildConsistencyRampChart() {
  const X0 = 50,
    X1 = 430,
    Y0 = 200,
    Y1 = 20;
  const XMIN = 0,
    XMAX = 17;
  const YMIN = 8.5,
    YMAX = 18.5;
  const xs = (spread) => X0 + ((spread - XMIN) / (XMAX - XMIN)) * (X1 - X0);
  const ys = (scale) => Y0 + ((scale - YMIN) / (YMAX - YMIN)) * (Y1 - Y0);

  const curvePoints = [0, CONSISTENCY_RAMP_START, CONSISTENCY_RAMP_END, XMAX]
    .map((s) => `${xs(s).toFixed(1)},${ys(consistencyRampScale(s)).toFixed(1)}`)
    .join(" L ");

  const dots = RAMP_CHART_EXAMPLE_SPREADS.map((spread) => {
    const scale = consistencyRampScale(spread);
    return `<circle class="ramp-pt" cx="${xs(spread).toFixed(1)}" cy="${ys(scale).toFixed(1)}" r="4"><title>Hypothetical golfer - spread ${spread.toFixed(
      1
    )}, scale ${scale.toFixed(2)}</title></circle>`;
  }).join("");

  const yTicks = [9, 12, 15, 18].map((sc) => `<text class="ramp-tick" x="${X0 - 8}" y="${(ys(sc) + 3).toFixed(1)}" text-anchor="end">${sc}</text>`).join("");
  const xTicks = [0, 2, 6, 12, 16].map((s) => `<text class="ramp-tick" x="${xs(s).toFixed(1)}" y="${Y0 + 14}" text-anchor="middle">${s}</text>`).join("");

  const card = el("div", { className: "ramp-chart-card" });
  card.appendChild(el("h4", { text: "Scale used vs. spread (strokes)" }));
  card.innerHTML += `
    <svg viewBox="0 0 460 220">
      <rect x="${X0}" y="${Y1}" width="${xs(CONSISTENCY_RAMP_START) - X0}" height="${Y0 - Y1}" fill="var(--accent)" opacity="0.06" />
      <rect x="${xs(CONSISTENCY_RAMP_END).toFixed(1)}" y="${Y1}" width="${(X1 - xs(CONSISTENCY_RAMP_END)).toFixed(1)}" height="${Y0 - Y1}" fill="var(--red)" opacity="0.06" />
      <line class="ramp-grid" x1="${X0}" y1="${ys(9)}" x2="${X1}" y2="${ys(9)}" />
      <line class="ramp-grid" x1="${X0}" y1="${ys(12)}" x2="${X1}" y2="${ys(12)}" />
      <line class="ramp-grid" x1="${X0}" y1="${ys(15)}" x2="${X1}" y2="${ys(15)}" />
      <line class="ramp-grid" x1="${X0}" y1="${ys(18)}" x2="${X1}" y2="${ys(18)}" />
      <line class="ramp-guide" x1="${xs(CONSISTENCY_RAMP_START).toFixed(1)}" y1="${Y1}" x2="${xs(CONSISTENCY_RAMP_START).toFixed(1)}" y2="${Y0}" />
      <line class="ramp-guide" x1="${xs(CONSISTENCY_RAMP_END).toFixed(1)}" y1="${Y1}" x2="${xs(CONSISTENCY_RAMP_END).toFixed(1)}" y2="${Y0}" />
      <line class="ramp-axis" x1="${X0}" y1="${Y0}" x2="${X1}" y2="${Y0}" />
      <line class="ramp-axis" x1="${X0}" y1="${Y1}" x2="${X0}" y2="${Y0}" />
      ${yTicks}
      ${xTicks}
      <text class="ramp-zone-label" x="${((X0 + xs(CONSISTENCY_RAMP_START)) / 2).toFixed(1)}" y="${Y1 + 10}" text-anchor="middle">Strict</text>
      <text class="ramp-zone-label" x="${((xs(CONSISTENCY_RAMP_START) + xs(CONSISTENCY_RAMP_END)) / 2).toFixed(1)}" y="${Y1 + 10}" text-anchor="middle">Ramp</text>
      <text class="ramp-zone-label" x="${((xs(CONSISTENCY_RAMP_END) + X1) / 2).toFixed(1)}" y="${Y1 + 10}" text-anchor="middle">Lenient</text>
      <path class="ramp-curve" d="M ${curvePoints}" />
      ${dots}
    </svg>
  `;
  card.appendChild(
    el("pre", {
      className: "ramp-formula",
      text:
        "spread  = abs(otherHandicap - best8Handicap)\n" +
        "t       = clamp((spread - 2) / (12 - 2), 0, 1)\n" +
        "scale   = 9 + (18 - 9) * t\n" +
        "excess  = max(0, spread - 0.1)\n" +
        "score   = clamp(100 * (1 - excess / scale), 0, 100)",
    })
  );

  const exampleRows = RAMP_CHART_EXAMPLE_SPREADS.map((spread) => {
    const scale = consistencyRampScale(spread);
    const excess = Math.max(0, spread - CONSISTENCY_BUFFER);
    const score = Math.max(0, Math.min(100, 100 * (1 - excess / scale)));
    return { cells: [cell(fmt1(spread)), cell(fmt1(scale)), coloredCell(colorizeConsistency(score))] };
  });
  card.appendChild(buildTable("Hypothetical golfers along the curve", ["Spread (strokes)", "Scale used", "Consistency Score"], exampleRows));

  return card;
}

function buildDefinitionsPanel() {
  const container = el("div");
  container.appendChild(
    el("p", {
      className: "definitions-empty",
      text: "Hover any underlined column/row header throughout the app to see its definition once filled in below.",
    })
  );
  for (const { section, terms } of DEFINITION_SECTIONS) {
    const rows = terms.map((term) => {
      const definition = definitionFor(term);
      return { cells: [cell(term), cell(definition || "-", definition ? "" : "dash")] };
    });
    container.appendChild(buildTable(section, ["Metric", "Definition"], rows));
    if (section === "Statistics") container.appendChild(buildConsistencyRampChart());
  }
  return container;
}

async function loadColumnPrefs() {
  const { ghinColumnPrefs } = await chrome.storage.local.get("ghinColumnPrefs");
  if (ghinColumnPrefs) {
    visibleColumnKeys = new Set(ghinColumnPrefs);
  } else {
    // first run, nothing saved yet - default to exactly what used to be the
    // fixed "always visible" set, so nothing changes for existing users.
    visibleColumnKeys = new Set(TOGGLE_COLUMN_GROUPS[0].columns.map((c) => c.key));
  }
}

function saveColumnPrefs() {
  chrome.storage.local.set({ ghinColumnPrefs: [...visibleColumnKeys] });
}

function applyColumnVisibility(container) {
  // an inline "" doesn't override the .detail-col{display:none} stylesheet
  // rule - it just clears the inline value, so the class rule wins either
  // way. Needs an explicit inline value to actually show the cell again.
  for (const node of container.querySelectorAll("[data-col]")) {
    node.style.display = visibleColumnKeys.has(node.dataset.col) ? "table-cell" : "none";
  }
}

function buildColumnMenu() {
  const details = el("details", { className: "col-menu" });
  details.appendChild(el("summary", { text: "Columns" }));
  const body = el("div", { className: "col-menu-body" });

  function commitVisibilityChange() {
    saveColumnPrefs();
    applyColumnVisibility(document.getElementById("diff-table-holder"));
  }

  // group select-alls flip to indeterminate when partially checked, and the
  // global one reflects the state across every group at once.
  const globalSelectAll = el("input", { attrs: { type: "checkbox" } });
  const globalLabel = el("label", { className: "col-menu-item col-menu-select-all" }, [
    globalSelectAll,
    el("span", { text: "Select All" }),
  ]);
  body.appendChild(globalLabel);

  const groups = []; // { selectAllCheckbox, entries: [{checkbox, key}] }

  function refreshSelectAllStates() {
    for (const g of groups) {
      const checkedCount = g.entries.filter((e) => e.checkbox.checked).length;
      g.selectAllCheckbox.checked = checkedCount === g.entries.length;
      g.selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < g.entries.length;
    }
    const allEntries = groups.flatMap((g) => g.entries);
    const totalChecked = allEntries.filter((e) => e.checkbox.checked).length;
    globalSelectAll.checked = totalChecked === allEntries.length;
    globalSelectAll.indeterminate = totalChecked > 0 && totalChecked < allEntries.length;
  }

  for (const group of TOGGLE_COLUMN_GROUPS) {
    const groupSelectAll = el("input", { attrs: { type: "checkbox" } });
    const groupHeader = el("div", { className: "col-menu-group-header" }, [
      el("span", { className: "col-menu-group", text: group.group }),
      el("label", { className: "col-menu-select-all-inline" }, [groupSelectAll, el("span", { text: "All" })]),
    ]);
    body.appendChild(groupHeader);

    const entries = [];
    for (const col of group.columns) {
      const checkbox = el("input", { attrs: { type: "checkbox", value: col.key } });
      checkbox.checked = visibleColumnKeys.has(col.key);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) visibleColumnKeys.add(col.key);
        else visibleColumnKeys.delete(col.key);
        commitVisibilityChange();
        refreshSelectAllStates();
      });
      const label = el("label", { className: "col-menu-item" }, [checkbox, el("span", { text: col.label })]);
      body.appendChild(label);
      entries.push({ checkbox, key: col.key });
    }
    groups.push({ selectAllCheckbox: groupSelectAll, entries });

    groupSelectAll.addEventListener("change", () => {
      const checked = groupSelectAll.checked;
      for (const { checkbox, key } of entries) {
        checkbox.checked = checked;
        if (checked) visibleColumnKeys.add(key);
        else visibleColumnKeys.delete(key);
      }
      commitVisibilityChange();
      refreshSelectAllStates();
    });
  }

  globalSelectAll.addEventListener("change", () => {
    const checked = globalSelectAll.checked;
    for (const g of groups) {
      for (const { checkbox, key } of g.entries) {
        checkbox.checked = checked;
        if (checked) visibleColumnKeys.add(key);
        else visibleColumnKeys.delete(key);
      }
    }
    commitVisibilityChange();
    refreshSelectAllStates();
  });

  refreshSelectAllStates();
  details.appendChild(body);
  return details;
}

// "differential" (default) ranks rounds best-to-worst with a divider after
// the 8 that count; "date" instead sorts newest-first and highlights the
// counting rounds directly, since the divider line doesn't mean anything
// once date order breaks up the ranking.
let diffSortMode = "differential";

function renderDiffSortControls(holder) {
  clearChildren(holder);
  const dateBtn = el("button", { text: "Sort by Date (highlight scoring rounds)" });
  dateBtn.disabled = diffSortMode === "date";
  dateBtn.addEventListener("click", () => {
    diffSortMode = "date";
    render();
  });
  const diffBtn = el("button", { text: "Sort by Differential" });
  diffBtn.disabled = diffSortMode === "differential";
  diffBtn.addEventListener("click", () => {
    diffSortMode = "differential";
    render();
  });
  holder.appendChild(dateBtn);
  holder.appendChild(diffBtn);
}

// mirrors tables.format_scoring_differentials, expanded with every field
// GHIN's scores.json returns behind a "Columns" picker - a curated set is
// checked by default, everything else starts hidden.
function renderScoringDifferentials(container, spread) {
  const columns = ALL_TOGGLE_COLUMNS;
  const rankedRows = rankedScoringDifferentialRows(spread);
  const orderedRows =
    diffSortMode === "date"
      ? [...rankedRows].sort((a, b) => new Date(b.raw.played_at) - new Date(a.raw.played_at))
      : rankedRows;
  const rows = orderedRows.map((r) => ({
    sectionEnd: diffSortMode === "differential" && r.isSectionEnd,
    highlight: diffSortMode === "date" && r.isScoringRound,
    cells: columns.map((col) => {
      const node = col.render(r, spread);
      if (col.key) node.setAttribute("data-col", col.key);
      return node;
    }),
  }));
  const headers = columns.map((col) => (col.key ? { text: col.label, className: DETAIL_COL } : col.label));
  renderDiffSortControls(document.getElementById("diff-sort-holder"));
  const table = buildTable(`Scoring Differentials (${spread.name})`, headers, rows);
  for (const [i, col] of columns.entries()) {
    if (col.key) table.querySelectorAll("thead th")[i]?.setAttribute("data-col", col.key);
  }
  container.appendChild(table);
  applyColumnVisibility(container);
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

async function loadGolfers() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY] || { golfers: {} };
  return Object.values(data.golfers);
}

// background.js learns this from the URL the first time followed_golfers.json
// is seen (passively, or from this feature's own active fetch) - null until
// then, since we have no other way to know the logged-in user's own id.
async function loadMyGolferId() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY]?.myGolferId || null;
}

// a golfer captured only via a followed-golfers list (a name, no scores or
// handicap yet) isn't worth surfacing - only golfers with some real data are.
function hasAnyData(golfer) {
  return Object.keys(golfer.scoresById).length > 0 || golfer.handicap != null;
}

// manual, global exclusion list for individual rounds - the automatic
// which single golfer shows up in the Alternative Handicaps/Statistics/Next
// Round Helpers/Historical tables - same single-select-dropdown pattern as
// the Scoring Differentials and Charts panels use, rather than a
// multi-select filter.
let currentSelectedTopGolferId = null;

function computeAll(golfers) {
  const spreads = [];
  const errors = [];
  for (const g of golfers) {
    if (!hasAnyData(g)) continue;
    const result = computeHandicapSpread(g);
    if (result.error) errors.push(result.error);
    else spreads.push(result);
  }
  return { spreads, errors };
}

function populateGolferSelect(select, spreads, previousValue) {
  clearChildren(select);
  for (const s of sortedSpreads(spreads)) {
    select.appendChild(el("option", { text: `${s.name} (${s.best8Handicap})`, attrs: { value: s.id } }));
  }
  if (spreads.some((s) => s.id === previousValue)) select.value = previousValue;
  return select.value || null;
}

// unlike populateGolferSelect, this lists every golfer with *any* captured
// data - including ones with too few scores for the handicap tables, since
// those are exactly who "fetch full history" is useful for.
const CSV_HEADERS = [
  "Golfer",
  "GHIN Number",
  "Date Played",
  "Course",
  "Holes",
  "Side",
  "Base Differential",
  "Scaled Differential",
  "Adjusted Differential",
  "PCC",
  "Handicap Index",
  "Adjusted Gross Score",
];

// every captured score for every golfer with data - not capped to 20, since
// this is meant as a raw export, not the handicap-math view.
function scoresToRows(golfersWithData) {
  const rows = [];
  for (const g of golfersWithData) {
    const name = g.name || `Golfer ${g.id}`;
    const scores = Object.values(g.scoresById).sort((a, b) => new Date(b.played_at) - new Date(a.played_at));
    for (const s of scores) {
      rows.push([
        name,
        g.id,
        s.played_at ?? "",
        s.ghin_course_name_display ?? "",
        s.number_of_holes ?? "",
        { F9: "Front", B9: "Back" }[s.tee_set_side] ?? s.tee_set_side ?? "",
        s.differential ?? "",
        s.scaled_up_differential ?? "",
        s.adjusted_scaled_up_differential ?? "",
        s.pcc ?? "",
        s.handicap_index ?? "",
        s.adjusted_gross_score ?? "",
      ]);
    }
  }
  return rows;
}

function csvEscape(value) {
  const str = value == null ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { attrs: { href: url, download: filename } });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderCsvPreview(golfersWithData) {
  const holder = document.getElementById("csv-preview-holder");
  clearChildren(holder);
  const rows = scoresToRows(golfersWithData);
  if (!rows.length) {
    holder.appendChild(el("div", { className: "empty-note", text: "No captured scores yet." }));
    return;
  }
  holder.appendChild(buildTable(`Captured Scores (${rows.length})`, CSV_HEADERS, rows.map((r) => ({ cells: r.map((v) => cell(v)) }))));
}

document.getElementById("csv-btn").addEventListener("click", async () => {
  const golfers = await loadGolfers();
  const selected = golfers.filter((g) => String(g.id) === currentSelectedTopGolferId && hasAnyData(g));
  const rows = scoresToRows(selected);
  downloadCsv(`ghin-scores-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(CSV_HEADERS, rows));
});

document.getElementById("csv-all-btn").addEventListener("click", async () => {
  const golfers = await loadGolfers();
  const rows = scoresToRows(golfers.filter(hasAnyData));
  downloadCsv(`ghin-scores-all-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(CSV_HEADERS, rows));
});

// pages through scores.json for the selected golfer using the browser's own
// GHIN.com session - see injected.js. Requires a ghin.com tab to be open,
// since the request has to come from that page's own context to carry auth.
// resolved by the GHIN_FETCH_PROGRESS listener below when a given golfer's
// fetch reports done:true - lets the click handler await one golfer's
// fetch fully finishing before starting the next, instead of firing all of
// them at once (which would interleave progress messages and hammer GHIN's
// API with concurrent year-walks).
const pendingFetchAllByGolfer = new Map();
function waitForFetchAllDone(golferId) {
  return new Promise((resolve) => pendingFetchAllByGolfer.set(golferId, resolve));
}

document.getElementById("fetch-all-btn").addEventListener("click", async () => {
  const fetchStatus = document.getElementById("fetch-status");
  const tabs = await chrome.tabs.query({ url: "https://*.ghin.com/*" });
  if (!tabs.length) {
    fetchStatus.textContent = "Open a ghin.com tab first, then try again.";
    return;
  }
  const golfers = (await loadGolfers()).filter(hasAnyData);
  if (!golfers.length) {
    fetchStatus.textContent = "No golfers captured yet.";
    return;
  }

  for (const [index, golfer] of golfers.entries()) {
    const golferId = String(golfer.id);
    const golferLabel = golfer.name || `Golfer ${golferId}`;
    // when we already know when this golfer's GHIN account was created (from
    // a captured account_info/search.json response), skip walking back past it.
    const startYear = golfer.createdAt ? new Date(golfer.createdAt).getFullYear() : undefined;

    fetchStatus.textContent = `Fetching ${golferLabel} (${index + 1}/${golfers.length})...`;
    try {
      const donePromise = waitForFetchAllDone(golferId);
      await chrome.tabs.sendMessage(tabs[0].id, { type: "GHIN_FETCH_ALL", golferId, startYear });
      await donePromise;
    } catch {
      fetchStatus.textContent = `Couldn't reach the ghin.com tab while fetching ${golferLabel} - try reloading it.`;
      return;
    }
  }
  fetchStatus.textContent = `Done - fetched full history for ${golfers.length} golfer(s).`;
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "GHIN_FETCH_PROGRESS") return;
  const fetchStatus = document.getElementById("fetch-status");
  if (message.error) {
    fetchStatus.textContent = `Fetch failed after ${message.fetched} round(s): ${message.error}`;
  } else if (message.done) {
    fetchStatus.textContent = `Done with this golfer - fetched ${message.fetched} round(s) across all years found.`;
  } else {
    fetchStatus.textContent = `Fetching... ${message.fetched} round(s) so far (currently on ${message.year}).`;
  }
  if (message.done) {
    const resolve = pendingFetchAllByGolfer.get(message.golferId);
    if (resolve) {
      pendingFetchAllByGolfer.delete(message.golferId);
      resolve();
    }
  }
});

// unlike fetch-all (which loops golfer-by-golfer FROM the side panel over an
// already-known list), the followed-golfers list itself is only discovered
// inside injected.js - so this is one round trip for the whole operation,
// not one per golfer, and there's only ever one in flight at a time.
let pendingFollowedAnalysis = null;
function waitForFollowedAnalysisDone() {
  return new Promise((resolve) => (pendingFollowedAnalysis = resolve));
}

document.getElementById("analyze-followed-btn").addEventListener("click", async () => {
  const fetchStatus = document.getElementById("fetch-status");
  const tabs = await chrome.tabs.query({ url: "https://*.ghin.com/*" });
  if (!tabs.length) {
    fetchStatus.textContent = "Open a ghin.com tab first, then try again.";
    return;
  }
  const myGolferId = await loadMyGolferId();
  if (!myGolferId) {
    fetchStatus.textContent = 'Visit your "Followed Golfers" page on GHIN.com once so the extension learns your account, then try again.';
    return;
  }
  fetchStatus.textContent = "Looking up your followed golfers...";
  try {
    const donePromise = waitForFollowedAnalysisDone();
    await chrome.tabs.sendMessage(tabs[0].id, { type: "GHIN_ANALYZE_FOLLOWED", myGolferId });
    await donePromise;
  } catch {
    fetchStatus.textContent = "Couldn't reach the ghin.com tab - try reloading it.";
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "GHIN_FOLLOWED_PROGRESS") return;
  const fetchStatus = document.getElementById("fetch-status");
  if (message.error) {
    fetchStatus.textContent = `Analyze All Followed Golfers failed: ${message.error}`;
  } else if (message.done) {
    fetchStatus.textContent = `Done - analyzed ${message.total} followed golfer(s).`;
  } else {
    fetchStatus.textContent = `Analyzing ${message.currentName} (${message.completed + 1}/${message.total})...`;
  }
  if (message.done && pendingFollowedAnalysis) {
    pendingFollowedAnalysis();
    pendingFollowedAnalysis = null;
  }
});

// Scoring Differentials, Charts, and Next Round Helpers no longer have their
// own per-panel golfer pickers - they all follow currentSelectedTopGolferId.
let compareAllGolfers = false;

// background.js only retries the automatic name backfill from inside
// handleCapture - i.e. only when a *new* network response comes in. Just
// opening/refreshing the side panel captures nothing new, so a golfer whose
// very first backfill attempt failed silently (no ghin.com tab yet, auth
// header not snooped yet) could stay nameless indefinitely until the user
// happened to trigger a fresh capture themselves (e.g. visiting GHIN's own
// golfer lookup page). The side panel now retries independently on its own
// cooldown instead of only reacting to captures.
const nameBackfillAttempts = new Map(); // golferId -> last attempt timestamp
const NAME_BACKFILL_RETRY_MS = 10000;

async function retryNameBackfillIfNeeded(golfersWithData) {
  const now = Date.now();
  const needsName = golfersWithData.filter((g) => {
    if (g.name) return false;
    const last = nameBackfillAttempts.get(String(g.id));
    return !last || now - last > NAME_BACKFILL_RETRY_MS;
  });
  if (!needsName.length) return;
  const tabs = await chrome.tabs.query({ url: "https://*.ghin.com/*" });
  console.log(
    "[GHIN-EXT] retryNameBackfillIfNeeded: golfers needing a name:",
    needsName.map((g) => g.id),
    "ghin.com tabs found:",
    tabs.length
  );
  if (!tabs.length) return;
  for (const g of needsName) {
    nameBackfillAttempts.set(String(g.id), now);
    chrome.tabs
      .sendMessage(tabs[0].id, { type: "GHIN_FETCH_NAME", golferId: String(g.id) })
      .then(() => console.log("[GHIN-EXT] GHIN_FETCH_NAME message delivered for", g.id))
      .catch((e) => console.warn("[GHIN-EXT] GHIN_FETCH_NAME message failed for", g.id, e));
  }
}

async function render() {
  const golfers = await loadGolfers();
  const golfersById = Object.fromEntries(golfers.map((g) => [String(g.id), g]));
  const { spreads, errors } = computeAll(golfers);

  const golfersWithData = golfers.filter(hasAnyData);
  retryNameBackfillIfNeeded(golfersWithData);
  const status = document.getElementById("status");
  const golferWord = golfersWithData.length === 1 ? "golfer" : "golfers";
  status.textContent = `${golfersWithData.length} ${golferWord} with data, ${spreads.length} with enough for tables`;
  status.title = errors.join("\n");

  const rawErrors = document.getElementById("raw-errors");
  clearChildren(rawErrors);
  if (errors.length) {
    rawErrors.appendChild(el("div", { text: "Why some golfers aren't showing in the tables yet:" }));
    for (const e of errors) rawErrors.appendChild(el("div", { className: "empty-note", text: `- ${e}` }));
  }

  currentSelectedTopGolferId = populateGolferSelect(
    document.getElementById("golfer-visibility-select"),
    spreads,
    currentSelectedTopGolferId
  );
  const selectedSpread = spreads.find((s) => s.id === currentSelectedTopGolferId) || null;
  const selectedGolfer = selectedSpread ? golfersById[selectedSpread.id] : null;
  const selectedSpreads = selectedSpread ? [selectedSpread] : [];
  // Compare only widens the Alternative Handicaps tab (Alt Handicaps,
  // Statistics, Streaks, Historical) to every golfer at once - Next Round
  // Helpers, Scoring Differentials, Charts, and Raw Data always stay scoped
  // to the single golfer picked up top.
  const altVisibleSpreads = compareAllGolfers ? spreads : selectedSpreads;

  renderCsvPreview(selectedGolfer && hasAnyData(selectedGolfer) ? [selectedGolfer] : []);

  const altPanel = document.getElementById("panel-alt");
  const nextPanel = document.getElementById("next-table-holder");
  clearChildren(altPanel);
  clearChildren(nextPanel);

  if (!spreads.length) {
    const note = "Browse GHIN.com (your dashboard, score history, and followed golfers) to capture data.";
    altPanel.appendChild(el("div", { className: "empty-note", text: note }));
    nextPanel.appendChild(el("div", { className: "empty-note", text: note }));
  } else {
    altPanel.appendChild(renderCompareToggle());
    renderAlternativeHandicaps(altPanel, altVisibleSpreads);
    renderStatistics(altPanel, altVisibleSpreads);
    renderStreakDetailsSection(altPanel, altVisibleSpreads);
    renderHistorical(altPanel, altVisibleSpreads);
    renderNextRoundHelpers(nextPanel, selectedSpreads);
  }

  renderDiffPanel(selectedSpread);
  renderChartsPanel(selectedSpread, golfersById);
}

function renderCompareToggle() {
  const checkbox = el("input", { attrs: { type: "checkbox" } });
  checkbox.checked = compareAllGolfers;
  checkbox.addEventListener("change", () => {
    compareAllGolfers = checkbox.checked;
    render();
  });
  return el("div", { className: "diff-controls compare-toggle-row" }, [
    el("label", { className: "checkbox-label" }, [checkbox, el("span", { text: "Compare all golfers" })]),
  ]);
}

function renderDiffPanel(spread) {
  const holder = document.getElementById("diff-table-holder");
  clearChildren(holder);
  if (!spread) {
    holder.appendChild(el("div", { className: "empty-note", text: "No golfer has enough captured scores yet." }));
    return;
  }
  renderScoringDifferentials(holder, spread);
}

// toggle state lives here (in JS), not on persistent DOM checkboxes - each
// chart's controls are rebuilt fresh right above it on every render, so a
// checkbox bound once at load time would go stale the moment its element
// gets replaced.
let chartShowDifferential = true;
let chartShowHandicap = true;
let chartShowUnadjusted9Hole = false;

async function rerenderChartsPanel() {
  const golfers = await loadGolfers();
  const golfersById = Object.fromEntries(golfers.map((g) => [String(g.id), g]));
  const { spreads } = computeAll(golfers);
  const spread = spreads.find((s) => s.id === currentSelectedTopGolferId) || null;
  renderChartsPanel(spread, golfersById);
}

function chartCheckboxRow(options) {
  const row = el("div", { className: "diff-controls chart-toggle-row" });
  for (const { checked, text, onChange } of options) {
    const checkbox = el("input", { attrs: { type: "checkbox" } });
    checkbox.checked = checked;
    checkbox.addEventListener("change", () => {
      onChange(checkbox.checked);
      rerenderChartsPanel();
    });
    row.appendChild(el("label", { className: "checkbox-label" }, [checkbox, el("span", { text })]));
  }
  return row;
}

// two charts: scoring differentials vs handicap index over time (each
// series independently toggleable), and 9-hole vs 18-hole differentials
// (so you can tell whether you're actually playing to a different level
// depending on hole count). Uses every captured score by default, not just
// the 20 used for handicap math, so the trend has more history than the
// tables do. Each chart's toggles sit directly above it, not grouped
// together at the top of the panel.
function renderChartsPanel(spread, golfersById) {
  const holder = document.getElementById("charts-holder");
  clearChildren(holder);
  if (!spread) {
    holder.appendChild(el("div", { className: "empty-note", text: "No golfer has enough captured scores yet." }));
    return;
  }
  const golfer = golfersById[spread.id];
  const range = document.getElementById("chart-range-select").value;
  const rangeLabel = { last20: "Last 20 Rounds", calendarYear: "Calendar Year", allTime: "All Time" }[range];

  // --- chart 1: scoring differentials vs handicap index ---
  const series = buildTimeSeries(golfer, range);
  holder.appendChild(
    chartCheckboxRow([
      { checked: chartShowDifferential, text: "Differential", onChange: (v) => (chartShowDifferential = v) },
      { checked: chartShowHandicap, text: "Handicap Index", onChange: (v) => (chartShowHandicap = v) },
    ])
  );
  renderComboChart(holder, {
    title: `Scoring Differentials vs Handicap Index (${spread.name}, ${rangeLabel})`,
    dates: series.dates,
    barValues: series.differentials,
    barLabel: "Differential",
    lineValues: series.handicaps,
    lineLabel: "Handicap Index",
    showBars: chartShowDifferential,
    showLine: chartShowHandicap,
  });

  // --- chart 2: 9-hole vs 18-hole differentials ---
  const holeTypeSeries = buildHoleTypeSeries(golfer, range);
  if (!holeTypeSeries.dates.length) {
    holder.appendChild(el("div", { className: "empty-note", text: `No rounds in this range (${rangeLabel}).` }));
    return;
  }
  holder.appendChild(
    chartCheckboxRow([
      {
        checked: chartShowUnadjusted9Hole,
        text: "Show unadjusted 9-hole differentials",
        onChange: (v) => (chartShowUnadjusted9Hole = v),
      },
    ])
  );
  const holeTypeChartSeries = [
    { values: holeTypeSeries.nineHoleDifferentials, label: "9-Hole", color: CHART_COLORS.series1 },
    { values: holeTypeSeries.eighteenHoleDifferentials, label: "18-Hole", color: CHART_COLORS.series2 },
  ];
  if (chartShowUnadjusted9Hole) {
    holeTypeChartSeries.push({
      values: holeTypeSeries.nineHoleUnadjustedDifferentials,
      label: "9-Hole (Unadjusted)",
      color: CHART_COLORS.series3,
    });
  }
  renderMultiLineChart(holder, {
    title: `9-Hole vs 18-Hole Differentials (${spread.name}, ${rangeLabel})`,
    dates: holeTypeSeries.dates,
    series: holeTypeChartSeries,
  });
}

document.getElementById("chart-range-select").addEventListener("change", rerenderChartsPanel);

// --- "What If?" round simulator ---
// Course search/tee-lookup response shapes are unverified (GHIN gave no
// public schema and we can't test live from here) - every field access
// below tries several plausible name variants and the raw response is
// always dumped to the debug <pre> so a wrong guess is a one-line fix
// instead of a mystery.
let whatifRequestCounter = 0;
// keyed by requestId rather than a single slot - proximity sorting fires a
// course-details lookup (for the last-played course's coordinates)
// alongside the search itself, so more than one request can be in flight.
const whatifPendingRequests = new Map();
let whatifTeeOptions = [];

function nextWhatifRequestId() {
  return `whatif-${++whatifRequestCounter}`;
}

function showWhatifDebug(data, error) {
  document.getElementById("whatif-debug-json").textContent = JSON.stringify(error ? { error } : data, null, 2);
}

async function sendWhatifApiRequest(tabMessage) {
  const tabs = await chrome.tabs.query({ url: "https://*.ghin.com/*" });
  if (!tabs.length) throw new Error("Open a ghin.com tab first, then try again.");
  const requestId = nextWhatifRequestId();
  const resultPromise = new Promise((resolve, reject) => {
    whatifPendingRequests.set(requestId, { resolve, reject });
  });
  await chrome.tabs.sendMessage(tabs[0].id, { ...tabMessage, requestId });
  return resultPromise;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "GHIN_API_RESULT") return;
  const pending = whatifPendingRequests.get(message.requestId);
  if (!pending) return;
  whatifPendingRequests.delete(message.requestId);
  // with concurrent requests the debug pane just shows whichever resolves
  // last - it's a debugging aid, not load-bearing, so that's fine.
  showWhatifDebug(message.data, message.error);
  if (message.error) pending.reject(new Error(message.error));
  else pending.resolve(message.data);
});

// unverified field names, same caveat as everywhere else in this feature -
// tries the common ASP.NET PascalCase and snake_case variants for lat/lon.
function extractCoords(obj) {
  if (!obj || typeof obj !== "object") return null;
  const lat = obj.Latitude ?? obj.GeoLocationLatitude ?? obj.Lat ?? obj.lat ?? obj.latitude;
  const lon = obj.Longitude ?? obj.GeoLocationLongitude ?? obj.Lon ?? obj.Lng ?? obj.lon ?? obj.lng ?? obj.longitude;
  if (lat == null || lon == null) return null;
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  return Number.isNaN(latNum) || Number.isNaN(lonNum) ? null : { lat: latNum, lon: lonNum };
}

function normalizeCourseSearchResults(json) {
  const list = Array.isArray(json) ? json : json?.courses || json?.Courses || json?.CourseList || [];
  return list
    .map((c) => ({
      id: c.CourseID ?? c.CourseId ?? c.course_id ?? c.Id ?? c.id,
      name: c.CourseName ?? c.FullName ?? c.course_name ?? c.Name ?? c.name ?? "Unknown course",
      facility: c.FacilityName ?? c.facility_name ?? "",
      city: c.City ?? c.city ?? "",
      state: c.State ?? c.state ?? "",
      coords: extractCoords(c),
    }))
    .filter((c) => c.id != null);
}

// looks up the coordinates of the golfer's single most-recently-played
// course (from already-captured scores, no extra request for that part),
// then a GetCourseDetails call for that course's own coordinates - used to
// sort search results by "closest to where you actually play."  Returns
// null (never throws) on any failure so proximity sorting just quietly
// isn't available rather than breaking the search itself.
async function getLastPlayedCourseCoords(golferId) {
  try {
    const golfers = await loadGolfers();
    const golfer = golfers.find((g) => String(g.id) === golferId);
    const scores = Object.values(golfer?.scoresById || {}).filter((s) => s.played_at && s.course_id);
    if (!scores.length) return null;
    scores.sort((a, b) => new Date(b.played_at) - new Date(a.played_at));
    const data = await sendWhatifApiRequest({ type: "GHIN_GET_COURSE_DETAILS", courseId: scores[0].course_id });
    // confirmed shape: coordinates live under Facility, not the top level.
    return extractCoords(data?.Facility) ?? extractCoords(data) ?? extractCoords(data?.courses?.[0]) ?? null;
  } catch (e) {
    console.warn("[GHIN-EXT] couldn't determine last-played course location", e);
    return null;
  }
}

function sortCoursesByProximity(courses, originCoords) {
  if (!originCoords) return courses;
  const distanceOf = (c) => (c.coords ? haversineDistanceMiles(originCoords.lat, originCoords.lon, c.coords.lat, c.coords.lon) : Infinity);
  return [...courses].sort((a, b) => distanceOf(a) - distanceOf(b));
}

// GetCourseDetails.json's real (confirmed) shape: { Facility: {...},
// TeeSets: [{ TeeSetRatingId, TeeSetRatingName, Gender, HolesNumber,
// Ratings: [{RatingType: "Total"|"Front"|"Back", CourseRating,
// SlopeRating}] }] }. course_handicaps.json's shape is still unverified, so
// that path keeps the defensive guessing.
function normalizeTeeSets(json) {
  if (Array.isArray(json?.TeeSets)) {
    return json.TeeSets.map((t) => {
      const ratings = t.Ratings || [];
      const byType = (type) => ratings.find((r) => r.RatingType === type);
      const total = byType("Total");
      const front = byType("Front");
      const back = byType("Back");
      const holes = Array.isArray(t.Holes) ? t.Holes : [];
      const parFront = holes.filter((h) => h.Number <= 9).reduce((sum, h) => sum + (h.Par || 0), 0) || null;
      const parBack = holes.filter((h) => h.Number > 9).reduce((sum, h) => sum + (h.Par || 0), 0) || null;
      return {
        id: t.TeeSetRatingId,
        name: t.TeeSetRatingName || "Tee",
        gender: t.Gender || null,
        holes: t.HolesNumber ?? 18,
        rating: total?.CourseRating,
        slope: total?.SlopeRating,
        frontRating: front?.CourseRating,
        frontSlope: front?.SlopeRating,
        backRating: back?.CourseRating,
        backSlope: back?.SlopeRating,
        courseHandicap: null,
        parTotal: t.TotalPar ?? (parFront != null && parBack != null ? parFront + parBack : null),
        parFront,
        parBack,
      };
    }).filter((t) => t.rating != null && t.slope != null);
  }

  const listKey = ["Tees", "tee_sets", "CourseTeeSets"].find((k) => Array.isArray(json?.[k]));
  const list = Array.isArray(json) ? json : listKey ? json[listKey] : json && typeof json === "object" ? [json] : [];
  return list
    .map((t) => ({
      id: t.TeeSetId ?? t.TeeSetRatingId ?? t.tee_set_id ?? t.Id ?? t.id ?? null,
      name: t.TeeSetRatingName ?? t.TeeName ?? t.tee_name ?? t.Name ?? t.name ?? "Tee",
      holes: t.NumberOfHoles ?? t.number_of_holes ?? 18,
      rating: t.CourseRating18Holes ?? t.CourseRating ?? t.Rating18 ?? t.course_rating ?? t.Rating ?? t.rating,
      slope: t.SlopeRating18Holes ?? t.SlopeRating ?? t.Slope18 ?? t.slope_rating ?? t.Slope ?? t.slope,
      courseHandicap: t.CourseHandicap ?? t.course_handicap ?? null,
    }))
    .filter((t) => t.rating != null && t.slope != null);
}

// splits each tee-set record into its selectable 18-hole/Front-9/Back-9
// options, each carrying the rating/slope that actually applies to it -
// more accurate than approximating a 9-hole differential from the 18-hole
// total, now that GetCourseDetails hands us the real per-9 ratings.
function expandTeeOptions(teeSets) {
  const options = [];
  for (const t of teeSets) {
    if (t.rating != null && t.slope != null) {
      options.push({ name: t.name, holes: 18, rating: t.rating, slope: t.slope, courseHandicap: t.courseHandicap });
    }
    if (t.frontRating != null && t.frontSlope != null) {
      options.push({ name: `${t.name} - Front 9`, holes: 9, rating: t.frontRating, slope: t.frontSlope, courseHandicap: null });
    }
    if (t.backRating != null && t.backSlope != null) {
      options.push({ name: `${t.name} - Back 9`, holes: 9, rating: t.backRating, slope: t.backSlope, courseHandicap: null });
    }
  }
  return options;
}

function renderCourseResults(courses, originCoords) {
  const holder = document.getElementById("whatif-course-results");
  clearChildren(holder);
  if (!courses.length) {
    holder.appendChild(
      el("div", {
        className: "empty-note",
        text: "No courses found - or the response shape didn't match what we guessed. Check the debug JSON below.",
      })
    );
    return;
  }
  for (const c of courses.slice(0, 25)) {
    const distance = originCoords && c.coords ? haversineDistanceMiles(originCoords.lat, originCoords.lon, c.coords.lat, c.coords.lon) : null;
    const metaParts = [c.facility, c.city, c.state].filter(Boolean);
    if (distance != null) metaParts.push(`${distance.toFixed(1)} mi`);
    const row = el("div", { className: "course-result" }, [
      el("span", { text: c.name }),
      el("span", { className: "course-result-meta", text: metaParts.join(", ") }),
    ]);
    row.addEventListener("click", () => selectWhatifCourse(c));
    holder.appendChild(row);
  }
}

// value is the array index into `tees` - Front-9/Back-9 options share a
// base tee id, so index is the only reliably unique key here. Grouped by
// hole count since that's how the auto-generated tables above are grouped.
function populateTeeSelect(tees) {
  const select = document.getElementById("whatif-tee-select");
  clearChildren(select);
  const groups = [
    { label: "18 Holes", filter: (t) => t.holes === 18 },
    { label: "9 Holes (Front/Back)", filter: (t) => t.holes !== 18 },
  ];
  for (const group of groups) {
    const optionEls = tees
      .map((t, i) => (group.filter(t) ? el("option", { text: `${t.name} (${fmt1(t.rating)}/${t.slope})`, attrs: { value: i } }) : null))
      .filter(Boolean);
    if (!optionEls.length) continue;
    const optgroup = el("optgroup", { attrs: { label: group.label } }, optionEls);
    select.appendChild(optgroup);
  }
}

// GHIN scores carry "M"/"F"; GetCourseDetails' tee sets say "Male"/"Female" -
// map between them so tees can be filtered to the golfer's own gender
// instead of showing both and making the user guess which applies.
const GENDER_CODE_TO_TEE_GENDER = { M: "Male", F: "Female" };

async function getGolferGender(golferId) {
  const golfers = await loadGolfers();
  const golfer = golfers.find((g) => String(g.id) === golferId);
  const withGender = Object.values(golfer?.scoresById || {}).find((s) => s.gender);
  return GENDER_CODE_TO_TEE_GENDER[withGender?.gender] || null;
}

// mirrors tables._build_next_round_helpers_table's differentialToLower*
// fields, converted to actual scores per tee/hole-group instead of a bare
// differential number.
function toParText(score, par) {
  if (par == null) return "";
  const delta = score - par;
  return ` (${delta === 0 ? "E" : delta > 0 ? `+${delta}` : delta})`;
}

function renderWhatifTables(holder, spread, tees) {
  clearChildren(holder);
  const groups = [
    { label: "18 Holes", holes: 18, ratingKey: "rating", slopeKey: "slope", parKey: "parTotal" },
    { label: "Front 9", holes: 9, ratingKey: "frontRating", slopeKey: "frontSlope", parKey: "parFront" },
    { label: "Back 9", holes: 9, ratingKey: "backRating", slopeKey: "backSlope", parKey: "parBack" },
  ];
  let renderedAny = false;
  for (const group of groups) {
    const rows = [];
    const par = tees.map((t) => t[group.parKey]).find((p) => p != null) ?? null;
    for (const t of tees) {
      const rating = t[group.ratingKey];
      const slope = t[group.slopeKey];
      if (rating == null || slope == null) continue;

      let expectedDiff = spread.best8Handicap;
      let to05Diff = spread.differentialToLowerByPointFive;
      let to1Diff = spread.differentialToLowerByOne;
      if (group.holes === 9) {
        expectedDiff = nineHoleBaseFromScaledDifferential(expectedDiff, spread.best8Handicap);
        to05Diff = nineHoleBaseFromScaledDifferential(to05Diff, spread.best8Handicap);
        to1Diff = nineHoleBaseFromScaledDifferential(to1Diff, spread.best8Handicap);
      }
      const expectedScore = expectedScoreFromDifferential(expectedDiff, rating, slope);
      const to05Score = scoreThresholdFromDifferential(to05Diff, rating, slope);
      const to1Score = scoreThresholdFromDifferential(to1Diff, rating, slope);
      rows.push({
        cells: [
          cell(t.name),
          cell(`${fmt1(rating)}/${slope}`),
          cell(`${expectedScore}${toParText(expectedScore, par)}`),
          cell(`${to05Score}${toParText(to05Score, par)}`),
          cell(`${to1Score}${toParText(to1Score, par)}`),
        ],
      });
    }
    if (!rows.length) continue;
    renderedAny = true;
    const title = par != null ? `${group.label} (Par ${par})` : group.label;
    holder.appendChild(
      buildTable(title, ["Tee", "Rating/Slope", "Expected Score", "Score to Improve .5", "Score to Improve 1"], rows)
    );
    if (group.holes === 9) {
      holder.appendChild(
        el("div", {
          className: "empty-note",
          text:
            "9-hole figures use a formula GHIN doesn't document publicly - validated against this golfer's own past rounds (avg error 0.11), close but not a guarantee. See NINE_HOLE_FORMULA_VALIDATION.md.",
        })
      );
    }
  }
  if (!renderedAny) {
    holder.appendChild(
      el("div", { className: "empty-note", text: "No tee rating/slope data available - check the debug JSON below." })
    );
  }
}

async function selectWhatifCourse(course) {
  const status = document.getElementById("whatif-status");
  document.getElementById("whatif-manual-controls").classList.add("hidden");
  clearChildren(document.getElementById("whatif-result"));
  clearChildren(document.getElementById("whatif-tables-holder"));

  // picking a course settles the search - drop the other options and
  // surface which course is now active instead.
  clearChildren(document.getElementById("whatif-course-results"));
  const title = document.getElementById("whatif-course-title");
  title.textContent = [course.name, [course.city, course.state].filter(Boolean).join(", ")].filter(Boolean).join(" — ");
  title.classList.remove("hidden");

  status.textContent = "Loading tee details...";

  const golferId = currentSelectedTopGolferId;
  const playedAt = new Date().toISOString().slice(0, 10);

  try {
    // course_handicaps.json is tried first - if it works, it should give us
    // this golfer's actual course handicap alongside the rating/slope, in
    // one call. Falls back to GetCourseDetails (which should list every tee
    // at the course) if that call errors or its shape doesn't parse.
    let data = await sendWhatifApiRequest({
      type: "GHIN_GET_COURSE_HANDICAPS",
      courseId: course.id,
      golferId,
      playedAt,
    }).catch((e) => {
      console.warn("[GHIN-EXT] course_handicaps lookup failed, falling back to GetCourseDetails", e);
      return null;
    });
    let tees = data ? normalizeTeeSets(data) : [];
    if (!tees.length) {
      data = await sendWhatifApiRequest({ type: "GHIN_GET_COURSE_DETAILS", courseId: course.id });
      tees = normalizeTeeSets(data);
    }
    const golferGender = await getGolferGender(golferId);
    const genderFiltered = golferGender ? tees.filter((t) => !t.gender || t.gender === golferGender) : tees;
    const finalTees = genderFiltered.length ? genderFiltered : tees;

    const golfers = await loadGolfers();
    const { spreads } = computeAll(golfers);
    const spread = spreads.find((s) => s.id === golferId);

    if (!finalTees.length) {
      status.textContent = "Couldn't find tee rating/slope data in the response - check the debug JSON below.";
      return;
    }
    if (!spread) {
      status.textContent = "This golfer doesn't have enough data yet for a simulation.";
      return;
    }

    renderWhatifTables(document.getElementById("whatif-tables-holder"), spread, finalTees);
    whatifTeeOptions = expandTeeOptions(finalTees);
    populateTeeSelect(whatifTeeOptions);
    document.getElementById("whatif-manual-controls").classList.remove("hidden");
    status.textContent = "";
  } catch (e) {
    status.textContent = `Lookup failed: ${e.message}`;
  }
}

function renderWhatifResult(holder, tee, score, sim, baseNineHoleDifferential) {
  const card = el("div", { className: "whatif-result-card" });
  const rows = [["Tee", `${tee.name} (${fmt1(tee.rating)}/${tee.slope})`], ["Gross Score", String(score)]];
  if (baseNineHoleDifferential != null) {
    rows.push(
      ["9-Hole Differential", fmt1(baseNineHoleDifferential)],
      ["+ Expected 2nd-9 (0.52 x Index + 1.2)", `+${fmt1(sim.newDifferential - baseNineHoleDifferential)}`]
    );
  }
  rows.push(
    ["Hypothetical 18-Hole Differential", fmt1(sim.newDifferential)],
    ["Current Index (recomputed)", fmt1(sim.recomputedCurrentHandicap)],
    ["Projected Index", fmt1(sim.projectedHandicap)],
    ["Change", `${sim.changeFromRecomputedCurrent > 0 ? "+" : ""}${fmt1(sim.changeFromRecomputedCurrent)}`]
  );
  if (tee.courseHandicap != null) rows.push(["Your Course Handicap Here", String(tee.courseHandicap)]);
  for (const [label, value] of rows) {
    card.appendChild(el("div", { className: "whatif-result-row" }, [el("span", { text: label }), el("span", { text: value })]));
  }
  card.appendChild(
    el("div", {
      className: "empty-note",
      text:
        baseNineHoleDifferential != null
          ? "Assumes PCC = 0. 9-hole scaling is speculative - GHIN doesn't document it publicly. Based on this golfer's own past rounds it's pretty close (avg error 0.11) but not a guarantee."
          : "Assumes PCC = 0 (only knowable after a round is actually played).",
    })
  );
  holder.appendChild(card);
}

document.getElementById("whatif-search-btn").addEventListener("click", async () => {
  const status = document.getElementById("whatif-status");
  const query = document.getElementById("whatif-course-search").value.trim();
  if (!query) return;
  status.textContent = "Searching...";
  clearChildren(document.getElementById("whatif-course-results"));
  document.getElementById("whatif-manual-controls").classList.add("hidden");
  document.getElementById("whatif-course-title").classList.add("hidden");
  clearChildren(document.getElementById("whatif-result"));
  clearChildren(document.getElementById("whatif-tables-holder"));
  const golferId = currentSelectedTopGolferId;
  try {
    const [data, originCoords] = await Promise.all([
      sendWhatifApiRequest({ type: "GHIN_SEARCH_COURSES", query }),
      getLastPlayedCourseCoords(golferId),
    ]);
    const results = sortCoursesByProximity(normalizeCourseSearchResults(data), originCoords);
    renderCourseResults(results, originCoords);
    status.textContent = originCoords ? "Sorted by distance from your last-played course." : "";
  } catch (e) {
    status.textContent = `Search failed: ${e.message}`;
  }
});

document.getElementById("whatif-course-search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("whatif-search-btn").click();
});

document.getElementById("whatif-calculate-btn").addEventListener("click", async () => {
  const resultHolder = document.getElementById("whatif-result");
  clearChildren(resultHolder);
  const teeSelect = document.getElementById("whatif-tee-select");
  const tee = whatifTeeOptions[Number(teeSelect.value)];
  const score = parseFloat(document.getElementById("whatif-score-input").value);
  if (!tee || Number.isNaN(score)) {
    resultHolder.appendChild(el("div", { className: "empty-note", text: "Pick a tee and enter a score first." }));
    return;
  }
  const golferId = currentSelectedTopGolferId;
  const golfers = await loadGolfers();
  const { spreads } = computeAll(golfers);
  const spread = spreads.find((s) => s.id === golferId);
  if (!spread) {
    resultHolder.appendChild(el("div", { className: "empty-note", text: "This golfer doesn't have enough data yet for a simulation." }));
    return;
  }
  const baseDifferential = differentialFromScore(score, tee.rating, tee.slope);
  const isNineHole = tee.holes && tee.holes !== 18;
  const differential = isNineHole ? nineHoleScaledDifferential(baseDifferential, spread.best8Handicap) : baseDifferential;
  renderWhatifResult(resultHolder, tee, score, simulateNextRoundHandicap(spread, differential), isNineHole ? baseDifferential : null);
});

document.getElementById("clear-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "GHIN_CLEAR" });
});

// debug-only UI (the raw API response viewer) is only useful while
// developing this extension against unverified GHIN endpoints - hide it
// once this is ever actually distributed via the Chrome Web Store.
// getSelf() is specifically exempted from needing the "management"
// permission, so no manifest change is needed for this.
chrome.management.getSelf((info) => {
  if (info.installType === "development") return;
  for (const node of document.querySelectorAll(".dev-only")) node.style.display = "none";
});

for (const btn of document.querySelectorAll(".tab-btn")) {
  btn.addEventListener("click", () => {
    for (const b of document.querySelectorAll(".tab-btn")) b.classList.remove("active");
    for (const p of document.querySelectorAll(".panel")) p.classList.remove("active");
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) render();
});

// native <details> only closes on a second click of its own <summary> - this
// adds the click-outside-to-close behavior a dropdown is expected to have,
// for the Columns/Golfers popups (anything using the .col-menu pattern).
document.addEventListener("click", (e) => {
  for (const details of document.querySelectorAll("details.col-menu[open]")) {
    if (!details.contains(e.target)) details.removeAttribute("open");
  }
});

document.getElementById("golfer-visibility-select").addEventListener("change", () => {
  currentSelectedTopGolferId = document.getElementById("golfer-visibility-select").value;
  render();
});

document.getElementById("refresh-ghin-btn").addEventListener("click", async () => {
  const fetchStatus = document.getElementById("fetch-status");
  const tabs = await chrome.tabs.query({ url: "https://*.ghin.com/*" });
  if (!tabs.length) {
    fetchStatus.textContent = "Open a ghin.com tab first, then try again.";
    return;
  }
  await chrome.tabs.reload(tabs[0].id);
  fetchStatus.textContent = "Refreshed the ghin.com tab.";
});

(async () => {
  await loadColumnPrefs();
  document.getElementById("col-menu-holder").appendChild(buildColumnMenu());
  document.getElementById("panel-definitions").appendChild(buildDefinitionsPanel());
  render();
})();
