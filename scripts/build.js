import { readFile, rm } from 'node:fs/promises';
import * as esbuild from 'esbuild';

await rm('dist', { recursive: true, force: true });

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
      return { contents: collapsedCode, loader: 'text' };
    });
  },
};

await esbuild.build({
  entryPoints: ['src/hue-hop.js'],
  outfile: 'dist/hue-hop.js',
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  plugins: [cssAsMinifiedString],
});

await esbuild.build({
  entryPoints: ['src/drift.css', 'src/glide.css', 'src/hues.css'],
  outdir: 'dist',
  minify: true,
});
