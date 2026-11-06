# Changelog

Newest version first. Changes go under Added, Changed, Deprecated, Removed, Fixed, or Security. Anything breaking says **Breaking** and goes at the top.

## 0.1.1 · 2026-11-06

### Changed

- Everything on the site that expands, toggles, or updates now moves on a shared 90 BPM beat.
- The homepage quickstart is now two steps. The `import` moved into the npm tab, so CDN users have no step to skip.

### Fixed

- In Safari, a hop that starts hidden now gets its colors when it appears. It used to stay plain. This covers `display: none`, a closed `<details>`, `hidden="until-found"`, and `content-visibility` on an ancestor. Letters hidden inside a hop can still stay plain.
- The docs page no longer scrolls sideways on a phone while it loads.
- The docs header's moves no longer collide on phones.

## 0.1.0 · 2026-11-06

### Added

- `<hue-hop>`, one custom element that colors each letter of a heading or name, stepping from a start color to an end color. The text stays text. No dependencies, under 2.5 KB gzipped.
- Seven ready-made color pairs, picked with `hue`.
- One optional stylesheet, `drift.css`, that slowly sways the colors on any element with `drift`.
- The site at [huehop.dev](https://huehop.dev/): a landing page, the docs, the Studio for making your own pair, and `llms.txt` for coding assistants.
