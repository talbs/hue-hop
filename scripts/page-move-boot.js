// The build inlines these into each page's <head>, because a page's first frame can come before its modules run. They can't use imports or outer variables.

// A group's default animation also runs width and height, which holds it on the main thread even when they don't change.
export function keepGroupsOnTransform({ viewTransition }) {
  viewTransition?.ready.then(
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
        if (!(widthChange < 0.5 && heightChange < 0.5)) continue;
        effect.setKeyframes([
          { transform: from.transform, easing: from.easing },
          { transform: to.transform },
        ]);
      }
    },
    () => {}
  );
}

// A header scrolled off the page would fly in from above if it kept its names, so it stays part of the page's fade.
export function markHeaderAway() {
  const header = document.querySelector('.site-header');
  const isAway = header && Math.abs(header.getBoundingClientRect().top) > 0.5;
  document.documentElement.toggleAttribute('data-header-away', Boolean(isAway));
}
