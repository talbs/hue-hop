# Contributing

Thanks for helping. Hue Hop is small on purpose, so most changes are small too.

## Build and test

```sh
npm install
npx playwright install chromium
npm test
```

`npm test` builds `dist/` first, checks formatting with Prettier, then runs the tests in Playwright's Chromium. That's the only browser it needs. `npm run format` fixes formatting.

`npm run serve` builds the site into `_site/` and serves it at `http://localhost:4174/` (use `localhost`, not `127.0.0.1`: the Font Awesome kit only allows `localhost`). It rebuilds when anything in `site/` or `src/` changes, so reload to see it. `npm run site` builds without serving. That's what the Pages deploy runs.

`npm run size` checks the gzipped sizes. The core (`dist/hue-hop.js`) has a 2 KB budget, and the build fails over it. Each CSS add-on has its own budget in `scripts/size.js`.

## Browsers

Hue Hop supports Chrome 134, Firefox 140 and Safari 18, or anything newer. Older browsers must stay silent: plain text, no errors, never a wrong color. Keep it that way.

## `dist/`

Never commit `dist/`. It's built on `npm pack` and `npm publish` (the `prepack` script), and by `npm test`.

## Design changes

Open an issue before changing the API, the formula or the seven hues. A pull request that changes how Hue Hop looks or behaves without one will probably wait.
