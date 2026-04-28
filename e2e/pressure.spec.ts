import { test, expect, type Page, type BrowserContext } from '@playwright/test';
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

const strokeCount = (page: Page) =>
  page.evaluate(() => window.__draftPunk!.getStrokeCount());

// Dispatch real PointerEvents on the active canvas with pen pointerType
// and explicit pressure values. Playwright's mouse API doesn't expose
// pressure or pointerType, so we go through evaluate().
async function drawPenStroke(
  page: Page,
  steps: Array<{ x: number; y: number; pressure: number }>,
): Promise<void> {
  await page.evaluate((stepsIn) => {
    const canvas = document.querySelector('canvas.canvas-layer.active') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();

    const fire = (
      type: string,
      x: number,
      y: number,
      pressure: number,
      buttons: number,
      button = -1,
    ) => {
      const evt = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + x,
        clientY: rect.top + y,
        pressure,
        pointerType: 'pen',
        pointerId: 1,
        isPrimary: true,
        buttons,
        button,
      });
      canvas.dispatchEvent(evt);
    };

    fire('pointerdown', stepsIn[0].x, stepsIn[0].y, stepsIn[0].pressure, 1, 0);
    for (let i = 1; i < stepsIn.length; i++) {
      const s = stepsIn[i];
      fire('pointermove', s.x, s.y, s.pressure, 1);
    }
    const last = stepsIn[stepsIn.length - 1];
    fire('pointerup', last.x, last.y, 0, 0, 0);
  }, steps);
}

test.describe('tablet pressure', () => {
  test('pen pointer events produce a stroke with pointerType=pen and pressure on each point', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());

      await drawPenStroke(page, [
        { x: 100, y: 100, pressure: 0.2 },
        { x: 150, y: 100, pressure: 0.5 },
        { x: 200, y: 100, pressure: 0.9 },
      ]);

      await expect.poll(() => strokeCount(page)).toBe(1);

      const stroke = await page.evaluate(() => window.__draftPunk!.getStrokes()[0]);
      expect(stroke.pointerType).toBe('pen');
      expect(stroke.points.length).toBeGreaterThanOrEqual(3);

      const pressures = stroke.points.map((p) => p.pressure);
      expect(pressures.every((p) => typeof p === 'number' && p > 0)).toBe(true);

      // Verify the actual hardware pressure values were preserved through
      // the input pipeline -> StrokeBuilder -> CRDT -> readback.
      expect(pressures[0]).toBeCloseTo(0.2, 5);
      expect(pressures[pressures.length - 1]).toBeCloseTo(0.9, 5);
    } finally {
      await ctx.close();
    }
  });

  test('mouse-drawn strokes have pointerType=mouse and constant pressure', async ({ browser }) => {
    // Sanity that mouse strokes still work the same way (not mistakenly
    // routed through the pressure renderer at render time).
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());

      const canvas = page.locator('canvas.canvas-layer.active');
      const box = await canvas.boundingBox();
      if (!box) throw new Error('active canvas not found');

      const startX = box.x + 100;
      const startY = box.y + 100;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await page.mouse.move(startX + i * 10, startY);
      }
      await page.mouse.up();

      await expect.poll(() => strokeCount(page)).toBe(1);

      const stroke = await page.evaluate(() => window.__draftPunk!.getStrokes()[0]);
      expect(stroke.pointerType).toBe('mouse');
      // PointerInputState stamps mouse pressure as 0.5 (Risk 8 in build plan)
      // so width remains constant under variable-width rendering.
      const pressures = stroke.points.map((p) => p.pressure);
      const allHalf = pressures.every((p) => p === 0.5);
      expect(allHalf).toBe(true);
    } finally {
      await ctx.close();
    }
  });

  test('pen eraser end (button=5) deletes strokes regardless of selected tool', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());

      // Seed a stroke at a known location with a known size by using a real
      // pen-down sequence in the middle of the canvas.
      await drawPenStroke(page, [
        { x: 300, y: 300, pressure: 0.5 },
        { x: 350, y: 300, pressure: 0.5 },
        { x: 400, y: 300, pressure: 0.5 },
      ]);
      await expect.poll(() => strokeCount(page)).toBe(1);

      // Confirm we're still on the pen tool.
      await expect.poll(() => page.evaluate(() => window.__draftPunk!.getTool())).toBe('pen');

      // Now dispatch a pen pointerdown with button=5 (eraser end) directly
      // over the stroke. This should delete the stroke even though the
      // selected tool is still pen.
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas.canvas-layer.active') as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const fire = (type: string, x: number, y: number, button: number, buttons: number) => {
          canvas.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + x,
              clientY: rect.top + y,
              pressure: 0.5,
              pointerType: 'pen',
              pointerId: 2,
              isPrimary: true,
              button,
              buttons,
            }),
          );
        };
        // button=5 is the eraser end on pointerdown
        fire('pointerdown', 350, 300, 5, 32);
        fire('pointerup', 350, 300, 5, 0);
      });

      await expect.poll(() => strokeCount(page)).toBe(0);

      // Selected tool should still be 'pen' — the pen-flip is per-gesture,
      // not a permanent tool switch.
      await expect.poll(() => page.evaluate(() => window.__draftPunk!.getTool())).toBe('pen');
    } finally {
      await ctx.close();
    }
  });
});
