import { SITE_URL } from '../site/js/urls.js';

export const ASSISTANT_PROMPT = `Add Hue Hop to this project. Read ${SITE_URL}llms.txt first, and follow its rules. Before you add it, ask me which heading it goes on, and whether to use a ready-made hue or my brand colors.`;

export const AGENT_RULES = `## Hue Hop

- Before adding or changing a \`<hue-hop>\`, read ${SITE_URL}llms.txt and follow its Rules.`;

// Mirrors the docs' "Your part" list. Change both together.
export const LLMS_RULES = [
  'Headings and names only. Never body copy.',
  `Use a ready-made \`hue\`, or check your own \`start\` and \`end\` against the [lightness table](${SITE_URL}docs/#keep-them-readable).`,
  'The page needs a `color-scheme` to show the dark-scheme colors of a `hue`.',
  '`drift` needs `drift.css`.',
  'Keep link underlines on.',
  'Set `--hop-curve` and `--hop-shift` once, on `:root` or a class.',
  'A `hue` beats inherited values, `--hop-lift` included. To override one, set `start`, `end`, or `--hop-*` on the element, in any CSS layer.',
  '`display` is for large text only.',
  'Pin the version.',
];

export const DOCS_GROUPS = [
  [
    'Start',
    [
      ['Get Started', '#get-started'],
      ['Where It Fits', '#where-it-fits'],
      ['Build with AI', '#build-with-ai'],
    ],
  ],
  [
    'Use',
    [
      ['Hues', '#hues'],
      ['Your Own Colors', '#your-own-colors'],
      ['Light and Dark', '#light-and-dark'],
      ['Drift', '#drift'],
      ['Studio', '#studio'],
      ['Accessibility', '#accessibility'],
    ],
  ],
  [
    'Customize',
    [
      ['Tuning the Ramp', '#tuning'],
      ['Styling Around It', '#styling'],
    ],
  ],
  [
    'Integrate',
    [
      ['Frameworks and Editors', '#frameworks-and-editors'],
      ['Testing Your App', '#testing'],
    ],
  ],
  [
    'Reference',
    [
      ['API', '#api'],
      ['Browser Support', '#browser-support'],
      ['Known Limits', '#known-limits'],
      ['Troubleshooting', '#troubleshooting'],
    ],
  ],
  [
    'About',
    [
      ['How It Works', '#how-it-works'],
      ['Inspiration', '#inspiration'],
      ['Support', '#support'],
      ['Colophon', '#colophon'],
    ],
  ],
];

export const DOCS_LINKS = DOCS_GROUPS.flatMap(([, links]) => links);
