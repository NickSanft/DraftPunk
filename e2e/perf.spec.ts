import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const newRoom = () => `test-${randomUUID()}`;

const openRoom = async (page: Page, room: string) => {
  await page.goto(`/?room=${room}&debug=1`);
  await expect(page.locator('.app-status')).toHaveText('connected');
  await page.waitForFunction(() => typeof window.__draftPunk !== 'undefined');
};

const RENDER_BUDGET_MS = 50;
const FRAME_BUDGET_MS = 16;

test.describe('render perf', () => {
  test('main canvas re-renders 1000 strokes within budget', async ({ page }) => {
    const room = newRoom();
    await openRoom(page, room);

    // Seed locally — observer fires once thanks to ydoc.transact in seedStrokes.
    await page.evaluate(() => window.__draftPunk!.seed(1000));
    await expect
      .poll(() => page.evaluate(() => window.__draftPunk!.getStrokeCount()), { timeout: 10_000 })
      .toBe(1000);

    // Trigger several full re-renders so the moving average has data to chew on.
    for (let i = 0; i < 5; i++) {
      await page.setViewportSize({ width: 1024 + i * 4, height: 768 + i * 4 });
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => r(undefined))),
      );
    }
    // Let the metrics settle.
    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => window.__draftPunk!.getMetrics());

    // Surface for failure diagnostics.
    // eslint-disable-next-line no-console
    console.log('1000-stroke perf:', metrics);

    expect(metrics.mainRenderCount).toBeGreaterThanOrEqual(5);
    expect(metrics.lastMainRenderMs).toBeLessThan(RENDER_BUDGET_MS);
    expect(metrics.avgMainRenderMs).toBeLessThan(RENDER_BUDGET_MS);
  });

  test('active stroke renders stay within frame budget during a drag', async ({ page }) => {
    const room = newRoom();
    await openRoom(page, room);

    // Pre-load 500 committed strokes so the active-stroke render isn't on an empty canvas.
    await page.evaluate(() => window.__draftPunk!.seed(500));
    await expect
      .poll(() => page.evaluate(() => window.__draftPunk!.getStrokeCount()), { timeout: 10_000 })
      .toBe(500);

    // Simulate a long drag across the active canvas. ~50 mousemove events.
    const canvas = page.locator('canvas.canvas-layer.active');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('active canvas not found');

    const startX = box.x + box.width * 0.2;
    const startY = box.y + box.height * 0.5;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 50; i++) {
      const t = i / 50;
      await page.mouse.move(
        startX + box.width * 0.6 * t,
        startY + Math.sin(t * Math.PI * 2) * 100,
      );
    }
    await page.mouse.up();

    await page.waitForTimeout(200);

    const metrics = await page.evaluate(() => window.__draftPunk!.getMetrics());
    const finalCount = await page.evaluate(() => window.__draftPunk!.getStrokeCount());
    // eslint-disable-next-line no-console
    console.log('active-stroke perf during drag (over 500 committed strokes):', metrics);

    // Sanity: the drag actually committed a stroke.
    expect(finalCount, 'drag should commit one stroke').toBe(501);
    // Sanity: at least one in-progress active render fired during the drag.
    expect(metrics.activeRenderCount, 'active renders during drag').toBeGreaterThan(0);
    // Real perf assertion: peak in-progress render stayed within frame budget.
    expect(metrics.maxActiveRenderMs).toBeLessThan(FRAME_BUDGET_MS);
  });
});
