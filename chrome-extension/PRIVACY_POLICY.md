# Privacy Policy — GHIN Handicap Tables

_Last updated: 2026-08-12_

GHIN Handicap Tables is a Chrome extension that displays handicap and scoring
statistics for GHIN.com by reading the same data GHIN.com's own website
already loads into your browser. This policy explains what the extension
does and does not do with your data. The code for this is all open source and you can find more info at the GitHub link below.

## What data the extension reads

While you browse GHIN.com, the extension observes the responses GHIN.com's
own frontend receives from its API (`api2.ghin.com`) — things like your
account info, handicap history, posted scores, and followed-golfers list.
It also lets you actively trigger a few of the same requests yourself (the
"Fetch full history" and "Analyze All Followed Golfers" buttons), using
your own already-logged-in GHIN.com session.

The extension does not intercept your GHIN.com password, payment
information, or any data from any site other than `*.ghin.com`.

## Where that data goes

**Nowhere but your own browser.** All captured data is stored locally using
Chrome's `chrome.storage.local` API, on your device only. The extension:

- Does not send any data to a server operated by the developer.
- Does not send any data to any third party, analytics provider, or
  advertising network.
- Does not use cookies, fingerprinting, or any tracking mechanism.
- Makes network requests only to `api2.ghin.com`, and only using your own
  browser session — never to any other domain.

You can delete all locally stored data at any time using the "Clear data"
button in the extension's side panel, or by removing the extension.

## Permissions

| Permission | Why it's needed |
|---|---|
| `storage` | Saves captured data locally so it persists across browser sessions. |
| `sidePanel` | Displays the extension's tables and charts in Chrome's side panel. |
| Host access to `https://*.ghin.com/*` | Lets the extension read GHIN.com's own API responses and make the same kind of requests GHIN.com's own frontend already makes, using your logged-in session. |

## Changes to this policy

If this policy changes, the "Last updated" date above will be revised. Any
material change (e.g. a new data destination) will also be reflected in the
extension's Chrome Web Store listing.

## Contact

Questions about this policy or the extension can be directed to:
`https://github.com/jaceiverson/ghin_golf/issues`
