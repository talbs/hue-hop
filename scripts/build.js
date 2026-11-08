import { readFile, rm } from 'node:fs/promises';
import { basename } from 'node:path';
import * as esbuild from 'esbuild';

await rm('dist', { recursive: true, force: true });

function hostRulesFrom(css) {
  const hostRules = css.replaceAll(':where(hue-hop[', ':host([');
  if (hostRules === css) {
    throw new Error('src/hues.css no longer has :where(hue-hop[ selectors');
  }
  return hostRules;
}

function formulaAroundPlaceholder(css) {
  const parts = css.split('::highlight(hue-hop-K)');
  if (parts.length !== 2) {
    throw new Error(
      'src/formula.css no longer has exactly one ::highlight(hue-hop-K) placeholder'
    );
  }
  return parts;
}

const cssAsMinifiedString = {
  name: 'css-as-minified-string',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
      const css = await readFile(path, 'utf8');
      const { code } = await esbuild.transform(css, {
        loader: 'css',
        minify: true,
      });
      const collapsedCode = code.replace(/\s+/g, ' ');
      const name = basename(path);
      if (name === 'formula.css') {
        const [before, after] = formulaAroundPlaceholder(collapsedCode);
        return {
          contents: `export const formulaBefore = ${JSON.stringify(before)}, formulaAfter = ${JSON.stringify(after)};`,
          loader: 'js',
        };
      }
      const contents =
        name === 'hues.css' ? hostRulesFrom(collapsedCode) : collapsedCode;
      return { contents, loader: 'text' };
    });
  },
};

await esbuild.build({
  entryPoints: ['src/hue-hop.js', 'src/element.js'],
  outdir: 'dist',
  bundle: true,
  sourcemap: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  plugins: [cssAsMinifiedString],
});

await esbuild.build({
  entryPoints: ['src/drift.css'],
  outdir: 'dist',
  minify: true,
});
