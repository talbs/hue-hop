# Hue Hop

**Every letter hops a hue.** Hue Hop colors each letter of a heading or name, one flat color at a time, from a start color to an end color. The text stays text: select it, find it, copy it, read it with a screen reader.

It's one custom element, `<hue-hop>`, with no dependencies and under 2 KB gzipped. It works in Chrome 134+, Firefox 140+, and Safari 18+.

**[See it live, and read the docs →](https://huehop.dev/)**

0.x: pin a version. Names and defaults may change before 1.0.

## Use it

```bash
npm install hue-hop
```

```js
import 'hue-hop';
import 'hue-hop/hues.css';
```

Then wrap a heading and pick one of the seven ready-made hues:

```html
<h1><hue-hop hue="dusk">Electric Relaxation</hue-hop></h1>
```

No build step? The CDN tags are under [Load It](https://huehop.dev/docs/#load-it) in the docs.

For your own colors, set `start` and `end` to any CSS color, or set one and Hue Hop picks the other. You pick the lightness, so check contrast with the rules in [Keep Them Readable](https://huehop.dev/docs/#keep-them-readable).

Building with an AI assistant? Point it at [llms.txt](https://huehop.dev/llms.txt).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
