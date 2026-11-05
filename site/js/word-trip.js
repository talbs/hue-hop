import { splitLetters } from './motion.js';

const TRIP_KEY = 'hue-hop-word-trip';
const MOST_LETTERS = 64;
// hue-hop turns its colors off outside this media query, and a plain word has no trip to make.
const isColorModeOn = matchMedia(
  '(forced-colors: none) and (prefers-contrast: no-preference)'
);

let wordToSend = null;
let urlToSend = null;
let wordInFlight = null;

export function isPlainClick({ metaKey, ctrlKey, shiftKey, altKey }) {
  return !(metaKey || ctrlKey || shiftKey || altKey);
}

function forgetFlag() {
  try {
    sessionStorage.removeItem(TRIP_KEY);
  } catch {}
}

// Loading this page means any flag left here belongs to a trip that never landed.
forgetFlag();

function wordOfLink(link) {
  if (link.id === 'studio-link') return document.getElementById('live');
  return link.closest('figure')?.querySelector('.example-preview hue-hop');
}

function finishHops(word) {
  for (const letter of word.querySelectorAll('.hop-letter')) {
    for (const hop of letter.getAnimations()) hop.finish();
  }
}

function isOnScreen({ top, right, bottom, left }) {
  return bottom > 0 && right > 0 && top < innerHeight && left < innerWidth;
}

function canTravel(word) {
  const letterCount = splitLetters(word.textContent.trim()).length;
  if (letterCount === 0 || letterCount > MOST_LETTERS) return false;
  // A word wrapped onto two lines can't be named for a view transition.
  if (word.getClientRects().length !== 1) return false;
  return isColorModeOn.matches && isOnScreen(word.getBoundingClientRect());
}

// A click can get a 204 and go nowhere, so a later Forward to the same URL has to not count.
function isFollowingClick(activation) {
  return (
    activation?.navigationType === 'push' && activation.entry.url === urlToSend
  );
}

document.addEventListener('click', (event) => {
  wordToSend = null;
  if (!isPlainClick(event)) return;
  const link = event.target.closest?.('#studio-link, .code-studio');
  if (!link) return;
  wordToSend = wordOfLink(link) ?? null;
  urlToSend = link.href;
  if (wordToSend) finishHops(wordToSend);
});

addEventListener('pageswap', (event) => {
  forgetFlag();
  const word = wordToSend;
  wordToSend = null;
  if (!word || !event.viewTransition) return;
  if (!isFollowingClick(event.activation) || !canTravel(word)) return;
  const { left, top, width, height } = word.getBoundingClientRect();
  try {
    sessionStorage.setItem(
      TRIP_KEY,
      JSON.stringify({ left, top, width, height })
    );
  } catch {
    return;
  }
  word.style.viewTransitionName = 'studio-word';
  event.viewTransition.types.add('word-trip');
  wordInFlight = word;
});

// A Back while the Studio holds its first paint leaves the flag behind, since the Studio never got to read it. And Back can restore this page from the browser's page cache with the name still on, which would fly the word in reverse.
addEventListener('pagereveal', () => {
  forgetFlag();
  wordToSend = null;
  if (!wordInFlight) return;
  wordInFlight.style.viewTransitionName = '';
  wordInFlight = null;
});
