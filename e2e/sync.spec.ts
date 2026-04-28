import { test, expect, type BrowserContext, type Page } from '@playwright/test';
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

test.describe('sync', () => {
  test('two browser contexts converge on the same stroke count', async ({ browser }) => {
    const room = newRoom();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageA = await openRoom(ctxA, room);
      const pageB = await openRoom(ctxB, room);

      await pageA.evaluate(() => window.__draftPunk!.seed(50));

      await expect.poll(() => strokeCount(pageA)).toBe(50);
      await expect.poll(() => strokeCount(pageB)).toBe(50);

      // Reverse direction — write from B, read from A
      await pageB.evaluate(() => window.__draftPunk!.seed(25));
      await expect.poll(() => strokeCount(pageA)).toBe(75);
      await expect.poll(() => strokeCount(pageB)).toBe(75);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('a late joiner receives strokes from the durable object snapshot', async ({ browser }) => {
    const room = newRoom();

    // First client seeds and disconnects.
    const seederCtx = await browser.newContext();
    const seederPage = await openRoom(seederCtx, room);
    await seederPage.evaluate(() => window.__draftPunk!.seed(50));
    await expect.poll(() => strokeCount(seederPage)).toBe(50);

    // Give PartyKit a moment to write its snapshot before disconnect.
    await seederPage.waitForTimeout(2000);
    await seederCtx.close();

    // Second client joins fresh — should receive all 50 strokes from the DO.
    const joinerCtx = await browser.newContext();
    try {
      const joinerPage = await openRoom(joinerCtx, room);
      await expect.poll(() => strokeCount(joinerPage), { timeout: 10_000 }).toBe(50);
    } finally {
      await joinerCtx.close();
    }
  });
});
