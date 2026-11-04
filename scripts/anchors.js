const ID = /\sid="([^"]+)"/g;
const IN_PAGE_LINK = /\shref="#([^"]+)"/g;
const ANCHOR_NAME = /^[\w-]+/;

function readMatches(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

function readAnchorsAfter(text, prefix) {
  const anchors = [];
  for (const part of text.split(prefix).slice(1)) {
    anchors.push(part.match(ANCHOR_NAME)?.[0] ?? '');
  }
  return anchors;
}

export function checkAnchors({
  docsHtml,
  pages,
  llmsText,
  readmeText,
  siteUrl,
}) {
  const ids = new Set(readMatches(docsHtml, ID));
  const anchors = [
    ...readMatches(docsHtml, IN_PAGE_LINK),
    ...pages.flatMap((page) => readAnchorsAfter(page, 'docs/#')),
    ...readAnchorsAfter(llmsText, `${siteUrl}docs/#`),
    ...readAnchorsAfter(readmeText, `${siteUrl}docs/#`),
  ];

  const deadAnchors = new Set();
  for (const anchor of anchors) {
    if (!ids.has(anchor)) deadAnchors.add(`#${anchor}`);
  }
  if (deadAnchors.size > 0) {
    throw new Error(`Dead anchors: ${[...deadAnchors].join(', ')}`);
  }
  return anchors.length;
}
