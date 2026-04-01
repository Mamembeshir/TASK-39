#!/bin/sh

node -e '
const { validatePasswordLength } = require("./backend/src/validators");
const tooShort = validatePasswordLength("short-pass");
const good = validatePasswordLength("long-enough-password");
const ok = tooShort.ok === false && tooShort.code === "PASSWORD_TOO_SHORT" && good.ok === true;
process.exit(ok ? 0 : 1);
'
