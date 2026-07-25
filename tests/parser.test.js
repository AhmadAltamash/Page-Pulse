const { parsePage, validateUrl } = require('../lib/parser');

describe('parsePage', () => {
  test('happy path: extracts title, meta description, headings, alt gaps, word count', () => {
    const html = `
      <html>
        <head>
          <title> Example Domain </title>
          <meta name="description" content="A page used for illustration.">
        </head>
        <body>
          <h1>Welcome</h1>
          <p>This is a short paragraph with five words.</p>
          <img src="a.jpg" alt="a hero image">
          <img src="b.jpg">
          <img src="c.jpg" alt="">
        </body>
      </html>`;

    const result = parsePage(html);

    expect(result.title).toBe('Example Domain');
    expect(result.metaDescription).toBe('A page used for illustration.');
    expect(result.h1Count).toBe(1);
    expect(result.totalImages).toBe(3);
    // Only the image with no alt attribute at all counts as "missing".
    // alt="" is a deliberate decorative-image marker and is not a violation.
    expect(result.imagesMissingAlt).toBe(1);
    expect(result.wordCount).toBeGreaterThan(0);
  });

  test('failure case: empty/blank HTML does not throw, returns a zeroed report', () => {
    const result = parsePage('');
    expect(result).toEqual({
      title: null,
      metaDescription: null,
      h1Count: 0,
      imagesMissingAlt: 0,
      totalImages: 0,
      wordCount: 0
    });
  });

  test('failure case: malformed/truncated HTML does not throw', () => {
    const brokenHtml = '<html><head><title>Broken<body><h1>Oops<p>unterminated tags all the way down';
    expect(() => parsePage(brokenHtml)).not.toThrow();
    const result = parsePage(brokenHtml);
    // cheerio's forgiving parser should still recover what it can.
    expect(result.h1Count).toBe(1);
  });

  test('script and style content is excluded from the word count', () => {
    const html = `
      <html><body>
        <script>var thisShouldNotCount = "lots of extra words in here";</script>
        <style>.thisShouldNotCount { color: red; padding: 10px; }</style>
        <p>Only these four words.</p>
      </body></html>`;
    const result = parsePage(html);
    expect(result.wordCount).toBe(4);
  });
});

describe('validateUrl', () => {
  test('accepts a well-formed https URL', () => {
    const parsed = validateUrl('https://example.com/page');
    expect(parsed.hostname).toBe('example.com');
  });

  test('failure case: rejects a non-URL string instead of throwing an unhandled error', () => {
    expect(() => validateUrl('not a url')).toThrow(/not a valid URL/i);
  });

  test('failure case: rejects unsupported protocols like ftp://', () => {
    expect(() => validateUrl('ftp://example.com/file')).toThrow(/http/i);
  });

  test('rejects an empty string', () => {
    expect(() => validateUrl('')).toThrow(/required/i);
  });
});
