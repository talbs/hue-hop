import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeFromPreview } from '../site/js/example-code.js';

const rows = [
  [
    'drops id and data attributes',
    '<hue-hop id="x" data-follow hue="dusk">Nas</hue-hop>',
    '<hue-hop hue="dusk">Nas</hue-hop>',
  ],
  [
    'keeps style',
    '<hue-hop hue="dusk" style="--hop-curve: 1.6;">Nas</hue-hop>',
    '<hue-hop hue="dusk" style="--hop-curve: 1.6;">Nas</hue-hop>',
  ],
  [
    'boolean attribute',
    '<hue-hop hue="dusk" drift="">Nas</hue-hop>',
    '<hue-hop hue="dusk" drift>Nas</hue-hop>',
  ],
  [
    'collapses multi-line tag',
    '<hue-hop\n  hue="dusk"\n  display\n>\n  Nas\n</hue-hop>',
    '<hue-hop hue="dusk" display>\n  Nas\n</hue-hop>',
  ],
  [
    'dedents',
    '\n      <h1>\n        <hue-hop hue="dusk">Nas</hue-hop>\n      </h1>\n    ',
    '<h1>\n  <hue-hop hue="dusk">Nas</hue-hop>\n</h1>',
  ],
  [
    'nested divs',
    '<div class="a">\n  <div class="b"><hue-hop hue="reef">Nas</hue-hop></div>\n</div>',
    '<div class="a">\n  <div class="b"><hue-hop hue="reef">Nas</hue-hop></div>\n</div>',
  ],
  [
    'ampersand in text',
    '<hue-hop hue="reef">Nas &amp; Lauryn</hue-hop>',
    '<hue-hop hue="reef">Nas &amp; Lauryn</hue-hop>',
  ],
];

test('codeFromPreview gives back the markup a reader can paste', () => {
  for (const [name, input, expected] of rows) {
    assert.equal(codeFromPreview(input), expected, name);
  }
});
