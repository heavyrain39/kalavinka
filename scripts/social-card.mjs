// Renders public/social-card.png (1200×630) from scripts/social-card.html.
// Usage: node scripts/social-card.mjs [bar]   (bar: where the eight-bar phrase starts, default 24)
import { createServer } from 'vite';
import { chromium } from 'playwright';

const bar = process.argv[2] ?? '24';
const server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'error' });
await server.listen();
// Playwright's own Chromium if it is installed, otherwise the system's Chrome or Edge.
const launch = async () => { for (const channel of [undefined, 'chrome', 'msedge']) { try { return await chromium.launch({ channel }); } catch {} } throw Error('no Chromium, Chrome or Edge found'); };
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => { throw error; });
  await page.goto(`${server.resolvedUrls.local[0]}scripts/social-card.html?bar=${bar}`);
  await page.waitForSelector('body[data-ready]');
  await page.screenshot({ path: 'public/social-card.png' });
  console.log('public/social-card.png');
} finally {
  await browser.close();
  await server.close();
}
