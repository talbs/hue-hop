import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import {
  clipToScreen,
  contrastRatio,
  luminance,
  parseComputedColor,
} from '../site/js/color.js';
import { DEFAULT_STATE, describeStudioLink } from '../site/js/state.js';
import {
  autoPartnerOf,
  letterColors,
  planFit,
  stepCount,
} from '../site/js/studio-color.js';
import {
  DEFAULT_STUDIO,
  readStudioParams,
  writeStudioParams,
} from '../site/js/studio-url.js';

let browser;

before(async () => {
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
});

async function openPage(html) {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.addStyleTag({ path: 'dist/hues.css' });
  await page.addScriptTag({ path: 'dist/hue-hop.js', type: 'module' });
  return page;
}

async function readElementColors(page, selector) {
  return page.evaluate(async (selector) => {
    const nextFrame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    await nextFrame();
    await nextFrame();

    const element = document.querySelector(selector);
    const readEnd = (name) => {
      const probe = document.createElement('i');
      probe.style.color = `var(--hop-${name}, transparent)`;
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };

    const letters = [];
    for (let index = 0; index < element.hops; index++) {
      const highlight = `::highlight(hue-hop-${index})`;
      letters.push(getComputedStyle(element, highlight).color);
    }
    return {
      hops: element.hops,
      letters,
      start: readEnd('start'),
      end: readEnd('end'),
    };
  }, selector);
}

function assertSameColor(actual, expected, label) {
  assert.ok(
    Math.abs(actual.lightness - expected.lightness) <= 0.002,
    `${label} lightness: ${actual.lightness} vs ${expected.lightness}`
  );
  assert.ok(
    Math.abs(actual.chroma - expected.chroma) <= 0.002,
    `${label} chroma: ${actual.chroma} vs ${expected.chroma}`
  );
  if (expected.chroma < 0.001) return;
  const hueGap = Math.abs(actual.hue - expected.hue) % 360;
  assert.ok(
    Math.min(hueGap, 360 - hueGap) <= 0.5,
    `${label} hue: ${actual.hue} vs ${expected.hue}`
  );
}

test('checker matches the element', async () => {
  const atRest = { curve: 1, lift: 0, shift: 0 };
  const customEnds = 'start="oklch(60% 0.12 200)" end="oklch(60% 0.12 300)"';
  const rows = [
    [
      'dusk at defaults',
      'hue="dusk"',
      'Respiration',
      11,
      { ...atRest, lift: 0.021 },
    ],
    [
      'reef with curve 2',
      'hue="reef" style="--hop-curve: 2"',
      'Respiration',
      11,
      { curve: 2, lift: 0.021, shift: 0 },
    ],
    [
      'custom with lift',
      `${customEnds} style="--hop-lift: 0.05"`,
      'Respiration',
      11,
      { ...atRest, lift: 0.05 },
    ],
    [
      'custom with shift',
      `${customEnds} style="--hop-shift: 40"`,
      'Respiration',
      11,
      { ...atRest, shift: 40 },
    ],
    ['start only', 'start="oklch(60% 0.12 200)"', 'Respiration', 11, atRest],
    [
      'grey end',
      'start="oklch(60% 0.12 200)" end="#808080"',
      'Respiration',
      11,
      atRest,
    ],
    [
      'graphemes',
      'hue="dusk"',
      'é\u{1F469}\u{1F3FD}‍\u{1F680}a',
      3,
      { ...atRest, lift: 0.021 },
    ],
    [
      'past the step cap',
      'hue="dusk"',
      'ab'.repeat(35),
      70,
      { ...atRest, lift: 0.021 },
    ],
  ];

  for (const [name, attributes, text, letterCount, tuning] of rows) {
    const page = await openPage(`<hue-hop ${attributes}>${text}</hue-hop>`);
    const { hops, letters, start, end } = await readElementColors(
      page,
      'hue-hop'
    );
    assert.equal(stepCount(letterCount), hops, name);

    const startColor = parseComputedColor(start);
    const endColor = parseComputedColor(end);
    const ends = {
      start: startColor ?? autoPartnerOf(endColor),
      end: endColor ?? autoPartnerOf(startColor),
    };
    const expected = letterColors(ends, hops, tuning);
    assert.equal(letters.length, expected.length, name);
    for (const [index, letter] of letters.entries()) {
      const actual = parseComputedColor(letter);
      assertSameColor(actual, expected[index], `${name} step ${index}`);
    }
  }
});

