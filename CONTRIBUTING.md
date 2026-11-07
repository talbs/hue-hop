# Contributing

Thanks for helping. Hue Hop is small on purpose, so most changes are small too.

## Build and test

```sh
npm install
npx playwright install chromium
npm test
```

`npm test` builds `dist/` first, checks formatting with Prettier, then runs the tests in Playwright's Chromium. To try another engine, install it with `npx playwright install firefox webkit` and run `BROWSER=firefox npm test` or `BROWSER=webkit npm test`. `npm run format` fixes formatting.

`npm run serve` builds the site into `_site/` and serves it at `http://localhost:4174/` (use `localhost`, not `127.0.0.1`: the Font Awesome kit only allows `localhost`). It rebuilds when anything in `site/` or `src/` changes, so reload to see it. `npm run site` builds without serving. That's what the Pages deploy runs.

`npm run size` checks the gzipped sizes. The core (`dist/hue-hop.js`) has a 2.5 KB budget, and the build fails over it. `drift.css` has its own budget in `scripts/size.js`.

## Browsers

Hue Hop supports Chrome 134, Firefox 140 and Safari 18, or anything newer. Older browsers must stay silent: plain text, no errors, never a wrong color. Keep it that way. CI runs the tests in Chromium, Firefox and WebKit.

## `dist/`

Never commit `dist/`. It's built on `npm pack` and `npm publish` (the `prepack` script), and by `npm test`.

## Changelog

Pull requests don't edit `CHANGELOG.md`. The release pull request writes the new version's section from the package changes merged since the last tag. Site changes stay out, because they deploy on merge and don't ship in the package.

## Releasing

npm trusts `release.yml` to publish, so releases need no token. If that connection ever needs redoing, open `hue-hop` on npmjs.com, then Settings, then Publishing access, and add a trusted publisher: GitHub Actions, `talbs` / `hue-hop`, workflow `release.yml`, environment blank. Allow `npm publish`, and leave `npm dist-tag` off. A new connection expires if no publish goes through it within 48 hours.

Every release goes like this:

1. Open the release pull request from `main`. Bump the version, using `minor` for anything that changes names or defaults while on 0.x, and `patch` for the rest. Then write the `CHANGELOG.md` section for that version, dated today, from the package changes merged since the last tag. The site reads the version from `package.json` at build, so the footer, `llms.txt` and the CDN snippet follow on the next deploy.

   ```sh
   npm version minor --no-git-tag-version
   ```

2. Run the checks. `npm pack --dry-run` should list eight files. Anything else means `files` in `package.json` is leaking.

   ```sh
   npm test
   npm pack --dry-run
   ```

3. Merge the pull request. CI passes, then the Pages workflow deploys the site with the new version in the footer.
4. Publish the GitHub release on `main`. This creates the tag, and the release body is the version's changelog section. Publishing it starts `release.yml`, which runs the tests and publishes to npm with provenance.

   ```sh
   git checkout main && git pull
   VERSION=$(node -p "require('./package.json').version")
   awk -v heading="## $VERSION" 'index($0, heading) == 1 { isInSection = 1; next } /^## / { isInSection = 0 } isInSection' CHANGELOG.md | gh release create "v$VERSION" --title "Hue Hop $VERSION" --notes-file -
   ```

5. Watch the workflow, then confirm npm has it. npm can take a few minutes to show a new version, so seeing the old one right after a passing run isn't a failure.

   ```sh
   gh run watch
   npm view hue-hop version
   ```

6. Check the CDNs once npm shows the new version. jsDelivr can hold the `@0.1` link for up to 12 hours and still return `200`, so purge it, then check which version each link serves. Each line should name the new version. An old version or a missing line means that CDN hasn't caught up, so wait a few minutes and run them again. These URLs use the minor version, so change `@0.1` when that moves.

   ```sh
   curl -s -o /dev/null https://purge.jsdelivr.net/npm/hue-hop@0.1/dist/hue-hop.js
   curl -s -o /dev/null https://purge.jsdelivr.net/npm/hue-hop@0.1/dist/drift.css
   curl -sI https://cdn.jsdelivr.net/npm/hue-hop@0.1/dist/hue-hop.js | grep -i 'x-jsd-version:'
   curl -sI https://cdn.jsdelivr.net/npm/hue-hop@0.1/dist/drift.css | grep -i 'x-jsd-version:'
   curl -sI https://unpkg.com/hue-hop@0.1/dist/hue-hop.js | grep -i location
   ```

7. Paste the CDN tab from the docs into a blank HTML file, add `<hue-hop hue="dusk">Test</hue-hop>` below it, and open it. If you see color, it worked.

## Design changes

Open an issue before changing the API, the formula or the seven hues. A pull request that changes how Hue Hop looks or behaves without one will probably wait.
