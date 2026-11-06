export const DEFAULT_STATE = {
  text: 'Halftime',
  hue: 'dusk',
  start: null,
  end: null,
  curve: 1,
  shift: 0,
  lift: 0.021,
  drift: false,
  display: false,
  accent: null,
};

// A hue sets the lift, so only custom ends start from 0.
export function defaultLift(hue) {
  return hue && hue !== 'custom' ? DEFAULT_STATE.lift : 0;
}

export function decimalsIn(step) {
  return String(step).split('.')[1]?.length ?? 0;
}

export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function changedTuning(state) {
  const defaults = { ...DEFAULT_STATE, lift: defaultLift(state.hue) };
  return ['curve', 'shift', 'lift'].filter(
    (name) => state[name] !== defaults[name]
  );
}

export function styleFor(state) {
  return changedTuning(state)
    .map((name) => `--hop-${name}: ${state[name]}`)
    .join('; ');
}

export function describeMarkup(state) {
  const parts = ['hue-hop'];
  for (const name of ['hue', 'start', 'end']) {
    if (state[name]) parts.push(`${name}="${escapeHtml(state[name])}"`);
  }
  if (state.display) parts.push('display');
  if (state.drift) parts.push('drift');
  const style = styleFor(state);
  if (style) parts.push(`style="${escapeHtml(style)}"`);
  const element = `<${parts.join(' ')}>${escapeHtml(state.text)}</hue-hop>`;
  if (!state.accent) return element;
  return `${element}<span class="accent">${escapeHtml(state.accent)}</span>`;
}

export function describeStudioLink(state) {
  const params = new URLSearchParams();
  params.set('text', state.text);
  if (state.hue !== DEFAULT_STATE.hue || state.start || state.end) {
    params.set('hue', state.hue ?? 'custom');
  }
  if (state.start) params.set('start', state.start);
  if (state.end) params.set('end', state.end);
  for (const name of changedTuning(state)) params.set(name, state[name]);
  if (state.drift) params.set('drift', '1');
  if (state.display) params.set('display', '1');
  if (state.accent) params.set('accent', state.accent);
  return `${new URL('../studio/', import.meta.url)}?${params}`;
}
