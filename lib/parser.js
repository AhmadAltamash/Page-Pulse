const cheerio = require('cheerio');

/**
 * Turns raw HTML into the audit fields Page Pulse reports on.
 * Pure function: no network, no I/O. This is what tests/parser.test.js exercises.
 *
 * @param {string} html - raw HTML body of the page
 * @returns {{
 *   title: string|null,
 *   metaDescription: string|null,
 *   h1Count: number,
 *   imagesMissingAlt: number,
 *   totalImages: number,
 *   wordCount: number
 * }}
 */
function parsePage(html) {
  if (typeof html !== 'string' || html.trim().length === 0) {
    // Empty/blank body is a valid "page" (e.g. a blank HTML shell) — report zeros, don't throw.
    return {
      title: null,
      metaDescription: null,
      h1Count: 0,
      imagesMissingAlt: 0,
      totalImages: 0,
      wordCount: 0
    };
  }

  const $ = cheerio.load(html);

  const title = $('title').first().text().trim() || null;

  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null;

  const h1Count = $('h1').length;

  const images = $('img');
  const totalImages = images.length;
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    // Missing = no alt attribute at all. alt="" is a deliberate "decorative image" signal
    // and is treated as present per WCAG, so it does not count against the page.
    if (alt === undefined) imagesMissingAlt++;
  });

  // Strip script/style content before counting words so JS/CSS text doesn't inflate the count.
  $('script, style, noscript').remove();
  const bodyText = $('body').text() || $.root().text();
  const words = bodyText
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const wordCount = words.length && words[0] !== '' ? words.length : 0;

  return {
    title,
    metaDescription,
    h1Count,
    imagesMissingAlt,
    totalImages,
    wordCount
  };
}

/**
 * Validates a user-supplied URL string before we ever attempt a fetch.
 * Returns a normalized URL object on success, or throws a descriptive Error on failure.
 */
function validateUrl(input) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error('URL is required.');
  }

  let parsed;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error('That is not a valid URL. Include the protocol, e.g. https://example.com');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http:// and https:// URLs are supported.');
  }

  if (!parsed.hostname) {
    throw new Error('That URL is missing a host.');
  }

  return parsed;
}

module.exports = { parsePage, validateUrl };
