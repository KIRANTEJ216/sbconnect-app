import { byCompanyName } from './format';
import type { BusinessProfile } from '../types';

/**
 * Business-directory search.
 *
 * Extracted from the page so the rules are unit-testable instead of only
 * observable through the UI (see tests/directory-search.test.mjs).
 */

/** Split a raw query into lowercase tokens, ignoring extra whitespace. */
export function searchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.\-&\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Normalise one list-ish field into words.
 *
 * `keywords` and `categories` are typed `string[]`, but older records were
 * imported from CSV with them as a single comma-separated string. Spreading a
 * bare string would explode it into single characters, which silently broke
 * keyword search for exactly those records — so both shapes are handled.
 */
function toWords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((v) => toWords(v));
  }
  if (typeof value === 'string') {
    // Split on commas/semicolons/pipes, then on whitespace.
    return value
      .split(/[,;|]/)
      .flatMap((chunk) => chunk.split(/\s+/))
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

/** Every searchable word for one profile, de-duplicated. */
function profileWords(p: BusinessProfile): Set<string> {
  const words = new Set<string>();
  const add = (v: unknown) => {
    for (const w of toWords(v)) words.add(w);
  };

  add(p.companyName);
  add(p.ownerName);
  add(p.ownerSurname);
  add(p.location);
  add(p.description);
  add(p.keywords);
  add(p.categories);

  // Whole phrases matter too: "blue wave" should find "Blue Wave Interiors",
  // even though no single word is "blue wave".
  for (const field of [p.companyName, p.location, p.description]) {
    if (typeof field === 'string' && field.trim()) {
      words.add(field.trim().toLowerCase());
    }
  }
  return words;
}

/**
 * A token matches a profile when the profile contains it as a whole word, or as
 * the leading substring of a word. Prefix matching is what makes typing "solar"
 * find a member whose only keyword is "solarpanels" while still rejecting
 * "solar" for a member tagged only "console".
 */
function wordMatches(words: Set<string>, token: string): boolean {
  // Lowercased defensively: profileWords() already normalises its side, but this
  // function is reachable from an exported API and a capitalised token should
  // not silently match nothing.
  const needle = token.toLowerCase();
  if (words.has(needle)) return true;
  for (const w of words) {
    if (w.startsWith(needle)) return true;
  }
  return false;
}

/** True when every query token matches somewhere in the profile. */
export function matchesSearch(profile: BusinessProfile, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const words = profileWords(profile);
  // Tokens are ANDed: extra words narrow the result set, never widen it.
  return tokens.every((t) => wordMatches(words, t));
}

/** Apply a query to a list of profiles, keeping the directory in A-Z order. */
export function filterProfiles(profiles: BusinessProfile[], query: string): BusinessProfile[] {
  const tokens = searchTokens(query);
  const matched =
    tokens.length === 0 ? profiles : profiles.filter((p) => matchesSearch(p, tokens));
  return [...matched].sort(byCompanyName);
}