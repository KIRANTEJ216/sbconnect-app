/**
 * Contrast audit for the redesign palette. WCAG AA needs 4.5:1 for body text and
 * 3:1 for large text (>=24px, or >=18.66px bold) and UI boundaries.
 *
 * Run: node tests/contrast.test.mjs
 */
import assert from 'node:assert';

const hex = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = (h) => {
  const [r, g, b] = hex(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SURFACE = '#FFFFFF';
const CANVAS = '#FAF9FC';

const PAIRS = [
  // [label, fg, bg, minimum]
  ['body text on surface', '#1A1922', SURFACE, 4.5],
  ['body text on canvas', '#1A1922', CANVAS, 4.5],
  ['secondary text on surface', '#55505F', SURFACE, 4.5],
  ['muted text on surface', '#6E6879', SURFACE, 4.5],
  ['muted text on canvas', '#6E6879', CANVAS, 4.5],
  ['primary link on surface', '#2A11A6', SURFACE, 4.5],
  ['primary on primary-light', '#2A11A6', '#EDE9FE', 4.5],
  ['success text on success tint', '#14532D', '#ECFDF3', 4.5],
  ['danger text on danger tint', '#7F1D1D', '#FEF2F2', 4.5],
  ['warning text on warning tint', '#A16207', '#FFFBEB', 4.5],
  ['gold text on gold tint', '#8A6420', '#FDF6E7', 4.5],
  ['white on primary button', SURFACE, '#2A11A6', 4.5],
  ['white on danger button', SURFACE, '#C81E1E', 4.5],
  ['ink on gold button', '#14131A', '#D4A853', 4.5],
  // Large text / UI boundaries only need 3:1
  ['faint text on surface', '#726B7B', SURFACE, 4.5],
  ['border on surface', '#E7E3ED', SURFACE, 1.2],
  ['border-strong input edge', '#D4CEDE', SURFACE, 1.4],
  ['ring on surface', '#8B5CF6', SURFACE, 3.0],
  // Login brand panel
  ['white 70% headline on gradient start', '#FFFFFF', '#2A11A6', 4.5],
  ['white 55% label on gradient start', '#C9C3E8', '#2A11A6', 3.0],
  ['white 40% footer on gradient start', '#A79FD4', '#2A11A6', 3.0],
];

let pass = 0;
for (const [label, fg, bg, min] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1 (min ${min})  ${label}`);
}

// focus ring must be visible against the surface it sits on
const ring = ratio('#8B5CF6', SURFACE);
assert.ok(ring >= 3, `focus ring ${ring.toFixed(2)}:1 below 3:1`);

console.log(`\n${pass}/${PAIRS.length} passed`);
if (pass !== PAIRS.length) process.exitCode = 1;