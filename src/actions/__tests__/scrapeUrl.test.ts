import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock puppeteer-core before importing the module under test
const mockClose = vi.fn();
const mockGoto = vi.fn();
const mockSetViewport = vi.fn();
const mockSetUserAgent = vi.fn();
const mockEvaluate = vi.fn();
const mockNewPage = vi.fn();
const mockConnect = vi.fn();

vi.mock('puppeteer-core', () => ({
  default: {
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}));

// Import after mocking
import { scrapeUrl } from '../scrapeUrl';

function createMockPage() {
  return {
    setViewport: mockSetViewport,
    setUserAgent: mockSetUserAgent,
    goto: mockGoto,
    evaluate: mockEvaluate,
  };
}

function createMockBrowser() {
  return {
    newPage: mockNewPage,
    close: mockClose,
  };
}

describe('scrapeUrl', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.BROWSERLESS_URL;
    vi.clearAllMocks();

    // Default: set up working mocks
    const mockPage = createMockPage();
    const mockBrowser = createMockBrowser();
    mockConnect.mockResolvedValue(mockBrowser);
    mockNewPage.mockResolvedValue(mockPage);
    mockClose.mockResolvedValue(undefined);
    mockSetViewport.mockResolvedValue(undefined);
    mockSetUserAgent.mockResolvedValue(undefined);
    mockGoto.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BROWSERLESS_URL = originalEnv;
    } else {
      delete process.env.BROWSERLESS_URL;
    }
  });

  // 6.1 Missing/empty BROWSERLESS_URL
  describe('missing BROWSERLESS_URL', () => {
    it('returns ScrapeError when BROWSERLESS_URL is not set', async () => {
      delete process.env.BROWSERLESS_URL;

      const result = await scrapeUrl('https://example.com');

      expect(result).toEqual({
        success: false,
        error: 'BROWSERLESS_URL environment variable is not configured',
      });
    });

    it('returns ScrapeError when BROWSERLESS_URL is empty string', async () => {
      process.env.BROWSERLESS_URL = '';

      const result = await scrapeUrl('https://example.com');

      expect(result).toEqual({
        success: false,
        error: 'BROWSERLESS_URL environment variable is not configured',
      });
    });
  });

  // 6.2 puppeteer.connect() failure
  it('returns ScrapeError when puppeteer.connect() fails', async () => {
    process.env.BROWSERLESS_URL = 'wss://fake-endpoint';
    mockConnect.mockRejectedValue(new Error('WebSocket connection refused'));

    const result = await scrapeUrl('https://example.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/^Failed to connect to browser service:/);
      expect(result.error).toContain('WebSocket connection refused');
    }
  });

  // 6.3 Navigation timeout
  it('returns ScrapeError on navigation timeout', async () => {
    process.env.BROWSERLESS_URL = 'wss://fake-endpoint';
    mockGoto.mockRejectedValue(new Error('Navigation timeout of 30000 ms exceeded'));

    const result = await scrapeUrl('https://example.com');

    expect(result).toEqual({
      success: false,
      error: 'Page timed out after 30 seconds',
    });
  });

  // 6.4 Network error during navigation
  it('returns ScrapeError on network error during navigation', async () => {
    process.env.BROWSERLESS_URL = 'wss://fake-endpoint';
    mockGoto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

    const result = await scrapeUrl('https://example.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/^Navigation failed:/);
      expect(result.error).toContain('net::ERR_NAME_NOT_RESOLVED');
    }
  });

  // 6.5 Invalid URL
  it('returns ScrapeError with "Invalid URL format" for invalid URL', async () => {
    const result = await scrapeUrl('not-a-valid-url');

    expect(result).toEqual({
      success: false,
      error: 'Invalid URL format',
    });
  });

  // 6.6 Login wall detection
  it('returns ScrapeError when login wall is detected', async () => {
    process.env.BROWSERLESS_URL = 'wss://fake-endpoint';

    // First evaluate call is detectLoginWall → return true
    // The function calls page.evaluate multiple times; we need to return true for login wall
    mockEvaluate.mockResolvedValueOnce(true);

    const result = await scrapeUrl('https://www.instagram.com/p/abc123/');

    expect(result).toEqual({
      success: false,
      error: 'Instagram is blocking access. Try pasting the location name manually.',
    });
  });

  // 6.7 Successful scrape
  it('returns ScrapeResult with all fields on successful scrape', async () => {
    process.env.BROWSERLESS_URL = 'wss://fake-endpoint';

    // detectLoginWall → false
    mockEvaluate.mockResolvedValueOnce(false);
    // extractTitle → title
    mockEvaluate.mockResolvedValueOnce('Beautiful Bali Temple');
    // extractImage → image URL
    mockEvaluate.mockResolvedValueOnce('https://example.com/bali.jpg');
    // extractLocation → location string
    mockEvaluate.mockResolvedValueOnce('Bali, Indonesia');
    // extractContextualHints → hints array
    mockEvaluate.mockResolvedValueOnce(['Bali', 'Indonesia', 'Temple']);

    const result = await scrapeUrl('https://example.com/bali-post');

    expect(result).toEqual({
      success: true,
      title: 'Beautiful Bali Temple',
      imageUrl: 'https://example.com/bali.jpg',
      location: 'Bali, Indonesia',
      contextualHints: ['Bali', 'Indonesia', 'Temple'],
      sourceUrl: 'https://example.com/bali-post',
    });
  });

  // 6.8 browser.close() called in both success and error paths
  describe('browser.close() cleanup', () => {
    it('calls browser.close() on successful scrape', async () => {
      process.env.BROWSERLESS_URL = 'wss://fake-endpoint';

      mockEvaluate.mockResolvedValueOnce(false);   // detectLoginWall
      mockEvaluate.mockResolvedValueOnce('Title');  // extractTitle
      mockEvaluate.mockResolvedValueOnce(null);     // extractImage
      mockEvaluate.mockResolvedValueOnce('Paris');   // extractLocation
      mockEvaluate.mockResolvedValueOnce([]);        // extractContextualHints

      await scrapeUrl('https://example.com');

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('calls browser.close() on navigation error', async () => {
      process.env.BROWSERLESS_URL = 'wss://fake-endpoint';
      mockGoto.mockRejectedValue(new Error('net::ERR_FAILED'));

      await scrapeUrl('https://example.com');

      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  // 6.9 browser.close() failure does not override original result
  it('browser.close() failure does not override original scrape result', async () => {
    process.env.BROWSERLESS_URL = 'wss://fake-endpoint';

    mockEvaluate.mockResolvedValueOnce(false);          // detectLoginWall
    mockEvaluate.mockResolvedValueOnce('My Title');      // extractTitle
    mockEvaluate.mockResolvedValueOnce('https://img.jpg'); // extractImage
    mockEvaluate.mockResolvedValueOnce('Tokyo, Japan');  // extractLocation
    mockEvaluate.mockResolvedValueOnce(['Tokyo']);        // extractContextualHints

    // Make browser.close() throw
    mockClose.mockRejectedValue(new Error('Close failed'));

    const result = await scrapeUrl('https://example.com/tokyo');

    // Original result should still be returned despite close failure
    expect(result).toEqual({
      success: true,
      title: 'My Title',
      imageUrl: 'https://img.jpg',
      location: 'Tokyo, Japan',
      contextualHints: ['Tokyo'],
      sourceUrl: 'https://example.com/tokyo',
    });
  });
});
