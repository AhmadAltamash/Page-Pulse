const express = require('express');
const path = require('path');
const { parsePage, validateUrl } = require('./lib/parser');

const app = express();
const PORT = process.env.PORT || 3000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * POST /api/audit
 * body: { "url": "https://example.com" }
 * 200 -> { url, finalUrl, status, responseTimeMs, title, metaDescription,
 *          h1Count, imagesMissingAlt, totalImages, wordCount }
 * 4xx/5xx -> { error: "human readable message" }
 */
app.post('/api/audit', async (req, res) => {
  const { url } = req.body || {};

  // 1) Validate input before touching the network.
  let target;
  try {
    target = validateUrl(url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // 2) Fetch with a hard timeout so a slow/hanging site can't hang the request.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startedAt = Date.now();
  let response;

  try {
    response = await fetch(target.href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'PagePulse-Audit-Bot/1.0 (+https://digitalheroesco.com)'
      }
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: `Timed out after ${FETCH_TIMEOUT_MS / 1000}s waiting for a response.` });
    }
    // DNS failure, connection refused, TLS error, etc. all land here.
    return res.status(502).json({ error: `Could not reach that URL (${err.cause?.code || err.message}).` });
  }
  clearTimeout(timeout);
  const responseTimeMs = Date.now() - startedAt;

  // 3) Only attempt to parse HTML. Anything else is reported, not crashed on.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return res.status(415).json({
      error: `That URL returned "${contentType.split(';')[0] || 'an unknown content type'}", not HTML, so there's nothing to audit.`,
      status: response.status,
      responseTimeMs
    });
  }

  let html;
  try {
    html = await response.text();
  } catch (err) {
    return res.status(502).json({ error: 'Received a response but could not read its body.' });
  }

  // 4) Parse. This is wrapped defensively — a malformed page should never 500.
  let report;
  try {
    report = parsePage(html);
  } catch (err) {
    return res.status(500).json({ error: 'Fetched the page but could not parse it.' });
  }

  return res.status(200).json({
    url: target.href,
    finalUrl: response.url,
    status: response.status,
    responseTimeMs,
    ...report
  });
});

// Catch anything unexpected so the process never dies on a bad request.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

app.listen(PORT, () => {
  console.log(`Page Pulse listening on http://localhost:${PORT}`);
});

module.exports = app;
