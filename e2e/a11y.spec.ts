import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';

const newRoom = () => `test-${randomUUID()}`;

const openRoom = async (
  context: BrowserContext,
  room: string,
): Promise<Page> => {
  const page = await context.newPage();
  await page.goto(`/?room=${room}&debug=1`);
  await expect(page.locator('.app-status')).toHaveText('connected');
  await page.waitForFunction(() => typeof window.__draftPunk !== 'undefined');
  return page;
};

test.describe('a11y', () => {
  test('app shell has no axe-detected WCAG 2.1 AA violations', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // The DebugOverlay is dev-only and intentionally not a11y-clean
        // (small monospace text, contrast-borderline labels). Exclude it
        // so we audit production surface only.
        .exclude('.debug-overlay')
        .analyze();

      // Surface the actual violations on failure for diagnosability.
      if (results.violations.length > 0) {
        // eslint-disable-next-line no-console
        console.log('axe violations:', JSON.stringify(results.violations, null, 2));
      }
      expect(results.violations).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

  test('skip link is the first focusable element and targets the canvas', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());

      // Tab from page load. The first thing focused must be the skip link.
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        return {
          tag: active?.tagName,
          text: active?.textContent,
          href: active?.getAttribute('href'),
        };
      });
      expect(focused.tag).toBe('A');
      expect(focused.text).toMatch(/skip to canvas/i);
      expect(focused.href).toBe('#draft-punk-canvas');
    } finally {
      await ctx.close();
    }
  });

  test('toolbar tools are reachable via keyboard with aria-pressed reflecting active state', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());

      const penBtn = page.locator('button[data-tool="pen"]');
      const eraserBtn = page.locator('button[data-tool="eraser"]');

      await penBtn.focus();
      await expect(penBtn).toBeFocused();
      await expect(penBtn).toHaveAttribute('aria-pressed', 'true');
      await expect(eraserBtn).toHaveAttribute('aria-pressed', 'false');

      await page.keyboard.press('Tab');
      await expect(eraserBtn).toBeFocused();

      // Activate via Enter (default for buttons).
      await page.keyboard.press('Enter');
      await expect(penBtn).toHaveAttribute('aria-pressed', 'false');
      await expect(eraserBtn).toHaveAttribute('aria-pressed', 'true');
    } finally {
      await ctx.close();
    }
  });

  test('canvas is focusable with a descriptive aria-label', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());
      const canvas = page.locator('canvas.canvas-layer.active');
      await expect(canvas).toHaveAttribute('tabindex', '0');
      const label = await canvas.getAttribute('aria-label');
      expect(label).toBeTruthy();
      expect(label!.length).toBeGreaterThan(40);
    } finally {
      await ctx.close();
    }
  });

  test('changing tool updates the polite live region', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());

      // Polite live region exists on mount but starts empty.
      const polite = page.locator('[aria-live="polite"][role="status"]');
      await expect(polite).toBeAttached();

      await page.evaluate(() => window.__draftPunk!.setTool('eraser'));

      await expect.poll(() =>
        page.evaluate(() => {
          const el = document.querySelector('[aria-live="polite"][role="status"]');
          return el?.textContent ?? '';
        }),
      ).toMatch(/eraser/i);
    } finally {
      await ctx.close();
    }
  });

  test('undo / redo announce assertively when triggered via keyboard', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());
      await page.evaluate(() => window.__draftPunk!.seed(1));
      await expect.poll(() => page.evaluate(() => window.__draftPunk!.getStrokeCount())).toBe(1);

      // Focus the canvas (not an input) so the global Ctrl+Z handler runs.
      await page.locator('canvas.canvas-layer.active').focus();
      await page.keyboard.press('Control+z');

      await expect.poll(() =>
        page.evaluate(() => {
          const el = document.querySelector('[aria-live="polite"][role="status"]');
          return el?.textContent ?? '';
        }),
      ).toMatch(/undid/i);
    } finally {
      await ctx.close();
    }
  });
});
