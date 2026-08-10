// Isolated-world content script: relays captured payloads from injected.js
// (page context) to the background service worker via extension messaging.
console.log("[GHIN-EXT] content-bridge.js loaded");

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data) return;

  if (data.__ghinExt) {
    console.log("[GHIN-EXT] relaying to background", data.url);
    chrome.runtime.sendMessage({ type: "GHIN_CAPTURE", url: data.url, body: data.body }).catch((e) => {
      console.warn("[GHIN-EXT] sendMessage failed", e);
    });
  } else if (data.__ghinExtProgress) {
    chrome.runtime
      .sendMessage({
        type: "GHIN_FETCH_PROGRESS",
        golferId: data.golferId,
        fetched: data.fetched,
        year: data.year,
        done: data.done,
        error: data.error,
      })
      .catch(() => {});
  } else if (data.__ghinExtApiResult) {
    chrome.runtime
      .sendMessage({
        type: "GHIN_API_RESULT",
        requestId: data.requestId,
        kind: data.kind,
        data: data.data,
        error: data.error,
      })
      .catch(() => {});
  }
});

// relays commands from the side panel (sent via chrome.tabs.sendMessage) or
// automatically from background.js into the page context, where injected.js
// can actually issue the request using the page's own session.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "GHIN_FETCH_ALL" && message.golferId) {
    window.postMessage(
      { __ghinExtCmd: "fetchAll", golferId: message.golferId, startYear: message.startYear },
      window.location.origin
    );
  } else if (message?.type === "GHIN_FETCH_NAME" && message.golferId) {
    window.postMessage({ __ghinExtCmd: "fetchName", golferId: message.golferId }, window.location.origin);
  } else if (message?.type === "GHIN_SEARCH_COURSES" && message.query) {
    window.postMessage({ __ghinExtCmd: "searchCourses", query: message.query, requestId: message.requestId }, window.location.origin);
  } else if (message?.type === "GHIN_GET_COURSE_DETAILS" && message.courseId != null) {
    window.postMessage(
      { __ghinExtCmd: "getCourseDetails", courseId: message.courseId, requestId: message.requestId },
      window.location.origin
    );
  } else if (message?.type === "GHIN_GET_COURSE_HANDICAPS" && message.courseId != null) {
    window.postMessage(
      {
        __ghinExtCmd: "getCourseHandicaps",
        courseId: message.courseId,
        golferId: message.golferId,
        playedAt: message.playedAt,
        requestId: message.requestId,
      },
      window.location.origin
    );
  }
});
