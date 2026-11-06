import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 };

export async function renderSocialImage({
  wordmark,
  wordmarkSteps,
  surface,
  outputPath,
}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: SOCIAL_IMAGE_SIZE });
  await page.setContent(`<!doctype html>
<style>
  ${readFileSync('src/hues.css', 'utf8')}
  ${wordmarkSteps}
  :root {
    color-scheme: dark;
  }
  body {
    display: grid;
    place-items: center;
    block-size: 100vh;
    margin: 0;
    background: ${surface};
  }
  .wordmark {
    display: block;
    inline-size: 840px;
  }
  .wordmark path {
    fill: currentColor;
  }
</style>
<hue-hop hue="dusk">${wordmark}</hue-hop>`);
  await page.screenshot({ path: outputPath });
  await browser.close();
}
