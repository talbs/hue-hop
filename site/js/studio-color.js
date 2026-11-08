import {
  clipToScreen,
  contrastRatio,
  GREY_CHROMA,
  luminance,
  oklchToLinearSrgb,
  wrapHue,
} from './color.js';

const STEP_CAP = 64;
const FIT_STEP_LIMIT = 40;
const FIT_STEP = 0.004;
// Lands a little past the bar, so another browser's rounding can't turn the lamp to Check right after Fit.
const FIT_MARGIN = 0.02;

export function stepCount(letterCount) {
  return Math.min(letterCount, STEP_CAP);
}

export function stepOfLetter(index, letterCount) {
  return Math.floor((index * stepCount(letterCount)) / letterCount);
}

// CSS Color 4 "shorter" hue interpolation, the same one color-mix(in oklch) uses.
function mixHue(startHue, endHue, amount) {
  if (Number.isNaN(startHue) && Number.isNaN(endHue)) return NaN;
  if (Number.isNaN(startHue)) return endHue;
  if (Number.isNaN(endHue)) return startHue;
  let from = startHue;
  let to = endHue;
  if (to - from > 180) from += 360;
  else if (to - from < -180) to += 360;
  return wrapHue(from + (to - from) * amount);
}

function shiftedHue(mixedHue, chroma, shift) {
  if (!Number.isNaN(mixedHue)) return wrapHue(mixedHue + shift);
  if (chroma < GREY_CHROMA) return NaN;
  // Relative color reads a missing hue as 0, so boost on two greys colors them at the shift angle.
  return wrapHue(shift);
}

// Hue Hop's own rule for a missing end: the set end's lightness and chroma, hue turned 50° away from yellow (95°).
export function autoPartnerOf(color) {
  const hue = Number.isNaN(color.hue) ? 0 : color.hue;
  const fromYellow = wrapHue(hue - 95 + 180) - 180;
  const direction = Math.min(Math.max(fromYellow * 1000 + 1, -1), 1);
  return {
    lightness: color.lightness,
    chroma: color.chroma,
    hue: wrapHue(hue + 50 * direction),
  };
}

// Port of src/formula.css: each step's color at rest (drift at 0).
export function letterColors(
  { start, end },
  stepTotal,
  { curve, boost, shift }
) {
  const colors = [];
  for (let step = 0; step < stepTotal; step++) {
    const progress = (step / Math.max(stepTotal - 1, 1)) ** curve;
    const chroma = Math.max(
      0,
      start.chroma +
        (end.chroma - start.chroma) * progress +
        boost * Math.sin(progress * Math.PI)
    );
    colors.push({
      lightness: start.lightness + (end.lightness - start.lightness) * progress,
      chroma,
      hue: shiftedHue(mixHue(start.hue, end.hue, progress), chroma, shift),
    });
  }
  return colors;
}

function toGamma(channel) {
  return channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function roundTo(value, digits) {
  return Number(value.toFixed(digits));
}

export function formatOklch({ lightness, chroma, hue }) {
  const hueText = Number.isNaN(hue) ? 'none' : roundTo(hue, 1);
  return `oklch(${roundTo(lightness * 100, 1)}% ${roundTo(chroma, 3)} ${hueText})`;
}

export function toHex(linear) {
  let hex = '#';
  for (const channel of linear) {
    hex += Math.round(toGamma(channel) * 255)
      .toString(16)
      .padStart(2, '0');
  }
  return hex;
}

function ratioOnPage(color, pageLuminance) {
  return contrastRatio(luminance(clipToScreen(color)), pageLuminance);
}

function chromaInGamut(lightness, hue, chroma) {
  const isInGamut = (candidate) =>
    oklchToLinearSrgb({ lightness, chroma: candidate, hue }).every(
      (channel) => channel >= -0.000001 && channel <= 1.000001
    );
  if (isInGamut(chroma)) return chroma;
  let low = 0;
  let high = chroma;
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2;
    if (isInGamut(middle)) low = middle;
    else high = middle;
  }
  return Math.floor(low * 1000) / 1000;
}

