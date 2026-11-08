import { HueHop } from './element.js';

export { HueHop };

if (globalThis.customElements && !customElements.get('hue-hop')) {
  customElements.define('hue-hop', HueHop);
}
