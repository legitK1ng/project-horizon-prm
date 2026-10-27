import { chromium } from 'playwright';

const url = process.argv[2] || 'http://10.0.0.10:3011/dashboard';
const out = process.argv[3] || 'C:/Users/owner/c_workspace_dashboard.png';

// Headed mode using the workspace's own bundled chromium — real window, 1440x900,
// mirrors a real desktop so layout matches the user's view.
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome',
  args: ['--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
try {
  await page.waitForFunction(() => document.body.innerText.includes('2514'), { timeout: 30000 });
} catch {
  console.log('WARN: data marker 2514 not found within 30s');
}
await page.waitForTimeout(2000);

const metrics = await page.evaluate(() => {
  const navText = document.body.innerText;
  const svg = [...document.querySelectorAll('svg')].find((s) => { const r = s.getBoundingClientRect(); return r.width > 100 && r.height > 100; });
  return {
    title: document.title,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    bigSvg: svg ? (() => { const r = svg.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), circles: svg.querySelectorAll('circle').length }; })() : null,
    hasSettingsTab: navText.includes('Settings'),
    hasIngestTab: navText.includes('Ingest'),
    has2514: navText.includes('2514'),
    navTextSnippet: navText.slice(0, 200).replace(/\s+/g, ' '),
  };
});

await page.screenshot({ path: out, fullPage: true });
console.log('METRICS ' + JSON.stringify(metrics));
await browser.close();
