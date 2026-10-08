import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Loads runtime secrets from `functions/runtime-env.json` at cold start.
 *
 * WHY NOT A `.env` FILE
 * ---------------------
 * firebase-functions can load `.env` files, but the Firebase CLI honours
 * `.gitignore` when packaging a deployment — and `.gitignore` has `.env*` to keep
 * secrets out of git. So the `.env` is excluded from the upload, `dotenv` has
 * nothing to load, and every send silently no-ops with
 * "RESEND_API_KEY is not set". Installing `dotenv` does not help; the file never
 * reaches the artifact.
 *
 * `runtime-env.json` sits outside that pattern and is explicitly gitignored by
 * name instead, so it ships in the (private) deployment artifact without ever
 * entering git. Real environment variables always win, so this is a fallback for
 * deployments that have no platform-level secret configured.
 *
 * The longer-term fix is Secret Manager via `defineSecret`, which needs
 * `secretmanager.googleapis.com` enabled on the project.
 */

type RuntimeEnv = Record<string, string>;

function load(): RuntimeEnv | null {
  try {
    const path = join(__dirname, '..', 'runtime-env.json');
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as RuntimeEnv;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    // A malformed or unreadable file must not stop the function from booting.
    return null;
  }
}

const fileEnv = load() ?? {};

for (const [key, value] of Object.entries(fileEnv)) {
  // Never override a real env var — platform configuration wins.
  if (process.env[key] === undefined && typeof value === 'string') {
    process.env[key] = value;
  }
}

export const hasResendKey = (): boolean => Boolean(process.env.RESEND_API_KEY);