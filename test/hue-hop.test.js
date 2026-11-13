import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, afterEach, before, test } from 'node:test';
import { chromium, firefox, webkit } from 'playwright';
import {
  clipToScreen,
  contrastRatio,
  luminance,
  parseComputedColor,
} from '../site/js/color.js';

const engine = { chromium, firefox, webkit }[process.env.BROWSER ?? 'chromium'];

let browser;

before(async () => {
  browser = await engine.launch();
});

afterEach(async () => {
  for (const context of browser.contexts()) await context.close();
});

after(async () => {
  await browser.close();
});

async function openPage(html) {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.addScriptTag({ path: 'dist/hue-hop.js', type: 'module' });
  return page;
}

test('every attribute has a property that reflects it, even set before define', async () => {
  const rows = [
    ['start', 'start', 'red', 'red', 'red'],
    ['hue', 'hue', 'reef', 'reef', 'reef'],
    ['hue', 'hue', null, null, null],
    ['display', 'display', true, '', true],
    ['drift', 'drift', false, null, false],
    ['driftCycle', 'drift-cycle', '4s', '4s', '4s'],
  ];
  for (const [
    name,
    attributeName,
    value,
    expectedAttribute,
    readBack,
  ] of rows) {
    const page = await browser.newPage();
    await page.setContent('<hue-hop id="t" hue="dusk" drift>Nas</hue-hop>');
    await page.evaluate(
      ([name, value]) => {
        document.getElementById('t')[name] = value;
      },
      [name, value]
    );
    await page.addScriptTag({ path: 'dist/hue-hop.js', type: 'module' });
    const [attribute, property] = await page.evaluate(
      ([name, attributeName]) => {
        const element = document.getElementById('t');
        return [element.getAttribute(attributeName), element[name]];
      },
      [name, attributeName]
    );
    assert.equal(attribute, expectedAttribute, `${name} = ${value}`);
    assert.equal(property, readBack, `${name} = ${value}`);
  }
});

test('the element entry exports the class without defining the tag', async () => {
  const page = await browser.newPage();
  await page.setContent('<my-hop id="t" hue="dusk">Nas</my-hop>');
  const code = await readFile('dist/element.js', 'utf8');
  const [isBaseTagDefined, hops] = await page.evaluate(async (code) => {
    const blob = new Blob([code], { type: 'text/javascript' });
    const { HueHop } = await import(URL.createObjectURL(blob));
    customElements.define('my-hop', class extends HueHop {});
    return [
      Boolean(customElements.get('hue-hop')),
      document.getElementById('t').hops,
    ];
  }, code);
  assert.equal(isBaseTagDefined, false);
  assert.equal(hops, 3);
});

test('importing without a dom does not throw', async () => {
  const { HueHop } = await import('../dist/hue-hop.js');
  assert.equal(typeof HueHop, 'function');
});

test('the base tag and its subclasses take a hue and color their letters', async () => {
  const rows = [
    ['base', '<hue-hop hue="dusk">Nas</hue-hop>'],
    ['subclass', '<my-hop hue="dusk">Nas</my-hop>'],
    ['subclass with its own root', '<own-root hue="dusk">Nas</own-root>'],
    ['no text, only an svg', '<hue-hop hue="dusk"><svg></svg></hue-hop>'],
    [
      'base before subclass',
      '<hue-hop hue="dusk">Short</hue-hop><my-hop hue="dusk">Much longer text</my-hop>',
    ],
    [
      'subclass before base',
      '<my-hop hue="dusk">Much longer text</my-hop><hue-hop hue="dusk">Short</hue-hop>',
    ],
  ];
  for (const [name, html] of rows) {
    const page = await openPage(html);
    const hopsOnPage = await page.evaluate(async () => {
      const HueHop = customElements.get('hue-hop');
      customElements.define('my-hop', class extends HueHop {});
      customElements.define(
        'own-root',
        class extends HueHop {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' }).innerHTML = '<slot></slot>';
          }
        }
      );
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return [...document.body.children].map((element) => {
        const style = getComputedStyle(element);
        return {
          tag: element.localName,
          start: style.getPropertyValue('--hop-start'),
          end: style.getPropertyValue('--hop-end'),
          letterCount: element.hops,
          firstLetter: getComputedStyle(element, '::highlight(hue-hop-0)')
            .color,
        };
      });
    });
    for (const hop of hopsOnPage) {
      const label = `${name} ${hop.tag}`;
      assert.ok(hop.start.includes('oklch'), `${label} start: ${hop.start}`);
      assert.ok(hop.end.includes('oklch'), `${label} end: ${hop.end}`);
      if (hop.letterCount === 0) continue;
      assert.ok(
        hop.firstLetter.includes('oklch'),
        `${label} first letter: ${hop.firstLetter}`
      );
    }
  }
});

