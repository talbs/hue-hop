// microlighter 2.2.0 misses attributes inside <script> and <style> opening tags (ported from Tiny Tells) and plain bash commands, so add them each time it paints.
const EMBED_TAG = /<(?:script|style)\b([^>]*)>/gi;
const EMBED_ATTR = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(["'])(.*?)\2)?/g;

function findEmbedRanges() {
  const ranges = {
    'attribute-name': [],
    'attribute-value': [],
    punctuation: [],
  };
  for (const code of document.querySelectorAll('pre > code.language-html')) {
    const text = code.firstChild;
    if (text?.nodeType !== Node.TEXT_NODE) continue;
    for (const tag of text.data.matchAll(EMBED_TAG)) {
      const attributesStart = tag.index + tag[0].indexOf(tag[1]);
      for (const attribute of tag[1].matchAll(EMBED_ATTR)) {
        const nameStart = attributesStart + attribute.index;
        const addRange = (category, start, end) => {
          const range = new Range();
          range.setStart(text, start);
          range.setEnd(text, end);
          ranges[category].push(range);
        };
        addRange('attribute-name', nameStart, nameStart + attribute[1].length);
        if (attribute[2] === undefined) continue;
        const quoteStart = nameStart + attribute[0].indexOf(attribute[2]);
        const valueEnd = quoteStart + 1 + attribute[3].length;
        addRange('punctuation', quoteStart, quoteStart + 1);
        addRange('attribute-value', quoteStart + 1, valueEnd);
        addRange('punctuation', valueEnd, valueEnd + 1);
      }
    }
  }
  return ranges;
}

const BASH_WORD = /\S+/g;

function findBashRanges() {
  const ranges = { function: [], constant: [] };
  for (const code of document.querySelectorAll('pre > code.language-bash')) {
    const text = code.firstChild;
    if (text?.nodeType !== Node.TEXT_NODE) continue;
    let lineStart = 0;
    for (const line of text.data.split('\n')) {
      for (const [index, word] of [...line.matchAll(BASH_WORD)].map(
        (match, position) => [position, match]
      )) {
        const category =
          index === 0
            ? 'function'
            : word[0].startsWith('-')
              ? 'constant'
              : null;
        if (!category) continue;
        const range = new Range();
        range.setStart(text, lineStart + word.index);
        range.setEnd(text, lineStart + word.index + word[0].length);
        ranges[category].push(range);
      }
      lineStart += line.length + 1;
    }
  }
  return ranges;
}

function findExtraRanges() {
  const extra = findEmbedRanges();
  for (const [category, ranges] of Object.entries(findBashRanges())) {
    extra[category] = [...(extra[category] ?? []), ...ranges];
  }
  return extra;
}

// microlighter sets every category in one synchronous loop, so find the extra ranges once per pass.
let passRanges = null;

function extraRangesForPass() {
  if (!passRanges) {
    passRanges = findExtraRanges();
    queueMicrotask(() => {
      passRanges = null;
    });
  }
  return passRanges;
}

if (globalThis.CSS?.highlights) {
  const setHighlight = CSS.highlights.set.bind(CSS.highlights);
  CSS.highlights.set = (name, highlight) => {
    const extraRanges = extraRangesForPass();
    extraRanges[name]?.forEach((range) => highlight.add(range));
    setHighlight(name, highlight);
    for (const [category, ranges] of Object.entries(extraRanges)) {
      if (!CSS.highlights.has(category)) {
        setHighlight(category, new Highlight(...ranges));
      }
    }
    return CSS.highlights;
  };
}
