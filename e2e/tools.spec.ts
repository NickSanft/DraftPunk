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

test.describe('eraser + undo', () => {
  test('deleteStroke removes a stroke; undo restores it; redo deletes again', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());
      await page.evaluate(() => window.__draftPunk!.seed(3));
      await expect.poll(() => strokeCount(page)).toBe(3);

      // Wait past UndoManager.captureTimeout (default 500ms) so the next
      // op becomes its own undo step rather than merging with the seed.
      await page.waitForTimeout(600);

      // Delete the first stroke (origin = clientID, so undo can track it)
      await page.evaluate(() => window.__draftPunk!.deleteStroke(0));
      await expect.poll(() => strokeCount(page)).toBe(2);

      // Undo — stroke comes back
      await page.evaluate(() => window.__draftPunk!.undo());
      await expect.poll(() => strokeCount(page)).toBe(3);

      // Redo — stroke gone again
      await page.evaluate(() => window.__draftPunk!.redo());
      await expect.poll(() => strokeCount(page)).toBe(2);
    } finally {
      await ctx.close();
    }
  });

  test('Toolbar undo button triggers undo', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());

      // The undo button is disabled until something has been added
      const undoBtn = page.locator('button[data-action="undo"]');
      await expect(undoBtn).toBeDisabled();

      await page.evaluate(() => window.__draftPunk!.seed(1));
      await expect.poll(() => strokeCount(page)).toBe(1);
      await expect(undoBtn).toBeEnabled();

      await undoBtn.click();
      await expect.poll(() => strokeCount(page)).toBe(0);
    } finally {
      await ctx.close();
    }
  });

  test('keyboard shortcuts: B/E switch tools, Ctrl+Z undoes', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await openRoom(ctx, newRoom());

      await expect.poll(() => page.evaluate(() => window.__draftPunk!.getTool())).toBe('pen');
      await page.keyboard.press('e');
      await expect.poll(() => page.evaluate(() => window.__draftPunk!.getTool())).toBe('eraser');
      await page.keyboard.press('b');
      await expect.poll(() => page.evaluate(() => window.__draftPunk!.getTool())).toBe('pen');

      await page.evaluate(() => window.__draftPunk!.seed(1));
      await expect.poll(() => strokeCount(page)).toBe(1);

      await page.keyboard.press('Control+z');
      await expect.poll(() => strokeCount(page)).toBe(0);
    } finally {
      await ctx.close();
    }
  });
});

test.describe('collaborative undo', () => {
  test('User A undo only affects A; B\'s strokes survive', async ({ browser }) => {
    const room = newRoom();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const pageA = await openRoom(ctxA, room);
      const pageB = await openRoom(ctxB, room);

      // A draws 2 strokes, then B draws 3 strokes. Both totals reach 5.
      await pageA.evaluate(() => window.__draftPunk!.seed(2));
      await expect.poll(() => strokeCount(pageA)).toBe(2);
      await expect.poll(() => strokeCount(pageB)).toBe(2);

      await pageB.evaluate(() => window.__draftPunk!.seed(3));
      await expect.poll(() => strokeCount(pageA)).toBe(5);
      await expect.poll(() => strokeCount(pageB)).toBe(5);

      // A undoes — should remove A's two strokes only, leaving B's three.
      // (seedStrokes wraps in one transact, so it's one undo step.)
      await pageA.evaluate(() => window.__draftPunk!.undo());
      await expect.poll(() => strokeCount(pageA)).toBe(3);
      await expect.poll(() => strokeCount(pageB)).toBe(3);

      // A redo brings back A's two; total back to 5.
      await pageA.evaluate(() => window.__draftPunk!.redo());
      await expect.poll(() => strokeCount(pageA)).toBe(5);
      await expect.poll(() => strokeCount(pageB)).toBe(5);

      // B's undo stack should be independent — B can also undo its own 3.
      await pageB.evaluate(() => window.__draftPunk!.undo());
      await expect.poll(() => strokeCount(pageA)).toBe(2);
      await expect.poll(() => strokeCount(pageB)).toBe(2);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
