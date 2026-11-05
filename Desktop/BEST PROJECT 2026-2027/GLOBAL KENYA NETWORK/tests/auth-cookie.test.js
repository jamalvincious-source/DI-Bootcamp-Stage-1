"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    AUTH_COOKIE_NAME,
    REMEMBERED_SESSION_SECONDS,
    authCookieOptions,
    clearAuthCookie,
    getAuthToken,
    sessionLifetime,
    setAuthCookie
} = require("../js/backend/crc/config/auth-cookie");

test("auth cookies are HttpOnly, same-site, API-scoped, and persistent only when requested", () => {
    const sessionOptions = authCookieOptions();
    assert.equal(sessionOptions.httpOnly, true);
    assert.equal(sessionOptions.sameSite, "lax");
    assert.equal(sessionOptions.path, "/api");
    assert.equal("maxAge" in sessionOptions, false);

    const rememberedOptions = authCookieOptions(true);
    assert.equal(rememberedOptions.maxAge, REMEMBERED_SESSION_SECONDS * 1000);
    assert.equal(sessionLifetime(false), "2h");
    assert.equal(sessionLifetime(true), "30d");
});

test("auth cookie helpers set and clear the same cookie path and security options", () => {
    let set;
    let cleared;
    setAuthCookie({
        cookie(name, value, options) {
            set = { name, value, options };
        }
    }, "signed-token", true);
    clearAuthCookie({
        clearCookie(name, options) {
            cleared = { name, options };
        }
    });

    assert.equal(set.name, AUTH_COOKIE_NAME);
    assert.equal(set.value, "signed-token");
    assert.equal(set.options.httpOnly, true);
    assert.equal(set.options.maxAge, REMEMBERED_SESSION_SECONDS * 1000);
    assert.equal(cleared.name, AUTH_COOKIE_NAME);
    assert.equal(cleared.options.path, set.options.path);
});

test("authentication accepts the HttpOnly cookie and legacy bearer tokens", () => {
    assert.equal(
        getAuthToken({ headers: { cookie: `${AUTH_COOKIE_NAME}=cookie-token` } }),
        "cookie-token"
    );
    assert.equal(
        getAuthToken({ headers: { cookie: `${AUTH_COOKIE_NAME}=cookie%2Dtoken` } }),
        "cookie-token"
    );
    assert.equal(
        getAuthToken({
            headers: {
                authorization: "Bearer legacy-token",
                cookie: `${AUTH_COOKIE_NAME}=cookie-token`
            }
        }),
        "legacy-token"
    );
    assert.equal(getAuthToken({ headers: { cookie: "other=value" } }), "");
});
