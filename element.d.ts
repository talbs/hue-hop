export type HueName =
  'dusk' | 'reef' | 'fern' | 'ember' | 'guava' | 'orchid' | 'honey';

export class HueHop extends HTMLElement {
  /** How many color steps the letters use, one per letter up to 64, or `0` when the element is off the page or the browser lacks support. */
  readonly hops: number;
  /** The color of the first letter, mirroring the `start` attribute, where `null` removes it. */
  start: string | null;
  /** The color of the last letter, mirroring the `end` attribute, where `null` removes it. */
  end: string | null;
  /** How the steps are spaced, mirroring the `curve` attribute, where `null` removes it. */
  get curve(): string | null;
  set curve(value: string | number | null);
  /** How much extra color intensity the middle letters get, mirroring the `boost` attribute, where `null` removes it. */
  get boost(): string | null;
  set boost(value: string | number | null);
  /** How many degrees each letter's hue turns, mirroring the `shift` attribute, where `null` removes it. */
  get shift(): string | null;
  set shift(value: string | number | null);
  /** How many degrees the hues sway each way, mirroring the `drift-range` attribute, where `null` removes it. */
  get driftRange(): string | null;
  set driftRange(value: string | number | null);
  /** How long one full sway takes, like `4s`, mirroring the `drift-cycle` attribute, where `null` removes it. */
  get driftCycle(): string | null;
  set driftCycle(value: string | null);
  /** Which ready-made color pair the element uses, mirroring the `hue` attribute, where `null` removes it. */
  hue: HueName | null;
  /** Whether the hue uses its large-heading version, mirroring the `display` attribute, where `false` removes it. */
  display: boolean;
  /** Whether the hues sway, mirroring the `drift` attribute, where `false` removes it. */
  drift: boolean;
}
