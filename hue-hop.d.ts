export class HueHop extends HTMLElement {
  /** How many color steps the letters use, one per letter up to 64, or `0` when the element is off the page or the browser lacks support. */
  readonly hops: number;
  /** The color of the first letter, mirroring the `start` attribute, where `null` removes it. */
  start: string | null;
  /** The color of the last letter, mirroring the `end` attribute, where `null` removes it. */
  end: string | null;
}

declare global {
  interface HTMLElementTagNameMap {
    'hue-hop': HueHop;
  }
}

declare module 'react' {
  // Empty interfaces merge into React's own. Without @types/react they stand in,
  // so this file still type-checks with skipLibCheck off.
  interface ClassAttributes<T> {}
  interface HTMLAttributes<T> {}

  namespace JSX {
    interface IntrinsicElements {
      'hue-hop': ClassAttributes<HueHop> &
        HTMLAttributes<HueHop> & {
          drift?: boolean | '';
          hue?:
            'dusk' | 'reef' | 'fern' | 'ember' | 'guava' | 'orchid' | 'honey';
          display?: boolean | '';
          start?: string;
          end?: string;
        };
    }
  }
}
