// Renders the brand images in public/: the social cards (1200×630, English and Korean) from
// scripts/social-card.html, and the 180×180 apple-touch-icon from public/favicon.svg.
// Usage: node scripts/brand-images.mjs [bar]   (bar: where the card's eight-bar phrase starts, default 24)
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const bar = process.argv[2] ?? '24';
const server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'error' });
await server.listen();
// Playwright's own Chromium if it is installed, otherwise the system's Chrome or Edge.
const launch = async () => { for (const channel of [undefined, 'chrome', 'msedge']) { try { return await chromium.launch({ channel }); } catch {} } throw Error('no Chromium, Chrome or Edge found'); };
const browser = await launch();
try {
  for (const [lang, file] of [['en', 'social-card.png'], ['ko', 'social-card-ko.png']]) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => { throw error; });
    await page.goto(`${server.resolvedUrls.local[0]}scripts/social-card.html?bar=${bar}&lang=${lang}`);
    await page.waitForSelector('body[data-ready]');
    await page.screenshot({ path: `public/${file}` });
    await page.close();
    console.log(`public/${file}`);
  }
  // iOS rounds the corners itself, so the icon is drawn on a full square of the same colour.
  const page = await browser.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
  const svg = Buffer.from(readFileSync('public/favicon.svg')).toString('base64');
  await page.setContent(`<body style="margin:0;background:#101113"><img src="data:image/svg+xml;base64,${svg}" width="180" height="180" style="display:block"></body>`);
  await page.waitForFunction(() => document.images[0].complete);
  await page.screenshot({ path: 'public/apple-touch-icon.png' });
  console.log('public/apple-touch-icon.png');
} finally {
  await browser.close();
  await server.close();
}
