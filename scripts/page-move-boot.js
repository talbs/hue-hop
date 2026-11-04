// The build inlines these into each page's <head>, because a page's first frame can come before its modules run. They can't use imports or outer variables.

// A group's default animation also runs width and height, which holds it on the main thread even when they don't change.
export function keepGroupsOnTransform({ viewTransition }) {
  if (!viewTransition?.types.has('studio-move')) return;
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

export function isStudioUrl(url) {
  return new URL(url, location.href).pathname
    .replace(/\/$/, '')
    .endsWith('/studio');
}

// A browser with no activation to read has only the clicked link to go on, so its Back or Forward to the Studio gets the plain fade.
export function rememberClickedLink(event) {
  window.lastClickedHref = event.target.closest?.('a')?.href;
}

export function markStudioMoveLeaving(event) {
  const isLeavingStudio = isStudioUrl(location.href);
  try {
    if (isLeavingStudio) sessionStorage.setItem('hue-hop-left-studio', '1');
  } catch {}
  const destination = event.activation?.entry?.url ?? window.lastClickedHref;
  const isGoingToStudio = destination && isStudioUrl(destination);
  if (isLeavingStudio || isGoingToStudio) {
    event.viewTransition?.types.add('studio-move');
  }
}

export function markStudioMoveArriving(event) {
  let hasLeftStudio = false;
  try {
    hasLeftStudio = sessionStorage.getItem('hue-hop-left-studio') === '1';
    sessionStorage.removeItem('hue-hop-left-studio');
  } catch {}
  if (hasLeftStudio || isStudioUrl(location.href)) {
    event.viewTransition?.types.add('studio-move');
  }
}
