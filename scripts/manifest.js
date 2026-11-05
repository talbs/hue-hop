import { escapeHtml } from '../site/js/state.js';

const FENCE = '```';
const NO_VALUE_ICON =
  '<wa-icon canvas="auto" family="pixel" name="minus" label="None"></wa-icon>';

function readElement(manifest) {
  return manifest.modules[0].declarations[0];
}

function readFields(manifest) {
  return readElement(manifest).members.filter(
    (member) => member.kind === 'field'
  );
}

function listUnionMembers(code) {
  const members = code.split(' | ');
  if (members.length < 3) return code;
  const spans = [];
  for (const member of members) {
    const value = member.replaceAll('&#39;', '').replaceAll("'", '');
    spans.push(`<span class="type-member">${value}</span>`);
  }
  return spans.join(' ');
}

function codeSpansToHtml(text) {
  const parts = text.split('`');
  let html = '';
  for (let index = 0; index < parts.length; index++) {
    const escaped = escapeHtml(parts[index]);
    html +=
      index % 2 === 1 ? `<code>${listUnionMembers(escaped)}</code>` : escaped;
  }
  return html;
}

function describeAttributeType(attribute) {
  return `\`${attribute.type.text}\``;
}

function describePropertyType(field) {
  const type = `\`${field.type.text}\``;
  return field.readonly ? `${type}, read-only` : type;
}

function describeCssPropertySyntax(property) {
  return `\`${property.syntax}\``;
}

function describeCssPropertyDefault(property) {
  return property.default ? `\`${property.default}\`` : null;
}

function describeCssPropertyType(property) {
  const syntax = describeCssPropertySyntax(property);
  if (!property.default) return syntax;
  return `${syntax}, default ${describeCssPropertyDefault(property)}`;
}

function tableRows(entries, ...describeColumns) {
  const rows = [];
  for (const entry of entries) {
    let cells = `<td><code>${escapeHtml(entry.name)}</code></td>`;
    for (const describeColumn of describeColumns) {
      const description = describeColumn(entry);
      cells += `<td>${description ? codeSpansToHtml(description) : NO_VALUE_ICON}</td>`;
    }
    cells += `<td>${codeSpansToHtml(entry.description)}</td>`;
    rows.push(`<tr>${cells}</tr>`);
  }
  return rows.join('\n');
}

function listItems(entries, describeType) {
  const items = [];
  for (const entry of entries) {
    items.push(
      `- \`${entry.name}\` (${describeType(entry)}): ${entry.description}`
    );
  }
  return items.join('\n');
}

export function attributeRows(manifest) {
  return tableRows(readElement(manifest).attributes, describeAttributeType);
}

export function propertyRows(manifest) {
  return tableRows(readFields(manifest), describePropertyType);
}

export function cssPropertyRows(manifest) {
  return tableRows(
    readElement(manifest).cssProperties,
    describeCssPropertySyntax,
    describeCssPropertyDefault
  );
}

export function llmsText({
  manifest,
  version,
  cdnVersion,
  siteUrl,
  studioUrl,
  rules,
  docsLinks,
}) {
  const element = readElement(manifest);
  const cdnBase = `https://cdn.jsdelivr.net/npm/${cdnVersion}/dist`;
  const docsItems = docsLinks.map(
    ([title, hash]) => `- [${title}](${siteUrl}docs/${hash})`
  );

  const sections = [
    '# Hue Hop',
    '> Every letter hops a hue. `<hue-hop>` colors each letter of a heading or name, one flat color at a time, from a start color to an end color. The text stays text: select it, find it, copy it, read it with a screen reader. One custom element, no dependencies, under 2 KB gzipped. Chrome 134+, Firefox 140+, Safari 18+.',
    `This file describes version ${version}. Hue Hop is pre-1.0, so pin the version.`,
    '## Install',
    'With a bundler:',
    `${FENCE}bash\nnpm install hue-hop\n${FENCE}`,
    `${FENCE}js\nimport 'hue-hop';\nimport 'hue-hop/hues.css';\nimport 'hue-hop/drift.css';\n${FENCE}`,
    'Without one:',
    [
      `${FENCE}html`,
      `<script type="module" src="${cdnBase}/hue-hop.js"></script>`,
      `<link rel="stylesheet" href="${cdnBase}/hues.css">`,
      `<link rel="stylesheet" href="${cdnBase}/drift.css">`,
      FENCE,
    ].join('\n'),
    '`hues.css` adds the seven ready-made hues. `drift.css` adds drift. Load only the ones you use. Types ship with the package, and the element class is exported as `HueHop`.',
    '## Use',
    `${FENCE}html\n<h1><hue-hop hue="dusk">Midnight Marauders</hue-hop></h1>\n${FENCE}`,
    'Rules:',
    rules.map((rule) => `- ${rule}`).join('\n'),
    '## Attributes',
    listItems(element.attributes, describeAttributeType),
    '## Properties',
    listItems(readFields(manifest), describePropertyType),
    '## CSS',
    listItems(element.cssProperties, describeCssPropertyType),
    '## Highlights',
    'The colors are highlights named `hue-hop-0` up to `hue-hop-63` in `CSS.highlights`, at priority -1. The names are public and frozen. `CSS.highlights.clear()` removes the colors until the text changes or the element reconnects.',
    '## Docs',
    docsItems.join('\n'),
    `Studio, for checking your own colors: ${studioUrl}`,
  ];
  return `${sections.join('\n\n')}\n`;
}
