import { isMotionOk } from './motion.js';

const countdown = document.getElementById('countdown');

function readSeconds(clock) {
  const [hours, minutes, seconds] = clock.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatClock(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

if (countdown && isMotionOk()) {
  const startSeconds = readSeconds(countdown.textContent.trim());
  let secondsLeft = startSeconds;
  let ticker;
  const tick = () => {
    secondsLeft = secondsLeft > 0 ? secondsLeft - 1 : startSeconds;
    countdown.textContent = formatClock(secondsLeft);
  };
  new IntersectionObserver(([entry]) => {
    clearInterval(ticker);
    if (entry.isIntersecting) ticker = setInterval(tick, 1000);
  }).observe(countdown);
}
