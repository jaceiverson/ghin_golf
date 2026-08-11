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

// mirrors tables._colorize_consistency_score
function colorizeConsistency(pct) {
  const cls = pct < 50 ? "clr-red" : pct < 75 ? "clr-yellow" : "clr-green";
  return { text: `${pct.toFixed(1)}%`, cls };
}

// mirrors tables._colorize_worst_potential_handicap
function colorizeWorstPotential(worst, best8) {
  const change = worst - best8;
  const cls = change === 0 ? "clr-green" : change < 1 ? "clr-yellow" : "clr-red";
  return { text: fmt1(worst), cls };
}

// mirrors tables._colorize_scoring_differential
function colorizeDifferential(diff, handicap) {
  if (diff == null) return { text: "-", cls: "dash" };
  const cls = Math.abs(diff - handicap) <= 0.5 ? "clr-yellow" : diff < handicap ? "clr-green" : "clr-red";
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
  const headerCells = headers.map((h) =>
    typeof h === "string" ? el("th", { text: h }) : el("th", { text: h.text, className: h.className })
  );
  const thead = el("thead", {}, [el("tr", {}, headerCells)]);
  table.appendChild(thead);
  const tbody = el("tbody");
  for (const row of rows) {
    const tr = el("tr", { className: row.sectionEnd ? "section-end" : "" });
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
    const tr = el("tr", {}, [el("th", { text: rowDef.label, className: "row-label" })]);
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

// mirrors tables._build_statistics_table
function renderStatistics(container, spreads) {
  const sorted = sortedSpreads(spreads);
  container.appendChild(
    buildTransposedTable("Statistics", sorted, [
      { label: "Range", render: (s) => cell(fmt1(s.differentialRange)) },
      { label: "Std Dev", render: (s) => cell(fmt1(s.handicapStdDev)) },
      { label: "Consistency Score", render: (s) => coloredCell(colorizeConsistency(s.consistencyScoreBest8All20)) },
      {
        label: "Carry%",
        render: (s) =>
          cell(
            `${(s.carryPercentage * 100).toFixed(1)}% (${Math.trunc(s.carryPercentage * 7)}/7)`,
            s.carryPercentage > 0.5 ? "clr-red" : "clr-green"
          ),
      },
    ])
  );
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

function excludeButtonCell(scoreId) {
  const btn = el("button", { className: "exclude-btn", text: "Exclude", attrs: { title: "Remove this round from all tables and charts" } });
  btn.addEventListener("click", () => excludeScore(scoreId));
  return el("td", {}, [btn]);
}

// always visible, not part of the toggle picker
const ALWAYS_COLUMNS = [
  { label: "", render: (r) => excludeButtonCell(r.raw.id) },
  { label: "Round", render: (r) => cell(r.rank) },
  { label: "Date", render: (r) => cell(rawText(r.raw.played_at)) },
  { label: "Holes", render: (r) => cell(rawText(r.raw.number_of_holes)) },
  { label: "Course Name", render: (r) => cell(rawText(r.raw.course_name)) },
  { label: "Tee Side", render: (r) => cell(TEE_SIDE_LABELS[r.raw.tee_set_side] || rawText(r.raw.tee_set_side)) },
  { label: "Gross Score", render: (r) => cell(rawText(r.raw.adjusted_gross_score)) },
  { label: "Course Rating", render: (r) => cell(fmt1(r.raw.course_rating)) },
  {
    label: "Adjusted",
    render: (r, spread) => coloredCell(colorizeDifferential(effectiveDifferential(r.raw), spread.best8Handicap)),
  },
];

// everything else in the raw score object, grouped for the column-picker
// popup. Hidden by default - toggled on via the "Columns" menu.
const TOGGLE_COLUMN_GROUPS = [
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

async function loadColumnPrefs() {
  const { ghinColumnPrefs } = await chrome.storage.local.get("ghinColumnPrefs");
  visibleColumnKeys = new Set(ghinColumnPrefs || []);
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
  for (const group of TOGGLE_COLUMN_GROUPS) {
    body.appendChild(el("div", { className: "col-menu-group", text: group.group }));
    for (const col of group.columns) {
      const label = el("label", { className: "col-menu-item" });
      const checkbox = el("input", { attrs: { type: "checkbox", value: col.key } });
      checkbox.checked = visibleColumnKeys.has(col.key);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) visibleColumnKeys.add(col.key);
        else visibleColumnKeys.delete(col.key);
        saveColumnPrefs();
        applyColumnVisibility(document.getElementById("diff-table-holder"));
      });
      label.appendChild(checkbox);
      label.appendChild(el("span", { text: col.label }));
      body.appendChild(label);
    }
  }
  details.appendChild(body);
  return details;
}

// mirrors tables.format_scoring_differentials, expanded with every field
// GHIN's scores.json returns behind a "Columns" picker - only a curated
// always-visible set shows by default.
function renderScoringDifferentials(container, spread) {
  const columns = [...ALWAYS_COLUMNS, ...ALL_TOGGLE_COLUMNS];
  const rows = rankedScoringDifferentialRows(spread).map((r) => ({
    sectionEnd: r.isSectionEnd,
    cells: columns.map((col) => {
      const node = col.render(r, spread);
      if (col.key) node.setAttribute("data-col", col.key);
      return node;
    }),
  }));
  const headers = columns.map((col) => (col.key ? { text: col.label, className: DETAIL_COL } : col.label));
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

// a golfer captured only via a followed-golfers list (a name, no scores or
// handicap yet) isn't worth surfacing - only golfers with some real data are.
function hasAnyData(golfer) {
  return Object.keys(golfer.scoresById).length > 0 || golfer.handicap != null;
}

// manual, global exclusion list for individual rounds - the automatic
// handicap-index sanity bound (calc.js) catches known GHIN sentinel garbage
// like the 999 spike, but this covers anything else that looks wrong (a bad
// differential, a duplicate round, whatever) that no automatic rule would
// catch. Excluding a round removes it from every calculation - tables and
// both charts - not just its display. Scores stay in raw storage untouched
// (visible/restorable from Raw Data) - only this derived view filters them.
let excludedScoreIds = new Set();

async function loadExclusionPrefs() {
  const { ghinExcludedScores } = await chrome.storage.local.get("ghinExcludedScores");
  excludedScoreIds = new Set(ghinExcludedScores || []);
}

function saveExclusionPrefs() {
  chrome.storage.local.set({ ghinExcludedScores: [...excludedScoreIds] });
}

function withExclusions(golfer) {
  if (!excludedScoreIds.size) return golfer;
  const scoresById = {};
  for (const [id, score] of Object.entries(golfer.scoresById)) {
    if (!excludedScoreIds.has(id)) scoresById[id] = score;
  }
  return { ...golfer, scoresById };
}

function excludeScore(scoreId) {
  excludedScoreIds.add(String(scoreId));
  saveExclusionPrefs();
  render();
}

function restoreScore(scoreId) {
  excludedScoreIds.delete(String(scoreId));
  saveExclusionPrefs();
  render();
}

// which golfers show up in the Alternative Handicaps/Statistics/Next Round
// Helpers/Historical tables - a golfer with enough data can still be hidden
// from view (e.g. you looked up a friend once and don't want them cluttering
// the comparison anymore). Stored as the hidden set so newly-captured
// golfers default to visible without needing an update.
let hiddenGolferIds = new Set();

async function loadGolferVisibilityPrefs() {
  const { ghinHiddenGolfers } = await chrome.storage.local.get("ghinHiddenGolfers");
  hiddenGolferIds = new Set(ghinHiddenGolfers || []);
}

function saveGolferVisibilityPrefs() {
  chrome.storage.local.set({ ghinHiddenGolfers: [...hiddenGolferIds] });
}

const golferMenuBody = el("div", { className: "col-menu-body" });

function buildGolferMenu() {
  const details = el("details", { className: "col-menu" });
  details.appendChild(el("summary", { text: "Golfers" }));
  details.appendChild(golferMenuBody);
  return details;
}

// rebuilt on every render (the golfer list grows as you browse), but the
// wrapping <details> is created once so an open menu doesn't snap shut.
function updateGolferMenu(spreads) {
  clearChildren(golferMenuBody);
  if (!spreads.length) {
    golferMenuBody.appendChild(el("div", { className: "empty-note", text: "No golfers with enough data yet." }));
    return;
  }
  for (const s of sortedSpreads(spreads)) {
    const label = el("label", { className: "golfer-menu-item" });
    const checkbox = el("input", { attrs: { type: "checkbox" } });
    checkbox.checked = !hiddenGolferIds.has(s.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) hiddenGolferIds.delete(s.id);
      else hiddenGolferIds.add(s.id);
      saveGolferVisibilityPrefs();
      render();
    });
    label.appendChild(checkbox);
    label.appendChild(el("span", { text: `${s.name} (${fmt1(s.best8Handicap)})` }));
    golferMenuBody.appendChild(label);
  }
}