test('page css beats a hue, and a hue beats inherited values', async () => {
  const colorsOf = async (css, attributes = '') => {
    const page = await openPage(
      `<style>${css}</style><hue-hop id="t" class="x" hue="dusk" ${attributes}>Nas</hue-hop>`
    );
    return page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const element = document.getElementById('t');
      return {
        start: getComputedStyle(element).getPropertyValue('--hop-start'),
        middle: getComputedStyle(element, '::highlight(hue-hop-1)').color,
      };
    });
  };
  const plain = await colorsOf('');
  const blue = 'start="blue"';
  const rows = [
    [
      'layered rule',
      '@layer theme { hue-hop { --hop-start: red } }',
      '',
      'red',
    ],
    [
      'layered utility',
      '@layer utilities { .x { --hop-start: red } }',
      '',
      'red',
    ],
    ['unlayered rule', 'hue-hop { --hop-start: red }', '', 'red'],
    ['unlayered :root', ':root { --hop-start: red }', '', 'oklch'],
    [
      'layered :root',
      '@layer theme { :root { --hop-start: red } }',
      '',
      'oklch',
    ],
    ['inherited boost', ':root { --hop-boost: 0.2 }', '', 'oklch', true],
    ['boost attribute beats the hue', '', 'boost="0.2"', 'oklch', true],
    ['attribute beats :root', ':root { --hop-start: red }', blue, 'blue'],
    ['attribute beats a class', '.x { --hop-start: red }', blue, 'blue'],
    [
      'specific rule beats attribute',
      'body hue-hop.x { --hop-start: red }',
      blue,
      'red',
    ],
    ['style beats attribute', '', `${blue} style="--hop-start: red"`, 'red'],
  ];
  for (const [name, css, attributes, expected, isMiddleBoosted] of rows) {
    const { start, middle } = await colorsOf(css, attributes);
    assert.ok(start.includes(expected), `${name}: ${start}`);
    if (isMiddleBoosted) {
      assert.notEqual(middle, plain.middle, `${name}: ${middle}`);
    }
  }
});

async function rangesOf(page, selector) {
  return page.evaluate(async (selector) => {
    const nextFrame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    await nextFrame();
    await nextFrame();

    const element = document.querySelector(selector);
    const found = [];
    for (const [name, highlight] of CSS.highlights) {
      const match = /^hue-hop-(\d+)$/.exec(name);
      if (!match) continue;
      for (const range of highlight) {
        const container = range.startContainer;
        if (container.parentElement?.closest('hue-hop') !== element) continue;
        found.push({
          index: Number(match[1]),
          text: container.data.slice(range.startOffset, range.endOffset),
        });
      }
    }
    found.sort((a, b) => a.index - b.index);

    return {
      hasHopsAttribute: element.hasAttribute('hops'),
      hops: element.hops,
      indexes: found.map((entry) => entry.index),
      texts: found.map((entry) => entry.text),
    };
  }, selector);
}

test('accessible name is the text, read once', async () => {
  const page = await openPage('<h1><hue-hop>Brian Talbot</hue-hop></h1>');
  assert.equal(
    await page.locator('h1').ariaSnapshot(),
    '- heading "Brian Talbot" [level=1]'
  );
});

test('steps graphemes into shared highlights', async () => {
  const rows = [
    ['ascii', 'Brian', ['B', 'r', 'i', 'a', 'n']],
    ['combining mark', 'Cafe\u0301', ['C', 'a', 'f', 'e\u0301']],
    ['flag', 'Hi 🇯🇵', ['H', 'i', '🇯🇵']],
    [
      'zwj emoji',
      '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}!',
      ['\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', '!'],
    ],
    ['inner whitespace', 'A  B\tC', ['A', 'B', 'C']],
    ['inline element', 'Br<b>ia</b>n', ['B', 'r', 'i', 'a', 'n']],
    [
      'invisible characters',
      'Ex\u200Btra\u00ADlong',
      ['E', 'x', 't', 'r', 'a', 'l', 'o', 'n', 'g'],
    ],
    ['nested hue-hop', 'ab<hue-hop>cd</hue-hop>e', ['a', 'b', 'e']],
    [
      'past 64 letters, two per step',
      'ab'.repeat(64),
      [...'ab'.repeat(64)],
      Array.from({ length: 128 }, (_, index) => Math.floor(index / 2)),
    ],
  ];
  for (const [name, html, expected, expectedIndexes] of rows) {
    const steps = expectedIndexes ?? expected.map((_, index) => index);
    const stepCount = steps.at(-1) + 1;
    const page = await openPage(`<hue-hop id="t">${html}</hue-hop>`);
    const { hasHopsAttribute, hops, indexes, texts } = await rangesOf(
      page,
      '#t'
    );
    assert.deepEqual(texts, expected, name);
    assert.equal(hops, stepCount, name);
    assert.equal(hasHopsAttribute, false, name);
    assert.deepEqual(indexes, steps, name);
  }
});