test('fit keeps its promise per side', async () => {
  const atRest = { curve: 1, lift: 0, shift: 0 };
  const rows = [
    [
      'failing pair on a dark page',
      '#141416',
      4.5,
      ['oklch(35% 0.12 200)', 'oklch(30% 0.12 300)'],
      null,
      11,
      atRest,
      'moved',
    ],
    [
      'failing pair on a light page',
      '#f7f7f5',
      4.5,
      ['oklch(80% 0.12 200)', 'oklch(85% 0.12 300)'],
      null,
      11,
      atRest,
      'moved',
    ],
    [
      'auto end',
      '#141416',
      4.5,
      ['oklch(35% 0.12 200)', null],
      'end',
      11,
      atRest,
      'moved',
    ],
    [
      'ends far apart that dip in the middle',
      '#f7f7f5',
      4.5,
      ['oklch(52% 0.2 30)', 'oklch(52% 0.13 210)'],
      null,
      11,
      atRest,
      'moved',
    ],
    [
      'high lift',
      '#f7f7f5',
      4.5,
      ['oklch(55% 0.1 140)', 'oklch(55% 0.1 200)'],
      null,
      11,
      { ...atRest, curve: 2, lift: 0.16 },
      'moved',
    ],
    [
      '70 letters share 64 steps',
      '#141416',
      4.5,
      ['oklch(40% 0.12 260)', 'oklch(45% 0.12 330)'],
      null,
      70,
      { ...atRest, lift: 0.021, shift: 40 },
      'moved',
    ],
    [
      'mid grey page where the ends start on either side of it',
      '#808080',
      3,
      ['oklch(70% 0.1 200)', 'oklch(50% 0.1 300)'],
      null,
      11,
      atRest,
      'moved',
    ],
    [
      'no lightness reaches the bar at this chroma',
      '#707070',
      4.5,
      ['oklch(70% 0.2 30)', 'oklch(70% 0.2 150)'],
      null,
      11,
      atRest,
      'unreachable',
    ],
    [
      'already passing',
      '#141416',
      4.5,
      ['oklch(80% 0.1 200)', 'oklch(80% 0.1 300)'],
      null,
      11,
      atRest,
      'untouched',
    ],
    [
      'one letter never shows its failing end',
      '#141416',
      4.5,
      ['oklch(80% 0.1 200)', 'oklch(20% 0.1 300)'],
      null,
      1,
      atRest,
      'untouched',
    ],
  ];

  for (const [
    name,
    pageColor,
    bar,
    [startText, endText],
    autoEnd,
    letterTotal,
    tuning,
    outcome,
  ] of rows) {
    const page = await openPage(`<body style="background: ${pageColor}">`);
    const pageLuminance = luminance(
      clipToScreen(
        parseComputedColor(
          await page.evaluate(
            () => getComputedStyle(document.body).backgroundColor
          )
        )
      )
    );

    const startColor = startText && parseComputedColor(startText);
    const endColor = endText && parseComputedColor(endText);
    const ends = {
      start: startColor ?? autoPartnerOf(endColor),
      end: endColor ?? autoPartnerOf(startColor),
    };
    const plan = planFit({
      ends,
      pageLuminance,
      bar,
      letterTotal,
      tuning,
      autoEnd,
    });

    if (outcome === 'unreachable') {
      assert.equal(plan, null, name);
      continue;
    }

    assert.notEqual(plan, null, name);
    const isAnythingMoved = plan.start.isMoved || plan.end.isMoved;
    assert.equal(isAnythingMoved, outcome === 'moved', name);
    if (outcome === 'untouched') {
      assert.deepEqual(plan.start.color, ends.start, name);
      assert.deepEqual(plan.end.color, ends.end, name);
    }
    if (autoEnd) {
      assert.equal(plan[autoEnd].text, null, name);
      assert.equal(plan[autoEnd].isMoved, false, name);
    }

    const startAttribute = plan.start.text ? `start="${plan.start.text}"` : '';
    const endAttribute = plan.end.text ? `end="${plan.end.text}"` : '';
    const style = `--hop-curve: ${tuning.curve}; --hop-lift: ${tuning.lift}; --hop-shift: ${tuning.shift}`;
    await page.evaluate(
      (html) => {
        document.body.innerHTML = html;
      },
      `<hue-hop ${startAttribute} ${endAttribute} style="${style}">${'ab'.repeat(35).slice(0, letterTotal)}</hue-hop>`
    );

    const { hops, letters } = await readElementColors(page, 'hue-hop');
    assert.equal(hops, stepCount(letterTotal), name);
    for (const [index, letter] of letters.entries()) {
      const ratio = contrastRatio(
        luminance(clipToScreen(parseComputedColor(letter))),
        pageLuminance
      );
      assert.ok(ratio >= bar, `${name} step ${index}: ${ratio} under ${bar}`);
    }
  }
});

