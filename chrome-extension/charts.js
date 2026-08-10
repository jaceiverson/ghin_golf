// Small dependency-free SVG chart renderer. Generic - takes plain arrays of
// dates/numbers, knows nothing about GHIN. Follows the project's dataviz
// conventions: thin marks, hairline recessive gridlines, a legend only when
// there's more than one series, a crosshair+tooltip on hover/focus, and the
// validated categorical palette (dark-surface steps) for series color.

const CHART_COLORS = {
  series1: "#3987e5", // categorical slot 1 (blue) - handicap line
  series2: "#d95926", // categorical slot 2 (orange) - differential bars
  grid: "#2c2c2a",
  axis: "#383835",
  muted: "#898781",
  ink: "#ffffff",
  surface: "#1a1a19",
};

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function htmlEl(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  return node;
}

// round a y-domain out to clean tick steps
function niceTicks(min, max, count = 4) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const rawStep = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { min: niceMin, max: niceMax, ticks };
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function emptyNote(container, text) {
  container.appendChild(htmlEl("div", { className: "empty-note", text }));
}

// shared chrome: title, svg canvas sized by viewBox, legend row, tooltip div
function buildChartShell(container, title, legendItems) {
  const wrap = htmlEl("div", { className: "chart" });
  wrap.appendChild(htmlEl("div", { className: "chart-title", text: title }));
  if (legendItems && legendItems.length > 1) {
    const legend = htmlEl("div", { className: "chart-legend" });
    for (const item of legendItems) {
      const row = htmlEl("span", { className: "legend-item" });
      const swatch = htmlEl("span", { className: "legend-swatch" });
      swatch.style.background = item.color;
      row.appendChild(swatch);
      row.appendChild(htmlEl("span", { text: item.label }));
      legend.appendChild(row);
    }
    wrap.appendChild(legend);
  }
  const svg = svgEl("svg", { viewBox: "0 0 640 260", preserveAspectRatio: "none", class: "chart-svg" });
  wrap.appendChild(svg);
  const tooltip = htmlEl("div", { className: "chart-tooltip" });
  tooltip.style.display = "none";
  wrap.appendChild(tooltip);
  container.appendChild(wrap);
  return { wrap, svg, tooltip };
}

const MARGIN = { top: 12, right: 14, bottom: 26, left: 36 };
const CHART_W = 640;
const CHART_H = 260;
const PLOT_W = CHART_W - MARGIN.left - MARGIN.right;
const PLOT_H = CHART_H - MARGIN.top - MARGIN.bottom;

function drawAxes(svg, yTicks, yScale, xTickLabels) {
  for (const tick of yTicks.ticks) {
    const y = yScale(tick);
    svg.appendChild(
      svgEl("line", { x1: MARGIN.left, x2: MARGIN.left + PLOT_W, y1: y, y2: y, stroke: CHART_COLORS.grid, "stroke-width": 1 })
    );
    const label = svgEl("text", {
      x: MARGIN.left - 6,
      y: y + 3,
      "text-anchor": "end",
      "font-size": 10,
      fill: CHART_COLORS.muted,
    });
    label.textContent = tick;
    svg.appendChild(label);
  }
  svg.appendChild(
    svgEl("line", {
      x1: MARGIN.left,
      x2: MARGIN.left + PLOT_W,
      y1: MARGIN.top + PLOT_H,
      y2: MARGIN.top + PLOT_H,
      stroke: CHART_COLORS.axis,
      "stroke-width": 1,
    })
  );
  for (const { x, text } of xTickLabels) {
    const label = svgEl("text", {
      x,
      y: MARGIN.top + PLOT_H + 16,
      "text-anchor": "middle",
      "font-size": 10,
      fill: CHART_COLORS.muted,
    });
    label.textContent = text;
    svg.appendChild(label);
  }
}

function makeXTickLabels(dates, xForIndex) {
  const n = dates.length;
  if (n === 0) return [];
  const indexes = n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  return [...new Set(indexes)].map((i) => ({ x: xForIndex(i), text: formatDate(dates[i]) }));
}