function computeAll(golfers) {
  const spreads = [];
  const errors = [];
  for (const g of golfers) {
    if (!hasAnyData(g)) continue;
    const result = computeHandicapSpread(withExclusions(g));
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
function populateRawGolferSelect(select, golfersWithData, previousValue) {
  clearChildren(select);
  const sorted = [...golfersWithData].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  for (const g of sorted) {
    const scoreCount = Object.keys(g.scoresById).length;
    select.appendChild(el("option", { text: `${g.name || `Golfer ${g.id}`} (${scoreCount} captured)`, attrs: { value: g.id } }));
  }
  if (sorted.some((g) => g.id === previousValue)) select.value = previousValue;
  return select.value || null;
}

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

// excluded scores stay in raw storage untouched - this looks them back up
// across every golfer (score ids are globally unique) so they can be
// reviewed and restored later.
function renderExcludedScores(golfers) {
  const holder = document.getElementById("excluded-scores-holder");
  clearChildren(holder);
  if (!excludedScoreIds.size) return;

  const rows = [];
  for (const id of excludedScoreIds) {
    let found = null;
    let owner = null;
    for (const g of golfers) {
      if (g.scoresById[id]) {
        found = g.scoresById[id];
        owner = g;
        break;
      }
    }
    rows.push({ id, score: found, owner });
  }

  const table = el("table");
  table.appendChild(el("caption", { text: `Excluded Rounds (${rows.length})` }));
  table.appendChild(
    el("thead", {}, [el("tr", {}, ["Golfer", "Date", "Course", "", ""].map((h) => el("th", { text: h })))])
  );
  const tbody = el("tbody");
  for (const row of rows) {
    const restoreBtn = el("button", { className: "exclude-btn", text: "Restore" });
    restoreBtn.addEventListener("click", () => restoreScore(row.id));
    tbody.appendChild(
      el("tr", {}, [
        cell(row.owner?.name || (row.owner ? `Golfer ${row.owner.id}` : "unknown golfer")),
        cell(row.score?.played_at ?? `score id ${row.id}`),
        cell(row.score?.course_name ?? "-"),
        el("td", {}, [restoreBtn]),
      ])
    );
  }
  table.appendChild(tbody);
  holder.appendChild(scrollWrap(table));
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
  const rows = scoresToRows(golfers.filter(hasAnyData));
  downloadCsv(`ghin-scores-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(CSV_HEADERS, rows));
});

// pages through scores.json for the selected golfer using the browser's own
// GHIN.com session - see injected.js. Requires a ghin.com tab to be open,
// since the request has to come from that page's own context to carry auth.
document.getElementById("fetch-all-btn").addEventListener("click", async () => {
  const fetchStatus = document.getElementById("fetch-status");
  const golferId = document.getElementById("fetch-golfer-select").value;
  if (!golferId) {
    fetchStatus.textContent = "No golfer selected.";
    return;
  }
  const tabs = await chrome.tabs.query({ url: "https://*.ghin.com/*" });
  if (!tabs.length) {
    fetchStatus.textContent = "Open a ghin.com tab first, then try again.";
    return;
  }
  // when we already know when this golfer's GHIN account was created (from a
  // captured account_info/search.json response), skip walking back past it.
  const golfers = await loadGolfers();
  const golfer = golfers.find((g) => String(g.id) === golferId);
  const startYear = golfer?.createdAt ? new Date(golfer.createdAt).getFullYear() : undefined;

  fetchStatus.textContent = "Fetching...";
  try {
    await chrome.tabs.sendMessage(tabs[0].id, { type: "GHIN_FETCH_ALL", golferId, startYear });
  } catch {
    fetchStatus.textContent = "Couldn't reach the ghin.com tab - try reloading it.";
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "GHIN_FETCH_PROGRESS") return;
  const fetchStatus = document.getElementById("fetch-status");
  if (message.error) {
    fetchStatus.textContent = `Fetch failed after ${message.fetched} round(s): ${message.error}`;
  } else if (message.done) {
    fetchStatus.textContent = `Done - fetched ${message.fetched} round(s) across all years found.`;
  } else {
    fetchStatus.textContent = `Fetching... ${message.fetched} round(s) so far (currently on ${message.year}).`;
  }
});

let currentSelectedGolferId = null;
let currentSelectedFetchGolferId = null;
let currentSelectedChartGolferId = null;
let currentSelectedWhatifGolferId = null;

async function render() {
  const golfers = await loadGolfers();
  const golfersById = Object.fromEntries(golfers.map((g) => [String(g.id), g]));
  const { spreads, errors } = computeAll(golfers);

  const golfersWithData = golfers.filter(hasAnyData);
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

  renderExcludedScores(golfers);
  renderCsvPreview(golfersWithData);
  currentSelectedFetchGolferId = populateRawGolferSelect(
    document.getElementById("fetch-golfer-select"),
    golfersWithData,
    currentSelectedFetchGolferId
  );

  updateGolferMenu(spreads);
  const visibleSpreads = spreads.filter((s) => !hiddenGolferIds.has(s.id));

  const altPanel = document.getElementById("panel-alt");
  const nextPanel = document.getElementById("next-table-holder");
  clearChildren(altPanel);
  clearChildren(nextPanel);

  if (!spreads.length) {
    const note = "Browse GHIN.com (your dashboard, score history, and followed golfers) to capture data.";
    altPanel.appendChild(el("div", { className: "empty-note", text: note }));
    nextPanel.appendChild(el("div", { className: "empty-note", text: note }));
  } else if (!visibleSpreads.length) {
    const note = "All golfers are hidden - use the Golfers menu above to show one.";
    altPanel.appendChild(el("div", { className: "empty-note", text: note }));
    nextPanel.appendChild(el("div", { className: "empty-note", text: note }));
  } else {
    renderAlternativeHandicaps(altPanel, visibleSpreads);
    renderStatistics(altPanel, visibleSpreads);
    renderHistorical(altPanel, visibleSpreads);
    renderNextRoundHelpers(nextPanel, visibleSpreads);
  }

  currentSelectedGolferId = populateGolferSelect(document.getElementById("golfer-select"), spreads, currentSelectedGolferId);
  renderDiffPanel(spreads);

  currentSelectedChartGolferId = populateGolferSelect(
    document.getElementById("chart-golfer-select"),
    spreads,
    currentSelectedChartGolferId
  );
  renderChartsPanel(spreads, golfersById);

  currentSelectedWhatifGolferId = populateGolferSelect(
    document.getElementById("whatif-golfer-select"),
    spreads,
    currentSelectedWhatifGolferId
  );
}

function renderDiffPanel(spreads) {
  const holder = document.getElementById("diff-table-holder");
  clearChildren(holder);
  const select = document.getElementById("golfer-select");
  if (!spreads.length) {
    holder.appendChild(el("div", { className: "empty-note", text: "No golfer has enough captured scores yet." }));
    return;
  }
  const spread = spreads.find((s) => s.id === select.value) || spreads[0];
  renderScoringDifferentials(holder, spread);
}

// mirrors the user's request: handicap over time, and differentials over
// time mapped against handicap over time. Uses every captured score, not
// just the 20 used for handicap math, so the trend line has more history.
function renderChartsPanel(spreads, golfersById) {
  const holder = document.getElementById("charts-holder");
  clearChildren(holder);
  const select = document.getElementById("chart-golfer-select");
  if (!spreads.length) {
    holder.appendChild(el("div", { className: "empty-note", text: "No golfer has enough captured scores yet." }));
    return;
  }
  const spread = spreads.find((s) => s.id === select.value) || spreads[0];
  const golfer = golfersById[spread.id];
  const series = buildTimeSeries(withExclusions(golfer));

  renderLineChart(holder, {
    title: `Handicap Index Over Time (${spread.name})`,
    dates: series.dates,
    values: series.handicaps,
    seriesLabel: "Handicap Index",
  });
  renderComboChart(holder, {
    title: `Scoring Differentials vs Handicap Index (${spread.name})`,
    dates: series.dates,
    barValues: series.differentials,
    barLabel: "Differential",
    lineValues: series.handicaps,
    lineLabel: "Handicap Index",
  });
}

document.getElementById("golfer-select").addEventListener("change", async () => {
  currentSelectedGolferId = document.getElementById("golfer-select").value;
  const golfers = await loadGolfers();
  const { spreads } = computeAll(golfers);
  renderDiffPanel(spreads);
});


document.getElementById("chart-golfer-select").addEventListener("change", async () => {
  currentSelectedChartGolferId = document.getElementById("chart-golfer-select").value;
  const golfers = await loadGolfers();
  const golfersById = Object.fromEntries(golfers.map((g) => [String(g.id), g]));
  const { spreads } = computeAll(golfers);
  renderChartsPanel(spreads, golfersById);
});

document.getElementById("whatif-golfer-select").addEventListener("change", () => {
  currentSelectedWhatifGolferId = document.getElementById("whatif-golfer-select").value;
});

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

  const golferId = document.getElementById("whatif-golfer-select").value;
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
  const golferId = document.getElementById("whatif-golfer-select").value;
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
  const golferId = document.getElementById("whatif-golfer-select").value;
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

const SETTINGS_KEY = "ghinSettings";

(async () => {
  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
  document.getElementById("keep-open-toggle").checked = settings?.keepOpenEverywhere ?? false;
})();

// debug-only UI (the raw API response viewer) is only useful while
// developing this extension against unverified GHIN endpoints - hide it
// once this is ever actually distributed via the Chrome Web Store.
// getSelf() is specifically exempted from needing the "management"
// permission, so no manifest change is needed for this.
chrome.management.getSelf((info) => {
  if (info.installType === "development") return;
  for (const node of document.querySelectorAll(".dev-only")) node.style.display = "none";
});

document.getElementById("keep-open-toggle").addEventListener("change", async (e) => {
  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...settings, keepOpenEverywhere: e.target.checked } });
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

(async () => {
  await Promise.all([loadColumnPrefs(), loadGolferVisibilityPrefs(), loadExclusionPrefs()]);
  document.getElementById("col-menu-holder").appendChild(buildColumnMenu());
  document.getElementById("golfer-menu-holder").appendChild(buildGolferMenu());
  render();
})();