function withLightness(color, lightness, isChromaClamped) {
  const hue = Number.isNaN(color.hue) ? NaN : roundTo(color.hue, 1);
  const chroma = roundTo(color.chroma, 3);
  return {
    lightness: roundTo(lightness, 3),
    chroma: isChromaClamped ? chromaInGamut(lightness, hue, chroma) : chroma,
    hue,
  };
}

function clearsOnSide(color, pageLuminance, target, side) {
  if (ratioOnPage(color, pageLuminance) < target) return false;
  if (side === null) return true;
  const colorLuminance = luminance(clipToScreen(color));
  return side === 'darker'
    ? colorLuminance < pageLuminance
    : colorLuminance > pageLuminance;
}

function directionsToward(side) {
  if (side === 'darker') return [-1];
  if (side === 'lighter') return [1];
  return [-1, 1];
}

function lightnessThatClears(
  color,
  pageLuminance,
  target,
  { isChromaClamped = false, isAutoPartnerChecked = false, side = null } = {}
) {
  const from = Math.round(color.lightness * 1000);
  for (let offset = 1; offset <= 1000; offset++) {
    for (const direction of directionsToward(side)) {
      const step = from + direction * offset;
      if (step < 0 || step > 1000) continue;
      const candidate = withLightness(color, step / 1000, isChromaClamped);
      const isClear =
        clearsOnSide(candidate, pageLuminance, target, side) &&
        (!isAutoPartnerChecked ||
          clearsOnSide(autoPartnerOf(candidate), pageLuminance, target, side));
      if (isClear) return candidate;
    }
  }
  return null;
}

function weakestLetter(ends, pageLuminance, stepTotal, tuning) {
  let weakest = { ratio: Infinity, index: 0, color: null };
  const colors = letterColors(ends, stepTotal, tuning);
  for (const [index, color] of colors.entries()) {
    const ratio = ratioOnPage(color, pageLuminance);
    if (ratio < weakest.ratio) weakest = { ratio, index, color };
  }
  return weakest;
}

function unmovedEnd(color) {
  return { color, text: formatOklch(color), isMoved: false };
}

function movedEnd(color) {
  return { color, text: formatOklch(color), isMoved: true };
}

function autoEndFollowing(color) {
  return { color: autoPartnerOf(color), text: null, isMoved: false };
}

export function otherEndOf(which) {
  return which === 'start' ? 'end' : 'start';
}

// Boost and the hue path can dip a middle letter under the bar: push the end nearer it away from the page until every letter clears.
function settleEnds({
  ends,
  pageLuminance,
  bar,
  stepTotal,
  tuning,
  movableEnds,
  isChromaClamped = false,
  autoEnd = null,
  side = null,
}) {
  const settled = { ...ends };
  for (let attempt = 0; attempt <= FIT_STEP_LIMIT; attempt++) {
    const weakest = weakestLetter(
      { start: settled.start.color, end: settled.end.color },
      pageLuminance,
      stepTotal,
      tuning
    );
    if (weakest.ratio >= bar + FIT_MARGIN) return settled;
    if (attempt === FIT_STEP_LIMIT) break;

    const progress =
      (weakest.index / Math.max(stepTotal - 1, 1)) ** tuning.curve;
    const nearerEnd = progress < 0.5 ? 'start' : 'end';
    const endToMove = movableEnds.includes(nearerEnd)
      ? nearerEnd
      : movableEnds[0];
    const isPageLighter =
      pageLuminance > luminance(clipToScreen(weakest.color));
    const isNudgedDarker = side ? side === 'darker' : isPageLighter;
    const nudged =
      settled[endToMove].color.lightness +
      (isNudgedDarker ? -FIT_STEP : FIT_STEP);
    if (nudged < 0 || nudged > 1) break;
    const color = withLightness(
      settled[endToMove].color,
      nudged,
      isChromaClamped
    );
    settled[endToMove] = movedEnd(color);
    if (autoEnd) settled[autoEnd] = autoEndFollowing(color);
  }
  return null;
}

