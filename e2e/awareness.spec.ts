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

test.describe('awareness / presence', () => {
  test('two users appear in each others awareness states with names + colors', async ({ browser }) => {
    const room = newRoom();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const pageA = await openRoom(ctxA, room);
      const pageB = await openRoom(ctxB, room);

      // Each page should see two users in its awareness map (self + remote).
      await expect.poll(async () =>
        (await pageA.evaluate(() => window.__draftPunk!.getAwarenessStates())).length,
      ).toBe(2);
      await expect.poll(async () =>
        (await pageB.evaluate(() => window.__draftPunk!.getAwarenessStates())).length,
      ).toBe(2);

      // Every state has the required user fields populated.
      const aStates = await pageA.evaluate(() => window.__draftPunk!.getAwarenessStates());
      for (const u of aStates) {
        expect(u.userId).toBeTruthy();
        expect(u.name).toBeTruthy();
        expect(u.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(u.tool === 'pen' || u.tool === 'eraser').toBe(true);
      }
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('cursor position published from one client appears in the others awareness', async ({ browser }) => {
    const room = newRoom();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const pageA = await openRoom(ctxA, room);
      const pageB = await openRoom(ctxB, room);

      // A's clientID — to filter A out of B's awareness states.
      const aSelfId = await pageA.evaluate(() => {
        const states = window.__draftPunk!.getAwarenessStates();
        return states[0]?.userId; // either A or B; we'll filter by inequality below
      });

      // A publishes a cursor at (321, 654).
      await pageA.evaluate(() =>
        window.__draftPunk!.setCursor({ x: 321, y: 654 }),
      );

      // B should observe A's cursor.
      await expect.poll(async () => {
        const states = await pageB.evaluate(() => window.__draftPunk!.getAwarenessStates());
        const remote = states.find((s) => s.cursor !== null);
        return remote?.cursor ?? null;
      }).toEqual({ x: 321, y: 654 });

      // Sanity check: A's own awareness reflects A's cursor too.
      await expect.poll(async () => {
        const states = await pageA.evaluate(() => window.__draftPunk!.getAwarenessStates());
        return states.find((s) => s.cursor !== null)?.cursor ?? null;
      }).toEqual({ x: 321, y: 654 });

      // A clears its cursor (simulates pointerleave).
      await pageA.evaluate(() => window.__draftPunk!.setCursor(null));

      // B should no longer see any non-null cursor (assuming B hasn't moved its own).
      await expect.poll(async () => {
        const states = await pageB.evaluate(() => window.__draftPunk!.getAwarenessStates());
        return states.filter((s) => s.cursor !== null).length;
      }).toBe(0);

      // Suppress unused warning.
      void aSelfId;
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('switching tools updates awareness so other users see your active tool', async ({ browser }) => {
    const room = newRoom();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const pageA = await openRoom(ctxA, room);
      const pageB = await openRoom(ctxB, room);

      await pageA.evaluate(() => window.__draftPunk!.setTool('eraser'));

      // Find A's state in B's awareness; A is the one whose tool == 'eraser'.
      await expect.poll(async () => {
        const states = await pageB.evaluate(() => window.__draftPunk!.getAwarenessStates());
        return states.some((s) => s.tool === 'eraser');
      }).toBe(true);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