test('content changes re-step and leave no old ranges', async () => {
  const rows = [
    [
      'edit in place',
      (el) => {
        el.firstChild.data = 'Echo';
      },
      ['E', 'c', 'h', 'o'],
    ],
    [
      'replace the node',
      (el) => {
        el.replaceChildren('Bravo Charlie');
      },
      ['B', 'r', 'a', 'v', 'o', 'C', 'h', 'a', 'r', 'l', 'i', 'e'],
    ],
    [
      'remove, re-append, then edit',
      async (el) => {
        const parent = el.parentNode;
        el.remove();
        parent.append(el);
        await new Promise((resolve) => setTimeout(resolve));
        el.firstChild.data = 'Golf';
      },
      ['G', 'o', 'l', 'f'],
    ],
    [
      'hostile start, then edit',
      (el) => {
        el.setAttribute('start', 'red} x{color:red"');
        el.firstChild.data = 'Echo';
      },
      ['E', 'c', 'h', 'o'],
    ],
  ];
  for (const [name, change, expected] of rows) {
    const page = await openPage('<h2><hue-hop id="t">Alpha</hue-hop></h2>');
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.evaluate(`(${change})(document.getElementById('t'))`);
    const { hops, texts } = await rangesOf(page, '#t');
    assert.deepEqual(texts, expected, name);
    assert.equal(hops, expected.length, name);
    const stale = await page.evaluate(
      () =>
        [...CSS.highlights]
          .flatMap(([, h]) => [...h])
          .filter((r) => !r.startContainer.isConnected).length
    );
    assert.equal(stale, 0, name);
    assert.deepEqual(pageErrors, [], name);
  }
});

test('a hop recounts after a detached edit', async () => {
  const page = await openPage(
    '<hue-hop id="t" start="red" end="blue">Illmatic</hue-hop>'
  );
  const { hops, lastLetter, blue } = await page.evaluate(async () => {
    const element = document.getElementById('t');
    const parent = element.parentNode;
    element.remove();
    element.textContent = 'Nas';
    parent.append(element);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const probe = document.createElement('i');
    probe.style.color = 'oklch(from blue l c h)';
    document.body.append(probe);
    return {
      hops: element.hops,
      lastLetter: getComputedStyle(element, '::highlight(hue-hop-2)').color,
      blue: getComputedStyle(probe).color,
    };
  });
  assert.equal(hops, 3);
  const channels = (color) => color.match(/[\d.]+/g).map(Number);
  const [actual, expected] = [channels(lastLetter), channels(blue)];
  for (const [index, value] of expected.entries()) {
    assert.ok(
      Math.abs(actual[index] - value) < 0.01 * Math.max(1, value),
      `${lastLetter} vs ${blue}`
    );
  }
});

test('only a hop that had no box when it registered registers again', async () => {
  const hop = '<hue-hop>Alpha</hue-hop>';
  const below = '<div style="height: 3000px"></div>';
  const rows = [
    [
      'content-visibility: auto, offscreen',
      `${below}<div id="w" style="content-visibility: auto">${hop}</div>`,
      (w) => w.scrollIntoView(),
      true,
    ],
    [
      'content-visibility: hidden',
      `<div id="w" style="content-visibility: hidden">${hop}</div>`,
      (w) => {
        w.style.contentVisibility = 'visible';
      },
      true,
    ],
    [
      'display: none',
      `<div id="w" style="display: none">${hop}</div>`,
      (w) => {
        w.style.display = 'block';
      },
      true,
    ],
    [
      'closed details',
      `<details id="w">${hop}</details>`,
      (w) => {
        w.open = true;
      },
      true,
    ],
    [
      'below the fold, with a box',
      `${below}<div id="w">${hop}</div>`,
      (w) => w.scrollIntoView(),
      false,
    ],
    ['in view', `<div id="w">${hop}</div>`, () => {}, false],
  ];
  for (const [name, html, reveal, isRegisteredAgain] of rows) {
    const page = await openPage(html);
    const { kept, total } = await page.evaluate(`(async () => {
      const settle = async () => {
        for (let frame = 0; frame < 10; frame++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      };
      const liveRanges = () =>
        [...CSS.highlights.values()].flatMap((highlight) => [...highlight]);
      await settle();
      const before = liveRanges();
      (${reveal})(document.getElementById('w'));
      await settle();
      const after = liveRanges();
      return {
        kept: before.filter((range) => after.includes(range)).length,
        total: after.length,
      };
    })()`);
    assert.equal(total, 5, name);
    assert.equal(kept, isRegisteredAgain ? 0 : 5, name);
  }
});

