import { codeFromPreview, dedent } from '../site/js/example-code.js';
import { escapeHtml } from '../site/js/state.js';

const FIGURE_TAG = /<figure(?=[\s>])[^>]*>/g;
const OPENING_TAG = /<([a-zA-Z][\w-]*)(?=[\s>/])[^>]*>/g;
const EXAMPLE_CSS =
  /<style(?=[\s>])[^>]*\sdata-example-css[^>]*>([\s\S]*?)<\/style>/;
const TRAILING_FIGCAPTION = /<figcaption(?=[\s>])[\s\S]*<\/figcaption>\s*$/;
const EMPTY_COPY_BUTTON =
  /<wa-copy-button(?=[\s>])([^>]*)>\s*<\/wa-copy-button>/g;

function hasClass(openingTag, className) {
  const classValue = openingTag.match(/\sclass="([^"]*)"/)?.[1] ?? '';
  return classValue.split(/\s+/).includes(className);
}

function findClosingTag(html, tagName, searchFrom) {
  const tags = new RegExp(`<(/?)${tagName}(?=[\\s>/])[^>]*>`, 'gi');
  tags.lastIndex = searchFrom;
  let depth = 1;
  for (const tag of html.matchAll(tags)) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) return tag.index;
  }
  throw new Error(`No closing </${tagName}> after index ${searchFrom}`);
}

function findPreviewMarkup(figureBody) {
  for (const tag of figureBody.matchAll(OPENING_TAG)) {
    if (!hasClass(tag[0], 'example-preview')) continue;
    const innerStart = tag.index + tag[0].length;
    const innerEnd = findClosingTag(figureBody, tag[1], innerStart);
    return figureBody.slice(innerStart, innerEnd);
  }
  throw new Error('An example figure has no .example-preview');
}

function copyButton(id, label) {
  return [
    `<wa-copy-button class="code-copy" from="${id}" copy-label="${label}">`,
    '<wa-icon slot="copy-icon" canvas="auto" family="pixel" name="clone"></wa-icon>',
    '<wa-icon slot="success-icon" canvas="auto" family="pixel" name="check"></wa-icon>',
    '<wa-icon slot="error-icon" canvas="auto" family="pixel" name="xmark"></wa-icon>',
    '</wa-copy-button>',
  ].join('\n');
}

function codeWell(id, language, code, copyLabel) {
  return [
    '<div class="code-well">',
    `<pre class="code-block"><code class="language-${language}" id="${id}">${escapeHtml(code)}</code></pre>`,
    copyButton(id, copyLabel),
    '</div>',
  ].join('\n');
}

function addCodeWells(figureBody, exampleNumber) {
  const wells = [
    codeWell(
      `example-${exampleNumber}-html`,
      'html',
      codeFromPreview(findPreviewMarkup(figureBody)),
      'Copy HTML'
    ),
  ];
  const exampleCss = figureBody.match(EXAMPLE_CSS);
  if (exampleCss) {
    wells.push(
      codeWell(
        `example-${exampleNumber}-css`,
        'css',
        dedent(exampleCss[1]),
        'Copy CSS'
      )
    );
  }

  const insertAt =
    figureBody.match(TRAILING_FIGCAPTION)?.index ?? figureBody.length;
  return `${figureBody.slice(0, insertAt)}${wells.join('\n')}\n${figureBody.slice(insertAt)}`;
}

export function compileExamples(html) {
  let page = '';
  let cursor = 0;
  let exampleNumber = 0;
  for (const figureTag of html.matchAll(FIGURE_TAG)) {
    const isInsideCompiledFigure = figureTag.index < cursor;
    if (isInsideCompiledFigure || !hasClass(figureTag[0], 'example')) continue;
    const bodyStart = figureTag.index + figureTag[0].length;
    const bodyEnd = findClosingTag(html, 'figure', bodyStart);
    exampleNumber += 1;
    page += html.slice(cursor, bodyStart);
    page += addCodeWells(html.slice(bodyStart, bodyEnd), exampleNumber);
    cursor = bodyEnd;
  }
  return page + html.slice(cursor);
}

export function fillCopyButtons(html) {
  return html.replace(EMPTY_COPY_BUTTON, (emptyButton, attributeText) => {
    const openingTag = `<wa-copy-button${attributeText}>`;
    if (!hasClass(openingTag, 'code-copy')) return emptyButton;
    const id = attributeText.match(/\sfrom="([^"]*)"/)?.[1];
    const label = attributeText.match(/\scopy-label="([^"]*)"/)?.[1];
    if (!id || !label) {
      throw new Error(`A copy button needs from and copy-label: ${openingTag}`);
    }
    return copyButton(id, label);
  });
}