// attaches a full-plot hit layer that finds the nearest x index and calls
// onHover(index | null, clientX, clientY)
function attachCrosshair(svg, tooltip, wrap, xForIndex, n, onHover) {
  const crosshair = svgEl("line", {
    x1: 0,
    x2: 0,
    y1: MARGIN.top,
    y2: MARGIN.top + PLOT_H,
    stroke: CHART_COLORS.axis,
    "stroke-width": 1,
    visibility: "hidden",
  });
  svg.appendChild(crosshair);
  const hit = svgEl("rect", {
    x: MARGIN.left,
    y: MARGIN.top,
    width: PLOT_W,
    height: PLOT_H,
    fill: "transparent",
  });
  svg.appendChild(hit);

  function nearestIndex(px) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(xForIndex(i) - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function handleMove(evt) {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * CHART_W;
    const i = nearestIndex(px);
    crosshair.setAttribute("x1", xForIndex(i));
    crosshair.setAttribute("x2", xForIndex(i));
    crosshair.setAttribute("visibility", "visible");
    onHover(i, evt.clientX, evt.clientY);
  }

  hit.addEventListener("pointermove", handleMove);
  hit.addEventListener("pointerleave", () => {
    crosshair.setAttribute("visibility", "hidden");
    tooltip.style.display = "none";
  });
}

function positionTooltip(tooltip, wrap, clientX, clientY) {
  const wrapRect = wrap.getBoundingClientRect();
  tooltip.style.left = `${clientX - wrapRect.left + 12}px`;
  tooltip.style.top = `${clientY - wrapRect.top + 12}px`;
  tooltip.style.display = "block";
}

// single-series line chart (e.g. handicap over time)
function renderLineChart(container, { title, dates, values, color = CHART_COLORS.series1, seriesLabel }) {
  const points = dates.map((d, i) => ({ date: d, value: values[i] })).filter((p) => p.value != null);
  if (points.length < 2) {
    emptyNote(container, `Not enough dated data yet for "${title}".`);
    return;
  }

  const { svg, wrap, tooltip } = buildChartShell(container, title, []);
  const vals = points.map((p) => p.value);
  const yTicks = niceTicks(Math.min(0, ...vals), Math.max(...vals));
  const yScale = (v) => MARGIN.top + PLOT_H - ((v - yTicks.min) / (yTicks.max - yTicks.min)) * PLOT_H;
  const xForIndex = (i) => MARGIN.left + (points.length === 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W);

  drawAxes(svg, yTicks, yScale, makeXTickLabels(points.map((p) => p.date), xForIndex));

  const pathData = points.map((p, i) => `${i === 0 ? "M" : "L"}${xForIndex(i)},${yScale(p.value)}`).join(" ");
  svg.appendChild(svgEl("path", { d: pathData, fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));

  if (points.length <= 40) {
    for (let i = 0; i < points.length; i++) {
      svg.appendChild(
        svgEl("circle", { cx: xForIndex(i), cy: yScale(points[i].value), r: 4, fill: color, stroke: CHART_COLORS.surface, "stroke-width": 2 })
      );
    }
  }

  // direct end-label on the last point
  const last = points[points.length - 1];
  const endLabel = svgEl("text", {
    x: Math.min(xForIndex(points.length - 1) + 6, CHART_W - 4),
    y: yScale(last.value) - 8,
    "font-size": 11,
    "font-weight": 600,
    fill: CHART_COLORS.ink,
  });
  endLabel.textContent = last.value;
  svg.appendChild(endLabel);

  attachCrosshair(svg, tooltip, wrap, xForIndex, points.length, (i, clientX, clientY) => {
    const p = points[i];
    tooltip.textContent = "";
    tooltip.appendChild(htmlEl("div", { className: "tooltip-date", text: formatDate(p.date) }));
    const row = htmlEl("div", { className: "tooltip-row" });
    row.appendChild(htmlEl("span", { className: "tooltip-key", text: "" })).style.background = color;
    row.appendChild(htmlEl("span", { className: "tooltip-value", text: String(p.value) }));
    if (seriesLabel) row.appendChild(htmlEl("span", { className: "tooltip-label", text: seriesLabel }));
    tooltip.appendChild(row);
    positionTooltip(tooltip, wrap, clientX, clientY);
  });
}

// two-series combo: bars for one series, a line for the other, one shared
// y-axis (never dual-axis) since both are the same units (strokes).
function renderComboChart(
  container,
  { title, dates, barValues, barLabel, barColor = CHART_COLORS.series2, lineValues, lineLabel, lineColor = CHART_COLORS.series1 }
) {
  const n = dates.length;
  const rows = [];
  for (let i = 0; i < n; i++) {
    if (barValues[i] == null && lineValues[i] == null) continue;
    rows.push({ date: dates[i], bar: barValues[i], line: lineValues[i] });
  }
  if (rows.length < 2) {
    emptyNote(container, `Not enough dated data yet for "${title}".`);
    return;
  }

  const { svg, wrap, tooltip } = buildChartShell(container, title, [
    { color: barColor, label: barLabel },
    { color: lineColor, label: lineLabel },
  ]);

  const allVals = rows.flatMap((r) => [r.bar, r.line]).filter((v) => v != null);
  const yTicks = niceTicks(Math.min(0, ...allVals), Math.max(...allVals));
  const yScale = (v) => MARGIN.top + PLOT_H - ((v - yTicks.min) / (yTicks.max - yTicks.min)) * PLOT_H;
  const baselineY = yScale(Math.max(yTicks.min, 0));

  const slot = PLOT_W / rows.length;
  const barW = Math.max(2, Math.min(24, slot * 0.6));
  const xForIndex = (i) => MARGIN.left + slot * i + slot / 2;

  drawAxes(svg, yTicks, yScale, makeXTickLabels(rows.map((r) => r.date), xForIndex));

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].bar == null) continue;
    const barY = yScale(rows[i].bar);
    const top = Math.min(barY, baselineY);
    const height = Math.max(1, Math.abs(barY - baselineY));
    svg.appendChild(
      svgEl("rect", {
        x: xForIndex(i) - barW / 2,
        y: top,
        width: barW,
        height,
        rx: 3,
        fill: barColor,
      })
    );
  }

  const linePoints = rows.map((r, i) => ({ i, value: r.line })).filter((p) => p.value != null);
  if (linePoints.length >= 2) {
    const pathData = linePoints.map((p, k) => `${k === 0 ? "M" : "L"}${xForIndex(p.i)},${yScale(p.value)}`).join(" ");
    svg.appendChild(
      svgEl("path", { d: pathData, fill: "none", stroke: lineColor, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" })
    );
    for (const p of linePoints) {
      svg.appendChild(
        svgEl("circle", { cx: xForIndex(p.i), cy: yScale(p.value), r: 3.5, fill: lineColor, stroke: CHART_COLORS.surface, "stroke-width": 2 })
      );
    }
  }

  attachCrosshair(svg, tooltip, wrap, xForIndex, rows.length, (i, clientX, clientY) => {
    const r = rows[i];
    tooltip.textContent = "";
    tooltip.appendChild(htmlEl("div", { className: "tooltip-date", text: formatDate(r.date) }));
    if (r.bar != null) {
      const row = htmlEl("div", { className: "tooltip-row" });
      const key = htmlEl("span", { className: "tooltip-key" });
      key.style.background = barColor;
      row.appendChild(key);
      row.appendChild(htmlEl("span", { className: "tooltip-value", text: String(r.bar) }));
      row.appendChild(htmlEl("span", { className: "tooltip-label", text: barLabel }));
      tooltip.appendChild(row);
    }
    if (r.line != null) {
      const row = htmlEl("div", { className: "tooltip-row" });
      const key = htmlEl("span", { className: "tooltip-key" });
      key.style.background = lineColor;
      row.appendChild(key);
      row.appendChild(htmlEl("span", { className: "tooltip-value", text: String(r.line) }));
      row.appendChild(htmlEl("span", { className: "tooltip-label", text: lineLabel }));
      tooltip.appendChild(row);
    }
    positionTooltip(tooltip, wrap, clientX, clientY);
  });
}