test('forced colors holds back every range until it turns off', async () => {
  const page = await openPage('<hue-hop id="t">Alpha</hue-hop>');

  await page.emulateMedia({ forcedColors: 'active' });
  const whenTurnedOn = await rangesOf(page, '#t');
  assert.deepEqual(whenTurnedOn.texts, []);
  assert.equal(whenTurnedOn.hops, 5);

  await page.evaluate(() => {
    document.getElementById('t').firstChild.data = 'Echo';
  });
  const afterEdit = await rangesOf(page, '#t');
  assert.deepEqual(afterEdit.texts, []);
  assert.equal(afterEdit.hops, 4);

  await page.emulateMedia({ forcedColors: 'none' });
  const whenTurnedOff = await rangesOf(page, '#t');
  assert.deepEqual(whenTurnedOff.texts, ['E', 'c', 'h', 'o']);
});

test('every letter of every hue passes its contrast bar on the documented pages', async () => {
  const hueCss = await readFile('src/hues.css', 'utf8');
  const hueNames = new Set(
    Array.from(hueCss.matchAll(/hue='([a-z]+)'/g), (match) => match[1])
  );
  assert.ok(hueNames.size > 0, 'no hues found in src/hues.css');
  const pageColorsBySide = {
    light: ['rgb(245 245 245)', 'rgb(255 255 255)'],
    dark: ['rgb(0 0 0)', 'rgb(26 26 26)'],
  };
  const driftSamples = [-24, -16, -8, 0, 8, 16, 24];
  const sampleText = 'ab'.repeat(32);
  const luminanceOf = (colorText) =>
    luminance(clipToScreen(parseComputedColor(colorText)));

  for (const [side, pageColors] of Object.entries(pageColorsBySide)) {
    const hops = [];
    for (const hue of hueNames) {
      for (const display of ['', 'display']) {
        for (const drift of driftSamples) {
          hops.push(
            `<hue-hop hue="${hue}" ${display} style="--_hop-drift: ${drift}">${sampleText}</hue-hop>`
          );
        }
      }
    }
    const page = await openPage(
      `<style>:root { color-scheme: ${side} }</style>${hops.join('')}`
    );
    const hopsOnPage = await page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return [...document.querySelectorAll('hue-hop')].map((element) => ({
        hue: element.getAttribute('hue'),
        isDisplay: element.hasAttribute('display'),
        drift: element.style.getPropertyValue('--_hop-drift').trim(),
        letters: Array.from(
          { length: element.hops },
          (_, index) =>
            getComputedStyle(element, `::highlight(hue-hop-${index})`).color
        ),
      }));
    });

    const pageShades = pageColors.map((color) => ({
      color,
      luminance: luminanceOf(color),
    }));
    const firstLetterColors = new Map();
    for (const hop of hopsOnPage) {
      const name = `${hop.hue} ${side}${hop.isDisplay ? ' display' : ''}`;
      const bar = hop.isDisplay ? 3 : 4.5;
      assert.equal(hop.letters.length, sampleText.length, name);
      if (!firstLetterColors.has(name)) firstLetterColors.set(name, new Set());
      firstLetterColors.get(name).add(hop.letters[0]);

      for (const [step, letter] of hop.letters.entries()) {
        const letterLuminance = luminanceOf(letter);
        for (const pageShade of pageShades) {
          const ratio = contrastRatio(letterLuminance, pageShade.luminance);
          assert.ok(
            ratio >= bar,
            `${name} drift ${hop.drift} step ${step} on ${pageShade.color}: ${ratio.toFixed(2)} under ${bar}`
          );
        }
      }
    }
    for (const [name, colors] of firstLetterColors) {
      assert.equal(colors.size, driftSamples.length, `${name}: drift moved`);
    }
  }
});
