// The build inlines these into each page's <head>, because a page's first frame can come before its modules run. They can't use imports or outer variables.

// A group's default animation also runs width and height, which holds it on the main thread even when they don't change.
export function keepGroupsOnTransform({ viewTransition }) {
  if (!viewTransition) return;
  viewTransition.ready.then(
    () => {
      for (const { effect } of document.getAnimations()) {
        if (!effect?.pseudoElement?.startsWith('::view-transition-group')) {
          continue;
        }
        const [from, to] = effect.getKeyframes();
        const widthChange = Math.abs(
          parseFloat(from.width) - parseFloat(to.width)
        );
        const heightChange = Math.abs(
          parseFloat(from.height) - parseFloat(to.height)
        );
        // A few pixels is a font still settling on the new page, and animating it would pull the group off the compositor while that page loads. The nav's images are held at size, so its width would only move a crop.
        const isHeldAtSize = effect.pseudoElement.includes('site-nav');
        if (!isHeldAtSize && !(widthChange < 8 && heightChange < 8)) continue;
        effect.setKeyframes([
          { transform: from.transform, easing: from.easing },
          { transform: to.transform },
        ]);
      }
    },
    () => {}
  );
}
