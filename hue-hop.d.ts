import type { HueHop, HueName } from './element.js';

export * from './element.js';

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
          drift?: boolean;
          hue?: HueName;
          display?: boolean;
          start?: string;
          end?: string;
        };
    }
  }
}