// Only the set end moves; the auto end shares its lightness, so it follows and stays auto.
function planFitAroundAutoEnd({
  ends,
  pageLuminance,
  bar,
  stepTotal,
  tuning,
  autoEnd,
  side,
}) {
  const setEnd = otherEndOf(autoEnd);
  const setColor = ends[setEnd];
  const isClear =
    clearsOnSide(setColor, pageLuminance, bar, side) &&
    clearsOnSide(autoPartnerOf(setColor), pageLuminance, bar, side);

  let fitted = unmovedEnd(setColor);
  if (!isClear) {
    const moved = lightnessThatClears(
      setColor,
      pageLuminance,
      bar + FIT_MARGIN,
      { isAutoPartnerChecked: true, side }
    );
    if (!moved) return null;
    fitted = movedEnd(moved);
  }
  return settleEnds({
    ends: { [setEnd]: fitted, [autoEnd]: autoEndFollowing(fitted.color) },
    pageLuminance,
    bar,
    stepTotal,
    tuning,
    movableEnds: [setEnd],
    autoEnd,
    side,
  });
}

function planFitForBothEnds({
  ends,
  pageLuminance,
  bar,
  stepTotal,
  tuning,
  side,
}) {
  const fitted = {};
  for (const which of ['start', 'end']) {
    const color = ends[which];
    if (clearsOnSide(color, pageLuminance, bar, side)) {
      fitted[which] = unmovedEnd(color);
      continue;
    }
    const moved = lightnessThatClears(color, pageLuminance, bar + FIT_MARGIN, {
      side,
    });
    if (!moved) return null;
    fitted[which] = movedEnd(moved);
  }
  return settleEnds({
    ends: fitted,
    pageLuminance,
    bar,
    stepTotal,
    tuning,
    movableEnds: ['start', 'end'],
    side,
  });
}

export function planFit({
  ends,
  pageLuminance,
  bar,
  letterTotal,
  tuning,
  autoEnd,
}) {
  const stepTotal = stepCount(letterTotal);
  const weakest = weakestLetter(ends, pageLuminance, stepTotal, tuning);
  if (weakest.ratio >= bar) {
    return {
      start:
        autoEnd === 'start'
          ? autoEndFollowing(ends.end)
          : unmovedEnd(ends.start),
      end:
        autoEnd === 'end' ? autoEndFollowing(ends.start) : unmovedEnd(ends.end),
    };
  }

  // Each end's nearest passing lightness can land on opposite sides of the page, and then the ramp crosses the page color. So retry with both ends on one side.
  for (const side of [null, 'darker', 'lighter']) {
    const attempt = { ends, pageLuminance, bar, stepTotal, tuning, side };
    const plan = autoEnd
      ? planFitAroundAutoEnd({ ...attempt, autoEnd })
      : planFitForBothEnds(attempt);
    if (plan) return plan;
  }
  return null;
}

function partnerOnSide({
  which,
  source,
  other,
  pageLuminance,
  bar,
  stepTotal,
  tuning,
  side,
}) {
  let partner = unmovedEnd(source);
  if (!clearsOnSide(source, pageLuminance, bar, side)) {
    const moved = lightnessThatClears(source, pageLuminance, bar + FIT_MARGIN, {
      isChromaClamped: true,
      side,
    });
    if (moved) partner = movedEnd(moved);
  }

  const otherEnd = otherEndOf(which);
  const settled = settleEnds({
    ends: {
      [which]: partner,
      [otherEnd]: other ? unmovedEnd(other) : autoEndFollowing(partner.color),
    },
    pageLuminance,
    bar,
    stepTotal,
    tuning,
    movableEnds: [which],
    isChromaClamped: true,
    autoEnd: other ? null : otherEnd,
    side,
  });
  return { partner, settled };
}

// A partner is best effort, never null: if settling fails on every attempt, it returns the first attempt's color from before settling and the verdict says Check.
export function solvePartner({
  which,
  source,
  other,
  pageLuminance,
  bar,
  letterTotal,
  tuning,
}) {
  const attempt = {
    which,
    source,
    other,
    pageLuminance,
    bar,
    stepTotal: stepCount(letterTotal),
    tuning,
  };
  const first = partnerOnSide({ ...attempt, side: null });
  if (first.settled) return first.settled[which];
  if (!other) return first.partner;

  const isOtherDarker = luminance(clipToScreen(other)) < pageLuminance;
  const retry = partnerOnSide({
    ...attempt,
    side: isOtherDarker ? 'darker' : 'lighter',
  });
  return retry.settled ? retry.settled[which] : first.partner;
}
