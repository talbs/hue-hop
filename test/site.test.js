import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PAGES, readFills, renderPage } from '../scripts/pages.js';

test('the 404 renders the element from any path', () => {
  const manifest = JSON.parse(readFileSync('custom-elements.json', 'utf8'));
  const entry = PAGES.find((page) => page.source === '404.html');
  const html = renderPage(entry, readFills(manifest));
  assert.doesNotMatch(html, /(?:href|src)="\.\.?\//);
  assert.match(html, /<hue-hop[\s>]/);
  assert.match(
    html,
    /<script type="module">[\s\S]*?customElements\.define\(["']hue-hop["']/
  );
  assert.doesNotMatch(html, /src="[^"]*dist\/hue-hop\.js"/);
});
