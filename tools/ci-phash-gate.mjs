// CI safety gate: re-runs tools/phash-check.html in a real headless browser and fails
// the build if the perceptual-hash proof doesn't hold. This is the credibility core of
// the whole demo (build-spec.md §8) — if a future change to phash.js or a sample image
// breaks the match/separation guarantee, the deploy must not go out.
//
// Usage: node tools/ci-phash-gate.mjs  (expects the app to be served at http://localhost:8080)
import puppeteer from 'puppeteer';

const URL = process.env.GATE_URL || 'http://localhost:8080/tools/phash-check.html';

// --no-sandbox: GitHub Actions' ubuntu runners execute as root, and Chromium's sandbox
// refuses to start as root without it.
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForSelector('.verdict', { timeout: 15000 });

const verdictText = await page.$eval('.verdict', el => el.textContent);
const passed = await page.$eval('.verdict', el => el.classList.contains('ok'));

console.log(verdictText);
if (errors.length) {
  console.error('Console errors during gate run:\n' + errors.join('\n'));
}

await browser.close();

if (!passed || errors.length) {
  console.error('\nGATE FAILED — refusing to deploy.');
  process.exit(1);
}

console.log('\nGATE PASSED — safe to deploy.');
