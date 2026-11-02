import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { basename } from 'node:path';

const budgets = {
  'dist/hue-hop.js': 2048,
  'dist/drift.css': 400,
  'dist/hues.css': 600,
};

let isOverBudget = false;
for (const [path, budget] of Object.entries(budgets)) {
  const bytes = gzipSync(readFileSync(path), { level: 9 }).length;
  console.log(`${basename(path)} ${bytes} / ${budget}`);
  if (bytes > budget) isOverBudget = true;
}

if (isOverBudget) process.exit(1);
