// Runs in the page's own JS context (world: "MAIN") so it can wrap the
// fetch/XHR calls GHIN.com's own frontend makes and read their response
// bodies. It never issues any request itself - it only observes.
(() => {
  const RELEVANT = /(golfers\/search\.json|golfers\/\d+\/handicap_history\.json|scores\.json|followed_golfers\/\d+\.json)/;
  console.log("[GHIN-EXT] injected.js loaded, hooking fetch/XHR");

  function post(url, body) {
    console.log("[GHIN-EXT] captured", url, body);
    window.postMessage({ __ghinExt: true, url, body }, window.location.origin);
  }

  function handleText(url, text) {
    if (!text) return;
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      console.warn("[GHIN-EXT] matched URL but response wasn't JSON", url);
      return;
    }
    post(url, json);
  }

  // GHIN's API requires "authorization: Bearer <token>" (see ghin.py's
  // header.py) - the site's own fetch/XHR calls already send it, so rather
  // than reimplementing GHIN's login flow to mint our own token, just
  // remember whatever the page's own most recent authenticated call sent
  // and reuse it for the extra requests fetchAllScores makes below.
  let lastAuthHeader = null;

  function rememberAuthHeader(headersLike) {
    let value = null;
    if (!headersLike) return;
    if (typeof headersLike.get === "function") {
      value = headersLike.get("authorization");
    } else if (Array.isArray(headersLike)) {
      const found = headersLike.find(([k]) => k.toLowerCase() === "authorization");
      value = found?.[1] ?? null;
    } else if (typeof headersLike === "object") {
      const key = Object.keys(headersLike).find((k) => k.toLowerCase() === "authorization");
      value = key ? headersLike[key] : null;
    }
    if (value) lastAuthHeader = value;
  }

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const request = args[0];
    const url = typeof request === "string" ? request : request?.url;
    if (url && RELEVANT.test(url)) {
      rememberAuthHeader(typeof request === "string" ? args[1]?.headers : request?.headers);
    }
    const promise = originalFetch.apply(this, args);
    if (url) console.debug("[GHIN-EXT] fetch seen:", url, RELEVANT.test(url) ? "(matched)" : "");
    if (url && RELEVANT.test(url)) {
      promise
        .then((response) => response.clone().text())
        .then((text) => handleText(url, text))
        .catch((e) => console.warn("[GHIN-EXT] failed to read response", url, e));
    }
    return promise;
  };

  const OriginalXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OriginalXHR();
    let url;
    let headers = {};
    const open = xhr.open;
    xhr.open = function (method, requestUrl, ...rest) {
      url = requestUrl;
      headers = {};
      return open.call(xhr, method, requestUrl, ...rest);
    };
    const setRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function (name, value) {
      headers[name] = value;
      return setRequestHeader.call(xhr, name, value);
    };
    xhr.addEventListener("load", () => {
      if (url) console.debug("[GHIN-EXT] xhr seen:", url, RELEVANT.test(url) ? "(matched)" : "");
      if (url && RELEVANT.test(url)) {
        rememberAuthHeader(headers);
        handleText(url, xhr.responseText);
      }
    });
    return xhr;
  }
  PatchedXHR.prototype = OriginalXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  function postProgress(golferId, fetched, year, done, error) {
    window.postMessage({ __ghinExtProgress: true, golferId, fetched, year, done, error }, window.location.origin);
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // fetch one page of a single calendar year's scores. Returns the count of
  // scores that page contained.
  async function fetchScoresPage(golferId, year, offset, limit) {
    const url =
      `https://api2.ghin.com/api/v1/scores.json?golfer_id=${golferId}&offset=${offset}&limit=${limit}` +
      `&from_date_played=${year}-01-01&to_date_played=${year}-12-31&statuses=Validated&source=GHINcom`;
    const response = await originalFetch(url, { headers: { authorization: lastAuthHeader } });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status} for ${year}: ${body.slice(0, 200)}`);
    }
    const json = await response.json();
    post(url, json);
    return (json.scores || []).length;
  }

  // triggered from the side panel via content-bridge.js. Plain offset/limit
  // pagination on scores.json silently caps at some rolling window - GHIN's
  // own UI works around this with year filters ("2024 Scores", "2023
  // Scores", ...), which is exactly the from_date_played/to_date_played
  // pattern ghin.py's get_range_of_scores already uses. So: page within
  // each calendar year (same session/cookies the site itself uses), walking
  // backwards from this year, and stop once several years in a row come
  // back empty - that's a reasonable signal we've walked past when the
  // golfer started keeping scores.
  async function fetchAllScores(golferId, startYear) {
    if (!lastAuthHeader) {
      postProgress(golferId, 0, null, true, "No authenticated GHIN request observed yet - reload the ghin.com tab so it logs in again, then retry.");
      return;
    }
    const limit = 25;
    const maxYears = 30; // safety net
    const dryYearsToStop = 3;
    const currentYear = new Date().getFullYear();
    const earliestYear = startYear || currentYear - maxYears;
    let totalFetched = 0;
    let consecutiveDryYears = 0;
    console.log("[GHIN-EXT] fetchAllScores starting for golfer", golferId, "back to", earliestYear);
    try {
      for (let year = currentYear; year >= earliestYear; year--) {
        let offset = 0;
        let yearCount = 0;
        while (true) {
          const count = await fetchScoresPage(golferId, year, offset, limit);
          yearCount += count;
          totalFetched += count;
          offset += limit;
          postProgress(golferId, totalFetched, year, false, null);
          if (count < limit) break;
          await sleep(300);
        }
        // the dry-years heuristic only matters when we're guessing how far
        // back to go - if startYear is a known, authoritative floor (the
        // golfer's account creation date), a quiet year in the middle of
        // their history shouldn't cut the scan short.
        if (!startYear) {
          consecutiveDryYears = yearCount === 0 ? consecutiveDryYears + 1 : 0;
          if (consecutiveDryYears >= dryYearsToStop) break;
        }
        await sleep(200);
      }
      postProgress(golferId, totalFetched, null, true, null);
      console.log("[GHIN-EXT] fetchAllScores done for golfer", golferId, "-", totalFetched, "rounds");
    } catch (e) {
      console.warn("[GHIN-EXT] fetchAllScores failed", e);
      postProgress(golferId, totalFetched, null, true, String(e));
    }
  }

  // triggered automatically by background.js the first time it sees a
  // golfer with real data but no captured name - search.json/account_info
  // doesn't fire on every GHIN.com page, so rather than waiting for the
  // user to stumble onto one, fetch it directly with the snooped auth
  // header. Goes through the normal post()/capture pipeline, same as any
  // passively-observed response, so background.js's existing account_info
  // handling picks up the name without any special-casing.
  async function fetchGolferName(golferId) {
    if (!lastAuthHeader) {
      console.warn("[GHIN-EXT] fetchGolferName: no auth header observed yet");
      return;
    }
    try {
      const url = `https://api2.ghin.com/api/v1/golfers/search.json?golfer_id=${golferId}&page=1&per_page=100&source=GHINcom`;
      const response = await originalFetch(url, { headers: { authorization: lastAuthHeader } });
      if (!response.ok) return;
      const json = await response.json();
      post(url, json);
    } catch (e) {
      console.warn("[GHIN-EXT] fetchGolferName failed", e);
    }
  }

  // "What If?" round simulator - searches GHIN's course database and looks
  // up a course's tee sets (rating/slope), so the side panel can compute a
  // hypothetical differential without the user needing to know those
  // numbers. Both go through the same auth-header-snooping fetch as the
  // other active requests above; results are posted back tagged with the
  // caller's requestId so the side panel can match a response to its
  // request (multiple searches/lookups can be in flight at once).
  function postApiResult(requestId, kind, data, error) {
    window.postMessage({ __ghinExtApiResult: true, requestId, kind, data, error }, window.location.origin);
  }

  async function callGhinApi(url) {
    if (!lastAuthHeader) {
      throw new Error("No authenticated GHIN request observed yet - reload the ghin.com tab so it logs in again, then retry.");
    }
    const response = await originalFetch(url, { headers: { authorization: lastAuthHeader } });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    return response.json();
  }

  async function searchCourses(query, requestId) {
    try {
      const url = `https://api2.ghin.com/api/v1/crsCourseMethods.asmx/SearchCourses.json?name=${encodeURIComponent(query)}&source=GHINcom`;
      const json = await callGhinApi(url);
      postApiResult(requestId, "searchCourses", json, null);
    } catch (e) {
      postApiResult(requestId, "searchCourses", null, String(e.message || e));
    }
  }

  async function getCourseDetails(courseId, requestId) {
    try {
      const url = `https://api2.ghin.com/api/v1/crsCourseMethods.asmx/GetCourseDetails.json?courseId=${courseId}&include_altered_tees=false&source=GHINcom`;
      const json = await callGhinApi(url);
      postApiResult(requestId, "getCourseDetails", json, null);
    } catch (e) {
      postApiResult(requestId, "getCourseDetails", null, String(e.message || e));
    }
  }

  // golfer-scoped: returns this golfer's actual course handicap for the
  // course (likely per tee, alongside the rating/slope used to compute it) -
  // richer than GetCourseDetails if it does return per-tee data, since it's
  // one call instead of "list tees, then compute by hand."
  async function getCourseHandicaps(courseId, golferId, playedAt, requestId) {
    try {
      const url = `https://api2.ghin.com/api/v1/course_handicaps.json?course_id=${courseId}&golfer_id=${golferId}&played_at=${playedAt}&source=GHINcom`;
      const json = await callGhinApi(url);
      postApiResult(requestId, "getCourseHandicaps", json, null);
    } catch (e) {
      postApiResult(requestId, "getCourseHandicaps", null, String(e.message || e));
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data) return;
    if (data.__ghinExtCmd === "fetchAll" && data.golferId) {
      fetchAllScores(data.golferId, data.startYear);
    } else if (data.__ghinExtCmd === "fetchName" && data.golferId) {
      fetchGolferName(data.golferId);
    } else if (data.__ghinExtCmd === "searchCourses" && data.query) {
      searchCourses(data.query, data.requestId);
    } else if (data.__ghinExtCmd === "getCourseDetails" && data.courseId != null) {
      getCourseDetails(data.courseId, data.requestId);
    } else if (data.__ghinExtCmd === "getCourseHandicaps" && data.courseId != null) {
      getCourseHandicaps(data.courseId, data.golferId, data.playedAt, data.requestId);
    }
  });
})();
