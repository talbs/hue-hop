export type HueName =
  'dusk' | 'reef' | 'fern' | 'ember' | 'guava' | 'orchid' | 'honey';

export class HueHop extends HTMLElement {
  /** How many color steps the letters use, one per letter up to 64, or `0` when the element is off the page or the browser lacks support. */
  readonly hops: number;
  /** The color of the first letter, mirroring the `start` attribute, where `null` removes it. */
  start: string | null;
  /** The color of the last letter, mirroring the `end` attribute, where `null` removes it. */
  end: string | null;
  /** Which ready-made color pair the element uses, mirroring the `hue` attribute, where `null` removes it. */
  hue: HueName | null;
  /** Whether the hue uses its large-heading version, mirroring the `display` attribute, where `false` removes it. */
  display: boolean;
  /** Whether the hues sway, mirroring the `drift` attribute, where `false` removes it. */
  drift: boolean;
}