// Stands in for CSS.supports('color', text), which says yes to var() and the rest of these.
function isColor(text) {
  return /^(#[0-9a-f]{3,8}|red|blue|crimson|darkcyan|inherit|currentcolor|\\.*|(oklch|color-mix|light-dark|var|env|attr|if)\([^;{}]*\)?)$/i.test(
    text
  );
}

function readWithDefaults(search) {
  return { ...DEFAULT_STUDIO, ...readStudioParams(search, { isColor }) };
}

test('studio URL round trip', () => {
  const custom = { hue: 'custom', lift: 0 };
  const roundTrips = [
    ['all defaults', {}, ''],
    ['preset hue', { hue: 'reef' }, 'hue=reef'],
    [
      'default hue with its own end',
      { end: { light: 'crimson', dark: 'crimson' } },
      'hue=dusk&end=crimson',
    ],
    [
      'other hue with its own start',
      { hue: 'reef', start: { light: 'red', dark: 'blue' } },
      null,
    ],
    [
      'custom plain ends',
      {
        ...custom,
        start: { light: 'red', dark: 'red' },
        end: { light: '#00f', dark: '#00f' },
      },
      'hue=custom&start=red&end=%2300f',
    ],
    ['custom with neither end', custom, 'hue=custom'],
    [
      'custom with start only',
      { ...custom, start: { light: 'red', dark: 'red' } },
      'hue=custom&start=red',
    ],
    [
      'light-dark() ends',
      {
        ...custom,
        start: { light: 'oklch(60% 0.12 200)', dark: 'oklch(70% 0.12 200)' },
        end: { light: 'red', dark: 'blue' },
      },
      null,
    ],
    [
      'custom with the hue lift',
      { ...custom, lift: 0.021 },
      'hue=custom&lift=0.021',
    ],
    ['preset with no lift', { lift: 0 }, 'lift=0'],
    ['display implies its bar', { display: true, bar: 3 }, 'display=1'],
    ['display held at 4.5', { display: true }, 'display=1&bar=4.5'],
    [
      'every new parameter',
      {
        curve: 2,
        shift: -40,
        bar: 3,
        font: 'mona',
        weight: 500,
        size: 40,
        pageA: '#000',
        pageB: '#fff',
        isAccentOn: true,
        accent: '!',
        accentColor: { light: 'red', dark: 'blue' },
        isDriftOn: true,
        range: 8,
        cycle: 4,
        side: 'b',
      },
      null,
    ],
    ['markup as text', { text: '<img src=x onerror=alert(1)>' }, null],
    [
      'emoji and reserved characters',
      { text: '\u{1F469}\u{1F3FD}\u200D\u{1F680} &=+' },
      null,
    ],
  ];
  for (const [name, changes, expectedQuery] of roundTrips) {
    const state = { ...DEFAULT_STUDIO, ...changes };
    const query = writeStudioParams(state).toString();
    if (expectedQuery !== null) assert.equal(query, expectedQuery, name);
    assert.deepEqual(readWithDefaults(query), state, name);
  }

  const landingLinks = [
    [
      'preset',
      { ...DEFAULT_STATE, text: 'Aquemini', hue: 'reef' },
      { text: 'Aquemini', hue: 'reef' },
    ],
    [
      'custom ends',
      {
        ...DEFAULT_STATE,
        hue: null,
        lift: 0,
        start: 'darkcyan',
        end: 'light-dark(red, blue)',
      },
      {
        text: 'Halftime',
        hue: 'custom',
        lift: 0,
        start: { light: 'darkcyan', dark: 'darkcyan' },
        end: { light: 'red', dark: 'blue' },
      },
    ],
    [
      'docs example: hue with one end',
      {
        ...DEFAULT_STATE,
        text: 'Check the Rhime',
        hue: 'dusk',
        end: 'crimson',
      },
      {
        text: 'Check the Rhime',
        end: { light: 'crimson', dark: 'crimson' },
      },
    ],
    [
      'tuning',
      {
        ...DEFAULT_STATE,
        curve: 2,
        shift: 40,
        lift: 0.05,
        drift: true,
        display: true,
        accent: '!',
      },
      {
        text: 'Halftime',
        curve: 2,
        shift: 40,
        lift: 0.05,
        isDriftOn: true,
        display: true,
        bar: 3,
        isAccentOn: true,
        accent: '!',
      },
    ],
    [
      'display dropped on custom',
      { ...DEFAULT_STATE, hue: null, lift: 0, start: 'red', display: true },
      {
        text: 'Halftime',
        hue: 'custom',
        lift: 0,
        start: { light: 'red', dark: 'red' },
      },
    ],
  ];
  for (const [name, landingState, changes] of landingLinks) {
    const { search } = new URL(describeStudioLink(landingState));
    assert.deepEqual(
      readWithDefaults(search),
      { ...DEFAULT_STUDIO, ...changes },
      name
    );
  }

  const reads = [
    ['empty text', 'text=&range=8', { range: 8 }],
    ['blank text', 'text=%20%20&range=8', { range: 8 }],
    ['unknown color', 'start=tael&curve=2', { curve: 2 }],
    [
      'one end skipped',
      'start=tael&end=red',
      { hue: 'custom', lift: 0, end: { light: 'red', dark: 'red' } },
    ],
    ['color with a CSS break', 'start=red;}&hue=reef', { hue: 'reef' }],
    ['color with var()', 'start=var(--x)&weight=500', { weight: 500 }],
    ['one-sided pair', 'start=light-dark(red)&weight=500', { weight: 500 }],
    ['page with var()', 'pagea=var(--x)&pageb=red', { pageB: 'red' }],
    ['color with env()', 'start=env(x)&weight=500', { weight: 500 }],
    ['color left open', 'start=oklch(50% 0.1 200&weight=500', { weight: 500 }],
    ['longest text', `text=${'x'.repeat(200)}`, { text: 'x'.repeat(200) }],
    [
      'text too long is cut',
      `text=${'x'.repeat(201)}`,
      { text: 'x'.repeat(200) },
    ],
    [
      'accent too long is cut',
      `accent=${'x'.repeat(201)}`,
      { isAccentOn: true, accent: 'x'.repeat(200) },
    ],
    [
      '101 emoji stay whole',
      `text=${'😀'.repeat(101)}`,
      { text: '😀'.repeat(101) },
    ],
    [
      '201 emoji cut whole',
      `text=${'😀'.repeat(201)}`,
      { text: '😀'.repeat(200) },
    ],
    ['blank once cut', `text=${' '.repeat(200)}x&size=40`, { size: 40 }],
    ['color with attr()', 'end=attr(x)&weight=500', { weight: 500 }],
    ['color with if()', 'pagea=if(x)&pageb=red', { pageB: 'red' }],
    ['color with inherit', 'pagea=inherit&pageb=red', { pageB: 'red' }],
    ['color hiding in an escape', 'start=%5C76 ar(x)&size=40', { size: 40 }],
    [
      'mix with currentcolor',
      'start=color-mix(in oklch, currentcolor, red)&size=40',
      { size: 40 },
    ],
    [
      'pair holding env()',
      'start=light-dark(red, env(x))&size=40',
      { size: 40 },
    ],
    [
      'page is one color',
      'pagea=light-dark(red, blue)&pageb=red',
      { pageB: 'red' },
    ],
    [
      'plain mix still reads',
      'pagea=color-mix(in oklch, red, blue)',
      { pageA: 'color-mix(in oklch, red, blue)' },
    ],
    ['unknown font', 'font=comic&size=40', { size: 40 }],
    ['curve out of range', 'curve=99&shift=10', { shift: 10 }],
    ['lift out of range', 'lift=9&shift=10', { shift: 10 }],
    ['shift out of range', 'shift=999&curve=2', { curve: 2 }],
    ['bar not offered', 'bar=2&cycle=5', { cycle: 5 }],
    ['unknown hue', 'hue=tael&curve=2', { curve: 2 }],
    [
      'unknown hue with an end',
      'hue=tael&start=red',
      { hue: 'custom', lift: 0, start: { light: 'red', dark: 'red' } },
    ],
    [
      'no hue with an end',
      'end=red',
      { hue: 'custom', lift: 0, end: { light: 'red', dark: 'red' } },
    ],
    [
      'display means nothing on custom',
      'hue=custom&display=1',
      { hue: 'custom', lift: 0 },
    ],
    [
      'display picks its bar',
      'hue=reef&display=true',
      { hue: 'reef', display: true, bar: 3 },
    ],
    ['accent turns itself on', 'accent=!', { isAccentOn: true, accent: '!' }],
    ['scheme by letter', 'scheme=b', { side: 'b' }],
    ['scheme by name', 'scheme=dark', { side: 'a' }],
    ['scheme not on the list', 'scheme=constructor', {}],
  ];
  for (const [name, query, changes] of reads) {
    assert.deepEqual(
      readWithDefaults(query),
      { ...DEFAULT_STUDIO, ...changes },
      name
    );
  }

  const schemeWrites = [
    ['alone', { side: 'a' }, ''],
    ['beside text', { side: 'b', text: 'Juicy' }, 'text=Juicy&scheme=b'],
  ];
  for (const [name, changes, expectedQuery] of schemeWrites) {
    const state = { ...DEFAULT_STUDIO, ...changes };
    assert.equal(writeStudioParams(state).toString(), expectedQuery, name);
  }
});
