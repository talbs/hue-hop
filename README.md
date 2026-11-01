# hue-hop

Give each letter of a heading or name its own color, stepped from one color to another. The text stays one piece of real text, so kerning, links, copy and paste, and screen readers all work as normal.

```html
<h1>
  <hue-hop
    start="darkorange"
    end="crimson"
  >
    Ada Lovelace
  </hue-hop>
</h1>
```

The first letter is `darkorange` and the last is `crimson`. Every letter in between gets one flat color on the way. Change the text and the colors re-step. Links and other inline markup can sit inside: the colors run straight across them.

## Start and end

| Attribute | What it does                                                         |
| --------- | -------------------------------------------------------------------- |
| `start`   | The color of the first letter. It sets `--hop-start` on the element. |
| `end`     | The color of the last letter. It sets `--hop-end` on the element.    |

Set the ends with these attributes or with the custom properties below. Set only one and Hue Hop picks the other. It keeps your lightness and intensity and turns the hue 50 degrees around the color wheel, away from yellow. Yellow can't stay bright at a readable lightness.

```html
<hue-hop start="teal">Ada Lovelace</hue-hop>
```

You pick the lightness, so check contrast with the rules in [Picking your own colors](#picking-your-own-colors). Set neither and the text keeps its normal color.

Any CSS color works, including `var(--brand)` and `light-dark()`.

Which value wins:

- The attribute beats an inherited value, a `hue` preset and a plain class rule.
- Anything more specific than `hue-hop[start]` beats the attribute (like `.card h2 hue-hop`).
- The `style` attribute always wins.

In JavaScript, `el.start` and `el.end` read and set the attributes. Setting one to `null` removes it. So frameworks that set properties instead of attributes (Angular, Solid, Lit's `.start=`) should work too.

Each new value adds a small style rule to the page. For a color that changes every frame, set `--hop-start` in `style` instead.

## Custom properties

Set these anywhere they'll inherit: `:root`, a class, your design tokens, or one element's `style` attribute (`style="--hop-end: gold"`). They suit colors shared across a site and colors that follow a theme (see [Light and dark](#light-and-dark)).

```css
:root {
  --hop-start: teal;
  --hop-end: royalblue;
}
```

| Property      | Default | What it does                                                                                                             |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `--hop-start` | none    | The color of the first letter. Left out, it's picked from `--hop-end`.                                                   |
| `--hop-end`   | none    | The color of the last letter. Left out, it's picked from `--hop-start`.                                                  |
| `--hop-curve` | `1`     | How the steps are spaced: `1` is even, higher stays near the start color longer, and lower reaches the end color sooner. |
| `--hop-lift`  | `0`     | How much extra color intensity (OKLCH chroma) the middle letters get, so the blend doesn't go dull halfway.              |
| `--hop-shift` | `0`     | Turns every hue by this many degrees, written as a plain number (`30`, not `30deg`).                                     |

Curve, lift and shift have no attributes. They're usually set once for a whole design, on `:root` or a class.

Without JavaScript, or before the element loads, the heading is plain text in its normal color. When the colors arrive, nothing moves (no layout shift).

## Drift

`drift.css` is an add-on that slowly sways the hues back and forth. Import it once, then add `drift` to any element.

```js
import 'hue-hop/drift.css';
```

```html
<hue-hop drift>Ada Lovelace</hue-hop>
```

No bundler? Load `dist/drift.css` from the package with a `<link>`.

| Property            | Default | What it does                                                                                       |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `--hop-drift-range` | `24`    | How many degrees the hues sway each way when `drift` is on, written as a plain number.             |
| `--hop-drift-cycle` | `10`    | How many seconds one full sway there and back takes when `drift` is on, written as a plain number. |

Drift only turns hues, and lightness holds. Contrast can still shift a little as the hues turn, so leave some margin at the start and end colors. Drift stops when the visitor prefers reduced motion.

## Glide

`glide.css` is a second motion add-on. Drift is the main one. Glide moves the colors along the letters instead of turning them. Import it once, then add `glide` to any element.

```js
import 'hue-hop/glide.css';
```

```html
<hue-hop glide>Ada Lovelace</hue-hop>
```

No bundler? Load `dist/glide.css` from the package with a `<link>`.

| Property             | Default | What it does                                                                                                                  |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `--hop-glide-spread` | `1`     | How many waves of color fit in the text when `glide` is on: `1` shows one at a time, and `2` or more reads as chasing lights. |
| `--hop-glide-cycle`  | `10`    | How many seconds one full pass of the colors takes when `glide` is on, written as a plain number.                             |

The end color moves through the text from the first letter to the last, and then the start color does the same. In between, every step from start to end shows. Every letter stays on the steps between your two colors. To run it the other way, set `animation-direction: reverse` on the element.

Glide looks best at spread `1`. Use one motion per heading. If an element has both `drift` and `glide`, only one of them runs. Glide stops when the visitor prefers reduced motion.

## Ready-made hues

`hues.css` is an add-on with seven ready-made looks. Import it once, then pick one with the `hue` attribute.

```js
import 'hue-hop/hues.css';
```

```html
<hue-hop hue="dusk">Ada Lovelace</hue-hop>
```

| Hue      | Goes from (dark mode)   |
| -------- | ----------------------- |
| `dusk`   | pale sky to blue-violet |
| `reef`   | pale aqua to blue       |
| `fern`   | lime to pine            |
| `ember`  | pale amber to red       |
| `guava`  | peach to magenta        |
| `orchid` | blush pink to aubergine |
| `honey`  | butter yellow to rust   |

In light mode the starts are deeper versions of these colors, so they stay readable on light pages. Every letter of the seven hues above passes 4.5:1 contrast, with drift off or on at its default range. That's checked on any light page from `#f5f5f5` to `#fff`, and any dark page from `#000` to `#1a1a1a`. On other backgrounds, check your own.

Add `display` to switch to the display version (for large headings). Its colors sit closer to the page color and pass 3:1, the bar for large text. Don't use it for body-size text.

```html
<hue-hop
  hue="dusk"
  display
>
  Ada Lovelace
</hue-hop>
```

`display` only works with `hue`. On its own it does nothing.

The hues use `light-dark()`, so the page needs `color-scheme` to get the dark versions (see below). A `start` or `end` attribute, or a `--hop-*` value you set on the element, wins over the hue's. So you can pick a hue and change one end (`<hue-hop hue="dusk" end="gold">`). Every hue also sets `--hop-lift` to `0.021`.

`hues.css`, `drift.css` and `glide.css` live in a cascade layer named `hue-hop`, so your unlayered CSS always wins over them. If your site uses layers too (Tailwind v4 does), list `hue-hop` first in your layer order. Then your own layers win:

```css
@layer hue-hop, theme, base, components, utilities;
```

`hues.css` targets the `hue-hop` tag. A subclass registered under another tag needs its own copy of the rules.

## In the wild

Hue Hop is for short text that names something.

A site logo in a nav bar:

```html
<a
  href="/"
  class="logo"
>
  <hue-hop hue="reef">Aquemini</hue-hop>
</a>
```

A byline, with only the name colored:

```html
<p>
  Words by
  <hue-hop hue="honey">Ada Lovelace</hue-hop>
</p>
```

A playlist heading:

```html
<h2><hue-hop hue="fern">Crate Digging</hue-hop></h2>
```

An article title, in the display version for large type:

```html
<h1>
  <hue-hop
    hue="guava"
    display
  >
    Ether
  </hue-hop>
</h1>
```

Don't use it on body copy. It gets hard to read when every letter changes color.

## Picking your own colors

The element can't see the background, so it can't check your colors for you. These rules keep the ends readable. Write your ends in `oklch()` so you can see the lightness (the first number).

| Page                       | Body text (4.5:1)             | Display (3:1)                 |
| -------------------------- | ----------------------------- | ----------------------------- |
| Light, `#f5f5f5` to `#fff` | both ends at `52%` or darker  | both ends at `62%` or darker  |
| Dark, `#000` to `#1a1a1a`  | both ends at `65%` or lighter | both ends at `55%` or lighter |

These hold for any hue and any chroma a screen can show. Lightness steps evenly from one end to the other, so if both ends pass, most letters between them do too. Ends far apart on the color wheel (green to violet, say) can still dip in the middle. The blend can leave what a screen can show. `--hop-lift` makes that more likely, so check the middle letters.

On any other background, check the contrast yourself.

Yellows can't stay bright that dark. At `52%`, a yellow can hold about half the color (OKLCH chroma) a blue or pink can, so it goes dull. For a yellow start, use the display bar or a dark page.

The ready-made hues go a little past these numbers, because each one was measured for its own colors.

## Light and dark

The element has no theme logic. It reads `--hop-*` live, so when they change, the letters follow with no re-render. Pick colors per scheme in one of three ways.

Tokens that already flip with your theme:

```css
:root {
  --hop-start: var(--brand-500);
  --hop-end: var(--accent-500);
}
```

A scheme rule (or a class your theme switch sets, like `.dark`):

```css
:root {
  --hop-start: teal;
  --hop-end: royalblue;
}

@media (prefers-color-scheme: dark) {
  :root {
    --hop-start: aquamarine;
    --hop-end: lightskyblue;
  }
}
```

`light-dark()`:

```css
:root {
  color-scheme: light dark;
  --hop-start: light-dark(teal, aquamarine);
  --hop-end: light-dark(royalblue, lightskyblue);
}
```

`light-dark()` needs `color-scheme` on the page. Without it, you always get the light value.

## Install

```sh
npm install hue-hop
```

```js
import 'hue-hop';
```

The import defines `<hue-hop>`, unless something on the page already did. Types ship in the package, React JSX included.

No bundler? Load it from a CDN:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/hue-hop"
></script>
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/hue-hop/dist/hues.css"
/>
```

The `HueHop` class is exported too. To use another tag, register a subclass:

```js
import { HueHop } from 'hue-hop';

customElements.define('my-hop', class extends HueHop {});
```

`HueHop` itself won't work here. The import already registered it, and a class can only be registered once. Use one tag per page or shadow root. Two tags in one root make one of them fall back to plain text.

A subclass that defines its own `observedAttributes` must include `...super.observedAttributes` and call `super.attributeChangedCallback()`, or `start` and `end` stop updating.

## Browser support

Needs Chrome 134, Firefox 140 or Safari 18, or anything newer. Safari 17 is unmeasured. Older browsers show the heading in its normal color.

The element checks for `CSS.highlights` (the CSS Custom Highlight API) when it connects. Without it, the element does nothing. There's no polyfill. Chrome 105 to 133 have the API but can't read custom properties inside a highlight, which the colors need. They show plain text too, never a wrong color.

## Highlight names

The colors are painted by highlights in `CSS.highlights`, one per letter position: `hue-hop-0`, `hue-hop-1` and on up. Every one has priority −1, so your own highlights (search-term markers, say) paint above them. These names are public and won't change.

`CSS.highlights.clear()` removes the colors until the text changes or the element reconnects.

To read a letter's color, use `getComputedStyle(el, '::highlight(hue-hop-0)').color`. A color copied out this way is a fixed value for the current scheme. Static copies don't follow a theme switch.

## The `hops` attribute

After each render the element writes its step count on itself (`hops="12"`), and its stylesheet reads it. Don't set it. The element overwrites it.

Each letter gets its own step, up to 64. Longer text shares steps, so a 200-letter heading still runs the whole ramp with about three letters per color. Past 64, every extra step would slow down each restyle on the page, theme switches and drift included.

`el.hops` returns the same count as a read-only number. It's `0` when the element is off the page (the attribute keeps its last value) or the browser lacks support.

With server rendering, the server's HTML has no `hops`. If the element is defined before React 18 hydrates, React's development build prints `Warning: Extra attributes from the server: hops`. It comes through `console.error`, so a test runner that fails on console errors will fail on it. Colors stay correct either way.

## Accessibility

Screen readers hear the text once, as words, because the text is never split. Forced colors mode turns the effect off, and so does an OS "increase contrast" setting (`prefers-contrast: more`). The heading falls back to its normal color, and a site can't opt back in. Drift and glide stop when the visitor prefers reduced motion.

## Known limits

- Check contrast at the start and end colors. The element doesn't.
- A typo in a color (`start="tael"`) shows plain text. A `var()` that points nowhere counts as left out, so Hue Hop picks its partner instead.
- It's made for headings and names, not body copy.
- Ends far apart on the color wheel, and lift, can push the middle letters past what an sRGB screen can show. They get clipped, by an amount that depends on the colors, and on a white page that can lower their contrast. Check the middle letters.
- User stylesheets and extensions that force a text color still show the colors. A highlight's `color` paints above the element's color, `!important` included.
- Links inside keep their focus ring and underline. They lose their own color in every state (hover and visited included).
- Firefox and Safari keep a link's underline in the link's color. Chrome paints it in each letter's color, and `text-decoration-color` only shows under the spaces.
- Keep link underlines on. When only part of a heading is a link, the underline is the only thing that says so (WCAG 1.4.1).
- Selected text: a `::selection` rule of yours that sets `color` wins in every browser. The colors come back after.
- Without that rule, Chrome and Safari keep the letter colors on the selection background. Firefox uses its own selection colors.
- Find-in-page still shows its matches. The colors come back after.
- Color emoji keep their own colors and use one hop each.
- Chrome and Firefox split a ligature's colors at the step boundary. Safari paints the whole ligature in its first letter's color.
- A letter split across two elements (a base letter in one, a combining mark in the next) counts as two hops.
- The steps follow reading order, so mixed-direction text jumps around visually.
- Text in a `<slot>` inside the element isn't colored.
- Screen-reader-only text inside the element (a visually hidden span, say) still uses up hops. So the visible letters may not reach `--hop-end`.
- Gradient-text headings (`background-clip: text` with a transparent fill) hide the effect. The transparent fill wins.
- `color` on `<hue-hop>` only shows where the effect is off: an unsupported browser, no start or end color, forced colors or increased contrast.
- `drift.css` and `glide.css` target the `hue-hop` tag. If you register a subclass under another tag, copy the `hue-hop[drift]` or `hue-hop[glide]` rule for it, inside the same media query. Keep `var()` out of any keyframes you write for it, or Firefox animates them in jumps.
- The element adds its styles from JavaScript (constructed stylesheets in the document, or in the shadow root it sits in), not a `<style>` tag. So a content security policy doesn't need `style-src 'unsafe-inline'`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
