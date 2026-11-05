import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PAGES, readFills, renderPage } from '../scripts/pages.js';

test('the 404 renders the element from any path', () => {
  const manifest = JSON.parse(readFileSync('custom-elements.json', 'utf8'));
  const entry = PAGES.find((page) => page.source === '404.html');
  const html = renderPage(entry, readFills(manifest));
  assert.doesNotMatch(html, /(?:href|src)="\.\.?\//);
});
