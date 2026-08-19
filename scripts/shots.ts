/**
 * Screenshot every UI state into docs/shots/.
 *
 * "Done" for UI means the states were looked at, not that the code compiled
 * (docs/spec/ui-contract.md section 5). This script is how that gets checked.
 *
 * Run with the server already up:  npm run dev   (or REPLAY=1 npm run dev)
 * Then:                            npm run shots
 */

import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = `http://127.0.0.1:${process.env.PORT ?? 8787}`;
const OUT = path.resolve(process.cwd(), 'docs', 'shots');
const WIDE = { width: 1440, height: 900 };

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

/** Wait until the grid actually has data rows, not skeleton rows. */
async function waitForChain(page: Page) {
  await page.waitForFunction(
    `document.querySelectorAll('#ocBody tr:not(.skel)').length > 5`,
    null, { timeout: 25_000 },
  );
  await page.waitForTimeout(600);
}

async function open(theme: 'light' | 'dark', panel: boolean) {
  const ctx = await browser.newContext({
    viewport: WIDE,
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  await ctx.addInitScript(([t, p]) => {
    localStorage.setItem('theme', t as string);
    localStorage.setItem('panel', p ? '1' : '0');
  }, [theme, panel] as [string, boolean]);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}

console.log(`\nshooting ${BASE} -> docs/shots/\n`);

/* 1-2. the main screen, both themes, panel open */
for (const theme of ['light', 'dark'] as const) {
  const { ctx, page } = await open(theme, true);
  await waitForChain(page);
  await shot(page, `01-chain-${theme}`);
  await ctx.close();
}

/* 3. panel closed - the default on a 1440 screen, full-width grid */
{
  const { ctx, page } = await open('dark', false);
  await waitForChain(page);
  await shot(page, '02-grid-fullwidth-dark');
  await ctx.close();
}

/* 4. every instrument chip */
{
  const { ctx, page } = await open('dark', false);
  await waitForChain(page);
  const ids: string[] = await page.$$eval('#chips .chip', els => els.map(e => e.textContent!.replace(/\d+$/, '').trim()));
  for (let i = 0; i < ids.length; i++) {
    await page.keyboard.press(String(i + 1));
    await waitForChain(page);
    await shot(page, `03-instrument-${i + 1}-${ids[i]!.replace(/\s+/g, '')}`);
  }
  await ctx.close();
}

/* 5. first paint / skeleton */
{
  const ctx = await browser.newContext({ viewport: WIDE, deviceScaleFactor: 2, colorScheme: 'dark' });
  const page = await ctx.newPage();
  // Hold the stream open with no data so the skeleton is what renders.
  await page.route('**/api/stream*', route => new Promise(() => { void route; }));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ocBody tr.skel');
  await page.waitForTimeout(500);
  await shot(page, '04-skeleton');
  await ctx.close();
}

/* 6. search filter */
{
  const { ctx, page } = await open('dark', false);
  await waitForChain(page);
  await page.fill('#search', '241');
  await page.waitForTimeout(400);
  await shot(page, '05-search-filter');
  await ctx.close();
}

/* 7. latency panel close-up */
{
  const { ctx, page } = await open('dark', true);
  await waitForChain(page);
  await page.keyboard.press('6');   // GOLD: MCX is the session most likely to be open
  await waitForChain(page);
  await page.waitForTimeout(22000); // let the sparkline and percentiles fill
  const el = await page.$('#lat');
  await el!.screenshot({ path: path.join(OUT, '06-latency-panel.png') });
  console.log('  06-latency-panel.png');
  await ctx.close();
}

/* 8. backend unreachable - the expressive error state */
{
  const ctx = await browser.newContext({ viewport: WIDE, deviceScaleFactor: 2, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.route('**/api/instruments', route => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#expState:not([hidden])', { timeout: 10_000 });
  await page.waitForTimeout(400);
  await shot(page, '07-error-state');
  await ctx.close();
}

/* 9. narrow viewport */
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 800 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitForChain(page);
  await shot(page, '08-1024px');
  await ctx.close();
}

await browser.close();
console.log(`\ndone -> ${OUT}\n`);
