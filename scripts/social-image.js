import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 };

const INSET = 80;
const COLUMNS = 12;
const MAX_BRICKS = 15;
const BRICK_HEIGHT = 20;
const BRICK_GAP = 8;

// The docs curve meter's bricks at twice the size, one column per step, rising left to right. Paths, so the wordmark's step formula colors them.
function equalizerSvg() {
  const width = SOCIAL_IMAGE_SIZE.width - 2 * INSET;
  const height = SOCIAL_IMAGE_SIZE.height;
  const columnWidth = (width - (COLUMNS - 1) * BRICK_GAP) / COLUMNS;
  const columns = [];
  for (let column = 0; column < COLUMNS; column++) {
    const progress = Math.pow(column / (COLUMNS - 1), 1.3);
    const brickCount = 1 + Math.round(progress * (MAX_BRICKS - 1));
    const x = column * (columnWidth + BRICK_GAP);
    let bricks = '';
    for (let brick = 0; brick < brickCount; brick++) {
      // Starts half a brick below the edge, so the bottom row runs off the card.
      const y = height - BRICK_HEIGHT / 2 - brick * (BRICK_HEIGHT + BRICK_GAP);
      bricks += `M${x} ${y}h${columnWidth}v${BRICK_HEIGHT}h${-columnWidth}z`;
    }
    columns.push(`<path style="--_hop-i: ${column}" d="${bricks}"/>`);
  }
  return `<svg class="equalizer" data-hop-steps style="--_hop-n: ${COLUMNS}" viewBox="0 0 ${width} ${height}">${columns.join('')}</svg>`;
}

export async function renderSocialImage({
  wordmark,
  wordmarkSteps,
  outputPath,
}) {
  const font = readFileSync(
    'site/fonts/onest-latin-wght-normal.woff2'
  ).toString('base64');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: SOCIAL_IMAGE_SIZE });
  await page.setContent(`<!doctype html>
<style>
  @font-face {
    font-family: 'Onest';
    src: url(data:font/woff2;base64,${font}) format('woff2');
    font-weight: 100 900;
  }
  ${readFileSync('site/css/tokens.css', 'utf8')}
  ${readFileSync('src/hues.css', 'utf8')}
  ${wordmarkSteps}
  body {
    position: relative;
    block-size: 100vh;
    margin: 0;
    background: var(--grain), var(--surface-sunken);
    font-family: 'Onest', sans-serif;
  }
  [data-hop-steps] path {
    fill: currentColor;
  }
  .equalizer {
    position: absolute;
    inset: 0 ${INSET}px;
    opacity: 0.22;
  }
  .lockup {
    position: absolute;
    inset: 88px auto auto ${INSET}px;
  }
  .lockup .wordmark {
    display: block;
    inline-size: 640px;
  }
  .lockup p {
    margin: 26px 0 0 4px;
    font-size: 32px;
    font-weight: 500;
    color: var(--ink-quiet);
  }
</style>
<hue-hop hue="dusk">${equalizerSvg()}</hue-hop>
<div class="lockup">
  <hue-hop hue="dusk">${wordmark}</hue-hop>
  <p>Every letter hops a hue.</p>
</div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: outputPath, type: 'jpeg', quality: 80 });
  await browser.close();
}
