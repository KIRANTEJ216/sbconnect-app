/**
 * Regression guard for the profile-editing cross-contamination bug.
 *
 * The bug: `Profile.tsx` loaded the profile named by the route (`/profile/:id`)
 * into the form but saved with `user.uid` — the session user. An admin editing
 * any profile therefore overwrote their *own* profile document with that
 * person's details, and uploaded the replacement photo into their own Storage
 * folder.
 *
 * This asserts the structural invariant (write target derived from the loaded
 * profile, never the session) rather than trying to render the component.
 *
 * Run: node tests/profile-target.test.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = readFileSync(join(root, 'src', 'pages', 'Profile.tsx'), 'utf8');

let pass = 0;
const t = (name, fn) => {
  try { fn(); console.log(`PASS  ${name}`); pass++; }
  catch (e) { console.log(`FAIL  ${name}  -> ${e.message}`); process.exitCode = 1; }
};

// Every one of these must be addressed by the loaded profile / route id.
const FORBIDDEN = [
  'updateBusinessProfile(user.uid',
  'replaceProfilePhoto(user.uid',
  'uploadCatalogFiles(user.uid',
];

for (const call of FORBIDDEN) {
  t(`no \`${call}\` in Profile.tsx`, () => {
    assert.ok(!src.includes(call), `found "${call}" — writes would target the session user`);
  });
}

t('the write target is derived from the loaded profile', () => {
  assert.match(
    src,
    /const targetUid = profile\?\.uid \|\| id \|\| '';/,
    'targetUid must come from the loaded profile (or the route id), never the session user',
  );
});

t('handleSave refuses to write to the session user while viewing someone else', () => {
  assert.ok(
    src.includes('Refusing to save: this would overwrite your own profile.'),
    'missing the cross-contamination guard in handleSave',
  );
  assert.ok(
    src.includes('Refusing to save: this would overwrite your own profile.'),
    'missing the cross-contamination guard in handleSaveMembership',
  );
});

t('handleSave rejects a mismatched target instead of writing blindly', () => {
  assert.ok(
    src.includes('Could not verify which profile to save'),
    'missing target/loaded-profile mismatch guard',
  );
});

t('photo and catalog uploads use the target uid', () => {
  assert.ok(src.includes('replaceProfilePhoto(targetUid,'), 'photo must upload under the target uid');
  assert.ok(src.includes('uploadCatalogFiles(targetUid,'), 'catalog must upload under the target uid');
});

t('profile cache invalidation uses the target uid', () => {
  const invalidations = [...src.matchAll(
    /invalidateQueries\(\{\s*queryKey:\s*\['businessProfile',\s*([^\]\s]+)\s*\]\s*\}\)/g,
  )].map((m) => m[1].trim());
  assert.ok(invalidations.length > 0, 'expected at least one businessProfile invalidation');
  for (const arg of invalidations) {
    assert.strictEqual(arg, 'targetUid', `invalidation still uses "${arg}"`);
  }
});

t('the route id drives the load, so targetUid and the form agree', () => {
  assert.match(src, /getBusinessProfile\(id\)/, 'profile must be loaded from the route id');
});

console.log(`\n${pass} passed`);