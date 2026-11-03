import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  watch,
  writeFileSync,
} from 'node:fs';
import * as esbuild from 'esbuild';
import { readSide, showSide } from '../site/js/scheme.js';
import { DOCS_URL, REPO_URL, STUDIO_URL } from '../site/js/urls.js';

// Keep the kit restricted to talbs.github.io and localhost: the code ships in public HTML.
const FA_KIT = '7ce624a355';

const SERVE_PORT = 4174;

const read = (path) => readFileSync(path, 'utf8');

// Partials come first so the placeholders inside them get filled too.
const readFills = () => ({
  head: read('site/partials/head.html'),
  header: read('site/partials/header.html'),
  footer: read('site/partials/footer.html'),
  'fa-kit': FA_KIT,
  version: JSON.parse(read('package.json')).version,
  'docs-url': DOCS_URL,
  'repo-url': REPO_URL,
  'studio-url': STUDIO_URL,
  'side-boot': `<script>\n${readSide}\n${showSide}\nshowSide(readSide());\n</script>`,
});

function fillPage(html, navName, fills) {
  let page = html;
  for (const [name, text] of Object.entries(fills)) {
    page = page.replaceAll(`{{${name}}}`, text);
  }
  const leftover = page.match(/\{\{[\w-]+\}\}/);
  if (leftover) throw new Error(`Unfilled placeholder ${leftover[0]}`);
  return page.replace(
    `data-nav="${navName}"`,
    `data-nav="${navName}" aria-current="page"`
  );
}

async function buildSite() {
  rmSync('_site', { recursive: true, force: true });
  mkdirSync('_site');

  const fills = readFills();
  for (const file of readdirSync('site').filter((name) =>
    name.endsWith('.html')
  )) {
    const navName = file === 'index.html' ? 'home' : file.replace('.html', '');
    writeFileSync(
      `_site/${file}`,
      fillPage(read(`site/${file}`), navName, fills)
    );
    console.log('wrote', `_site/${file}`);
  }

  cpSync('site/css', '_site/css', { recursive: true });
  cpSync('site/js', '_site/js', {
    recursive: true,
    filter: (path) => !path.endsWith('wa.js'),
  });
  cpSync('site/fonts', '_site/fonts', { recursive: true });
  cpSync('site/icons', '_site/icons', { recursive: true });
  cpSync('dist', '_site/dist', { recursive: true });
  cpSync('node_modules/microlighter/dist', '_site/js/microlighter', {
    recursive: true,
    filter: (path) => !path.endsWith('.d.ts'),
  });

  await esbuild.build({
    entryPoints: ['site/js/wa.js'],
    outfile: '_site/js/wa.js',
    bundle: true,
    format: 'esm',
    minify: true,
    logLevel: 'warning',
  });

  // No native.css: it would restyle the desk's own buttons and inputs.
  await esbuild.build({
    stdin: {
      contents: [
        "@import '@awesome.me/webawesome/dist/styles/layers.css';",
        "@import '@awesome.me/webawesome/dist/styles/themes/default.css';",
        "@import '@awesome.me/webawesome/dist/styles/utilities.css';",
      ].join('\n'),
      resolveDir: '.',
      loader: 'css',
    },
    outfile: '_site/css/webawesome.css',
    bundle: true,
    minify: true,
    logLevel: 'warning',
  });

  console.log('wrote _site/css, _site/js, _site/fonts, _site/dist');
}

async function serveAndWatch() {
  const context = await esbuild.context({});
  await context.serve({
    servedir: '_site',
    host: '127.0.0.1',
    port: SERVE_PORT,
  });
  console.log(
    `serving http://localhost:${SERVE_PORT}/ (reload after each rebuild)`
  );

  let pending;
  const rebuildAfter = (isElementChange) => {
    clearTimeout(pending);
    pending = setTimeout(async () => {
      try {
        if (isElementChange)
          execFileSync('node', ['scripts/build.js'], { stdio: 'inherit' });
        await buildSite();
      } catch (error) {
        console.error(error.message);
      }
    }, 100);
  };
  watch('site', { recursive: true }, () => rebuildAfter(false));
  watch('src', { recursive: true }, () => rebuildAfter(true));
}

await buildSite();
if (process.argv.includes('--serve')) await serveAndWatch();
