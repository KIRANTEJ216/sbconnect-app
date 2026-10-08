"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasResendKey = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
function load() {
    try {
        const path = (0, path_1.join)(__dirname, '..', 'runtime-env.json');
        if (!(0, fs_1.existsSync)(path))
            return null;
        const parsed = JSON.parse((0, fs_1.readFileSync)(path, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : null;
    }
    catch {
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
const hasResendKey = () => Boolean(process.env.RESEND_API_KEY);
exports.hasResendKey = hasResendKey;
//# sourceMappingURL=runtimeEnv.js.map