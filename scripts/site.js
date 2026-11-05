import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, watch, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import * as esbuild from 'esbuild';
import { SITE_URL } from '../site/js/urls.js';
import { checkAnchors } from './anchors.js';
import { DOCS_LINKS, LLMS_RULES } from './copy.js';
import { llmsText } from './manifest.js';
import { PAGES, read, readFills, renderPage } from './pages.js';

const SERVE_PORT = 4174;
const isServing = process.argv.includes('--serve');

const WA_CHUNK = /webawesome\/dist\/chunks\/chunk\.\w+\.js$/;
const WA_ELEMENT = /customElement\("(wa-[a-z-]+)"\)/;

function readElementsInBundle(metafile) {
  const elements = new Set();
  for (const path of Object.keys(metafile.inputs)) {
    if (!WA_CHUNK.test(path)) continue;
    const element = read(path).match(WA_ELEMENT)?.[1];
    if (element) elements.add(element);
  }
  return elements;
}

// Registering a tag twice throws, so the Studio's bundle leaves out every element wa.js already registers.
function skipElements(elements) {
  return {
    name: 'skip-elements',
    setup(build) {
      build.onLoad({ filter: WA_CHUNK }, ({ path }) => {
        const element = read(path).match(WA_ELEMENT)?.[1];
        if (!elements.has(element)) return undefined;
        return { contents: '', loader: 'js' };
      });
    },
  };
}

// Served locally, the 404's absolute root would load the deployed site's files, not this checkout's.
function forThisBuild(entry) {
  return isServing && entry.root === SITE_URL ? { ...entry, root: '/' } : entry;
}

async function buildSite() {
  rmSync('_site', { recursive: true, force: true });
  mkdirSync('_site');

  const manifest = JSON.parse(read('custom-elements.json'));
  const fills = readFills(manifest);
  const builtPages = {};
  for (const entry of PAGES) {
    const outputPath = `_site/${entry.output}`;
    mkdirSync(dirname(outputPath), { recursive: true });
    builtPages[entry.source] = renderPage(forThisBuild(entry), fills);
    writeFileSync(outputPath, builtPages[entry.source]);
    console.log('wrote', outputPath);
  }

  const llms = llmsText({
    manifest,
    version: fills.version,
    cdnVersion: fills['cdn-version'],
    siteUrl: SITE_URL,
    studioUrl: `${SITE_URL}studio/`,
    rules: LLMS_RULES,
    docsLinks: DOCS_LINKS,
  });
  writeFileSync('_site/llms.txt', llms);
  console.log('wrote _site/llms.txt');

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

  const { metafile: waMetafile } = await esbuild.build({
    entryPoints: ['site/js/wa.js'],
    outfile: '_site/js/wa.js',
    bundle: true,
    format: 'esm',
    minify: true,
    metafile: true,
    logLevel: 'warning',
  });

  await esbuild.build({
    entryPoints: ['site/js/studio-wa.js'],
    outfile: '_site/js/studio-wa.js',
    bundle: true,
    format: 'esm',
    minify: true,
    plugins: [skipElements(readElementsInBundle(waMetafile))],
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

  const { 'docs.html': docsHtml, ...otherPages } = builtPages;
  const anchorCount = checkAnchors({
    docsHtml,
    pages: Object.values(otherPages),
    llmsText: llms,
    readmeText: read('README.md'),
    siteUrl: SITE_URL,
  });
  console.log(`checked ${anchorCount} docs anchors`);
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
if (isServing) await serveAndWatch();
