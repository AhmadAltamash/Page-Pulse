# Page Pulse

A small tool that audits any URL: fetches the page, and reports its HTTP status,
response time, title, meta description, H1 count, images missing `alt` text, and
approximate word count.

<img src="/public/page-pulse.png"/>

Built for **Digital Heroes Training Task** — [digitalheroesco.com](https://digitalheroesco.com)
Live URL: (https://page-pulse-jwjm.onrender.com/)

## Setup

Requires Node 18+ (uses the built-in `fetch`).

```bash
npm install
npm start        # serves the app on http://localhost:3000
```

Run tests:

```bash
npm test
```

Project layout:

```
server.js           Express app + the /api/audit route
lib/parser.js        Pure parsing/validation logic (no network) — this is what's unit tested
public/index.html     Frontend: single static page, no build step
tests/parser.test.js  Jest tests for lib/parser.js
```

## API contract

### `POST /api/audit`

**Request body**

```json
{ "url": "https://example.com" }
```

**Success — `200`**

```json
{
  "url": "https://example.com/",
  "finalUrl": "https://example.com/",
  "status": 200,
  "responseTimeMs": 184,
  "title": "Example Domain",
  "metaDescription": "A page used for illustration.",
  "h1Count": 1,
  "imagesMissingAlt": 2,
  "totalImages": 5,
  "wordCount": 312
}
```

`url` is what was requested; `finalUrl` is where the browser ended up after
redirects, so the caller can tell if a redirect happened.

**Failure — `4xx` / `5xx`**

```json
{ "error": "That is not a valid URL. Include the protocol, e.g. https://example.com" }
```

| Status | Meaning |
|---|---|
| `400` | Missing/malformed URL, or an unsupported protocol (only `http`/`https`) |
| `415` | The URL responded, but with a non-HTML content type |
| `502` | DNS failure, connection refused, or the response body couldn't be read |
| `504` | No response within the 10s timeout |
| `500` | Anything unexpected — caught so the server never crashes on a bad page |

The server never throws an unhandled error back at the caller: every failure
path is caught and turned into one of the JSON shapes above.

## Design decisions

**1. Parsing logic lives in `lib/parser.js`, separate from the Express route.**
`parsePage()` and `validateUrl()` take plain strings in and return plain
objects out — no `req`/`res`, no network calls. That's what makes them
testable with plain Jest, with no server running and no HTTP mocking needed.
The route in `server.js` is left thin: fetch, then hand the result to the
parser.

**2. `alt=""` counts as present, not missing.**
The task asks for "images missing alt text." A blank `alt=""` is the
standard way to mark an image as purely decorative (per WCAG) — it's a
deliberate choice, not an oversight. Only images with no `alt` attribute at
all are counted as gaps. Treating `alt=""` as a failure would flag correct,
accessible markup as a bug.

**3. A hard fetch timeout (10s) plus content-type gating before parsing.**
Two failure modes are handled *before* any HTML parsing is attempted: a
site that never responds (aborted via `AbortController` after 10s → `504`),
and a URL that responds but isn't HTML — a PDF, an image, a JSON API (→
`415`). Rejecting non-HTML by content-type, rather than trying to parse
whatever comes back, is what keeps the parser from being asked to handle
input it was never meant to see.

## Tests

`tests/parser.test.js` covers:
- Happy path: title, meta description, H1 count, alt-text gaps, and word
  count all extracted correctly from valid HTML.
- Failure case: empty/blank HTML input — returns a zeroed report instead of
  throwing.
- Failure case: malformed/truncated HTML (unterminated tags) — doesn't
  throw, still recovers what it can.
- Two supporting cases: script/style text is excluded from the word count,
  and URL validation rejects bad input (non-URL strings, unsupported
  protocols, empty strings) with clear messages.

## Deploying (free tier)

**Render** (recommended — this is a long-running server, not a serverless function):
1. Push this repo to GitHub.
2. On [render.com](https://render.com) → New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Deploy — Render gives you a public `https://your-app.onrender.com` URL.

**Railway** works the same way if you prefer it.

## What I'd change with another day

I'd add a response cache(same URL audited twice in quick succession shouldn't re-fetch), and swap
the naive whitespace-split word count for something that ignores nav/footer
boilerplate so the count reflects actual page content.
