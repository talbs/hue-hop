const OPENING_TAG = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTRIBUTE = /([^\s"'=<>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
const WIRING_ATTRIBUTES = ['id', 'hops', 'role'];

function isWiringAttribute(name) {
  const lowerName = name.toLowerCase();
  return lowerName.startsWith('data-') || WIRING_ATTRIBUTES.includes(lowerName);
}

function onOneLine(quotedValue) {
  const quote = quotedValue[0];
  const inner = quotedValue.slice(1, -1).replace(/\s+/g, ' ').trim();
  return `${quote}${inner}${quote}`;
}

function rewriteOpeningTag(tagName, attributeText) {
  const isSelfClosing = /\/\s*$/.test(attributeText);
  const parts = [tagName];
  for (const [whole, name, value] of attributeText.matchAll(ATTRIBUTE)) {
    if (isWiringAttribute(name)) continue;
    const isEmptyValue = value === '""' || value === "''";
    if (isEmptyValue) parts.push(name);
    else if (value?.includes('\n')) parts.push(`${name}=${onOneLine(value)}`);
    else parts.push(whole);
  }
  if (isSelfClosing) parts.push('/');
  return `<${parts.join(' ')}>`;
}

export function dedent(text) {
  const lines = text.split('\n');
  const isBlank = (line) => line.trim() === '';
  while (lines.length && isBlank(lines[0])) lines.shift();
  while (lines.length && isBlank(lines.at(-1))) lines.pop();

  let commonIndent = Infinity;
  for (const line of lines) {
    if (isBlank(line)) continue;
    const indent = line.length - line.trimStart().length;
    commonIndent = Math.min(commonIndent, indent);
  }
  return lines.map((line) => line.slice(commonIndent)).join('\n');
}

export function codeFromPreview(html) {
  const rewritten = html.replace(OPENING_TAG, (tag, tagName, attributeText) =>
    rewriteOpeningTag(tagName, attributeText)
  );
  return dedent(rewritten);
}
