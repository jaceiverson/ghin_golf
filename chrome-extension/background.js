// Service worker: classifies captured GHIN.com API responses relayed by
// content-bridge.js and merges them into chrome.storage.local under
// "ghinData". The side panel reads/renders from that same key.

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

const STORAGE_KEY = "ghinData";
const SETTINGS_KEY = "ghinSettings";

// --- auto-close the panel off ghin.com, unless the user opted to keep it open everywhere ---

function isGhinUrl(url) {
  return /^https:\/\/([^/]+\.)?ghin\.com\//.test(url || "");
}

async function updatePanelForTab(tab) {
  if (!tab || tab.id == null) return;
  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
  const keepOpenEverywhere = settings?.keepOpenEverywhere ?? false;
  const shouldEnable = keepOpenEverywhere || isGhinUrl(tab.url);
  console.log("[GHIN-EXT] updatePanelForTab", { tabId: tab.id, url: tab.url, keepOpenEverywhere, shouldEnable });
  try {
    if (shouldEnable) {
      await chrome.sidePanel.setOptions({ tabId: tab.id, path: "sidepanel.html", enabled: true });
    } else {
      await chrome.sidePanel.setOptions({ tabId: tab.id, enabled: false });
    }
  } catch (e) {
    console.warn("[GHIN-EXT] setOptions failed for tab", tab.id, e);
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId).then(updatePanelForTab).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) updatePanelForTab(tab);
});

// onActivated only fires for tab switches *within* a window - switching to
// a different browser window entirely (without changing which tab is
// active in it) doesn't raise it, so the previously-focused window's panel
// state could go stale. Covers that gap.
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, windowId }).then((tabs) => tabs.forEach(updatePanelForTab));
});

// re-evaluate every currently-active tab immediately when the user flips
// "keep open everywhere" - otherwise the change only takes effect on the
// next tab switch/navigation, which feels broken.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[SETTINGS_KEY]) return;
  chrome.tabs.query({ active: true }).then((tabs) => tabs.forEach(updatePanelForTab));
});

// set the initial enabled/disabled state for every open tab on install/startup,
// rather than only reacting to future tab events.
function initAllTabs() {
  chrome.tabs.query({}).then((tabs) => tabs.forEach(updatePanelForTab));
}
chrome.runtime.onInstalled.addListener(initAllTabs);
chrome.runtime.onStartup.addListener(initAllTabs);

function getQueryParam(url, name) {
  try {
    return new URL(url).searchParams.get(name);
  } catch {
    return null;
  }
}

function parsePlusMinusFloat(value) {
  if (value == null) return null;
  const num = parseFloat(String(value).replace("+", "-"));
  return Number.isNaN(num) ? null : num;
}

async function loadStore() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || { golfers: {} };
}

