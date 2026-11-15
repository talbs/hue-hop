// hue-hop turns its colors off outside this media query.
export const isColorModeOn = matchMedia(
  '(forced-colors: none) and (prefers-contrast: no-preference)'
);

export function floorRatio(ratio) {
  return (Math.floor(ratio * 10) / 10).toFixed(1);
}
