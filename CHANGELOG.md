# Changelog

Newest version first. Changes go under Added, Changed, Deprecated, Removed, Fixed, or Security. Anything breaking says **Breaking** and goes at the top.

## 0.3.0 · 2026-11-09

### Changed

- **Breaking:** An inherited `--hop-boost` now beats a hue's built-in boost. Set it on `:root` or a parent and hue headings follow. Before, only a `--hop-boost` on the element itself could change it.

### Added

- `curve`, `boost`, `shift`, `drift-range` and `drift-cycle` attributes, with `el.curve`, `el.boost`, `el.shift`, `el.driftRange` and `el.driftCycle` properties. They set the matching `--hop-*` custom property on that heading, and take the same values (`drift-cycle="4s"`).

## 0.2.0 · 2026-11-08

The API this version ships is the one 1.0 will keep.

### Changed

- **Breaking:** `--hop-lift` is now `--hop-boost`. The old name does nothing.
- **Breaking:** `--hop-drift-cycle` takes a time, like `10s`. A plain number, like `10`, turns drift off.
- **Breaking:** In React 19, `drift=""` and `display=""` now turn those off, because React sets the new properties. Write the bare name (`<hue-hop drift>`) and leave it out to turn it off.

### Removed

- **Breaking:** The element no longer writes a `hops` attribute on itself. Read the step count from `el.hops`.

### Added

- `hue`, `display` and `drift` properties that read and set their attributes, like `start` and `end`. They work even when set before the element loads.
- `hue-hop/element`, which exports `HueHop` without defining `<hue-hop>`. Load it or `hue-hop`, not both.
- Source maps for `hue-hop.js` and `element.js`.
- `hue-hop/custom-elements.json`, so tools can import the manifest.
- A `HueName` type for the seven hue names.

### Fixed

- Importing Hue Hop on a server no longer throws. It does nothing there, and the colors arrive in the browser.
- A subclass under another tag no longer leaves `<hue-hop>` plain on the same page.
- In Safari, a hop inside a `content-visibility: auto` section now colors when it scrolls into view.

## 0.1.1 · 2026-11-06

### Fixed

- In Safari, a hop that starts hidden now gets its colors when it appears. It used to stay plain. This covers `display: none`, a closed `<details>`, `hidden="until-found"`, and `content-visibility` on an ancestor. Letters hidden inside a hop can still stay plain.

## 0.1.0 · 2026-11-06

### Added

- `<hue-hop>`, one custom element that colors each letter of a heading or name, stepping from a start color to an end color. The text stays text. No dependencies, under 2.5 KB gzipped.
- Seven ready-made color pairs, picked with `hue`.
- One optional stylesheet, `drift.css`, that slowly sways the colors on any element with `drift`.
- The site at [huehop.dev](https://huehop.dev/): a landing page, the docs, the Studio for making your own pair, and `llms.txt` for coding assistants.