async function saveStore(store) {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

function ensureGolfer(store, id) {
  if (!store.golfers[id]) {
    store.golfers[id] = {
      id,
      name: null,
      handicap: null,
      handicapRevDate: null,
      lowHandicap: null,
      lowHandicapDate: null,
      createdAt: null,
      nameFetchTried: false,
      scoresById: {},
    };
  }
  return store.golfers[id];
}

function classify(url) {
  if (/golfers\/search\.json/.test(url)) return "account_info";
  const handicapMatch = url.match(/golfers\/(\d+)\/handicap_history\.json/);
  if (handicapMatch) return { type: "handicap_history", id: handicapMatch[1] };
  if (/scores\.json/.test(url)) return "scores";
  const followedMatch = url.match(/followed_golfers\/(\d+)\.json/);
  if (followedMatch) return "followed_golfers";
  return null;
}

// search.json/account_info only fires on some GHIN.com pages (e.g. profile),
// not on score-history or the dashboard - rather than waiting for the user
// to stumble onto one, ask injected.js to fetch it directly the first time
// we see a golfer with real data but no name yet (using the auth header it
// already snooped for the "fetch full history" feature).
const NAME_FETCH_RETRY_MS = 15000;

// a cooldown rather than a one-shot flag: the attempt can silently fail (no
// ghin.com tab open yet, auth header not observed yet, message lost) and a
// permanent flag would mean it never tries again for the rest of the
// session.
function shouldRetryNameFetch(entry) {
  return !entry.nameFetchAt || Date.now() - entry.nameFetchAt > NAME_FETCH_RETRY_MS;
}

async function triggerNameBackfill(golferId) {
  try {
    const tabs = await chrome.tabs.query({ url: "https://*.ghin.com/*" });
    if (!tabs.length) {
      console.log("[GHIN-EXT] name backfill skipped, no ghin.com tab open for golfer", golferId);
      return;
    }
    await chrome.tabs.sendMessage(tabs[0].id, { type: "GHIN_FETCH_NAME", golferId });
    console.log("[GHIN-EXT] name backfill requested for golfer", golferId);
  } catch (e) {
    console.warn("[GHIN-EXT] name backfill request failed for golfer", golferId, e);
  }
}

async function handleCapture(url, body) {
  const kind = classify(url);
  console.log("[GHIN-EXT] background received", url, "classified as", kind);
  if (!kind) return;
  const store = await loadStore();
  let golferNeedingName = null;

  if (kind === "account_info") {
    const golfers = body?.golfers || [];
    for (const g of golfers) {
      if (g?.id == null) continue;
      const entry = ensureGolfer(store, String(g.id));
      entry.name = `${g.first_name || ""} ${g.last_name || ""}`.trim() || entry.name;
      entry.lowHandicap = parsePlusMinusFloat(g.low_hi_display);
      entry.lowHandicapDate = g.low_hi_date || entry.lowHandicapDate;
      entry.createdAt = g.created_at || entry.createdAt;
    }
  } else if (kind.type === "handicap_history") {
    const revisions = body?.handicap_revisions || [];
    if (!revisions.length) return;
    const latest = revisions.reduce((a, b) => (new Date(b.RevDate) > new Date(a.RevDate) ? b : a));
    const entry = ensureGolfer(store, kind.id);
    if (!entry.handicapRevDate || new Date(latest.RevDate) >= new Date(entry.handicapRevDate)) {
      entry.handicap = parsePlusMinusFloat(latest.Display);
      entry.handicapRevDate = latest.RevDate;
      if (!entry.lowHandicap && latest.LowHIDisplay) {
        entry.lowHandicap = parsePlusMinusFloat(latest.LowHIDisplay);
      }
    }
    if (!entry.name && shouldRetryNameFetch(entry)) golferNeedingName = entry;
  } else if (kind === "scores") {
    // two response shapes hit this branch: the paginated list
    // (?golfer_id=&offset=&limit=) with a top-level "scores" array, and the
    // score-history summary (/golfers/{id}/scores.json with no query) which
    // nests scores under recent_scores/revision_scores instead. Merge all of
    // them - recent_scores holds the newest not-yet-revised round, which
    // revision_scores may not include yet.
    const scores = [body?.scores, body?.revision_scores?.scores, body?.recent_scores?.scores]
      .filter(Boolean)
      .flat();
    const golferId = getQueryParam(url, "golfer_id") || (url.match(/golfers\/(\d+)\/scores\.json/) || [])[1];
    if (!golferId) return;
    if (!scores.length) {
      console.log("[GHIN-EXT] scores.json response had no usable scores array, keys:", Object.keys(body || {}));
      return;
    }
    const entry = ensureGolfer(store, golferId);
    for (const score of scores) {
      if (score?.id != null) entry.scoresById[score.id] = score;
    }
    // GHIN reports lifetime totals (total_count/highest/lowest/average) as
    // metadata alongside the score list - separate from the 20 rounds used
    // for handicap math. The paginated list exposes it at the top level; the
    // score-history summary nests it under score_history_stats.
    const stats = body?.total_count != null ? body : body?.score_history_stats;
    if (stats?.total_count != null && (!entry.historicalStats || stats.total_count >= entry.historicalStats.totalCount)) {
      entry.historicalStats = {
        totalCount: stats.total_count,
        highestScore: stats.highest_score,
        lowestScore: stats.lowest_score,
        average: stats.average,
      };
    }
    if (!entry.name && shouldRetryNameFetch(entry)) golferNeedingName = entry;
  } else if (kind === "followed_golfers") {
    const golfers = body?.golfers || [];
    for (const g of golfers) {
      if (g?.id == null) continue;
      const entry = ensureGolfer(store, String(g.id));
      entry.name = `${g.first_name || ""} ${g.last_name || ""}`.trim() || entry.name;
    }
  }

  if (golferNeedingName) golferNeedingName.nameFetchTried = true;
  await saveStore(store);
  console.log("[GHIN-EXT] store now has golfers:", Object.keys(store.golfers));

  if (golferNeedingName) triggerNameBackfill(golferNeedingName.id);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "GHIN_CAPTURE") {
    handleCapture(message.url, message.body);
  } else if (message?.type === "GHIN_CLEAR") {
    chrome.storage.local.set({ [STORAGE_KEY]: { golfers: {} } });
  }
});
