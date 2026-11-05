import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const hasSection = new RegExp(
  `^## ${version.replaceAll('.', '\\.')}( |$)`,
  'm'
).test(changelog);

console.log(
  `changelog: ${hasSection ? 'has' : 'MISSING'} a "## ${version}" section`
);
if (!hasSection) process.exit(1);
