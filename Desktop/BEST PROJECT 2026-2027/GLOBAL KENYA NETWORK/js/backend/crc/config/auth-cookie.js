"use strict";

const AUTH_COOKIE_NAME = "gnk_session";
const SESSION_SECONDS = 2 * 60 * 60;
const REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60;

function sessionLifetime(rememberMe) {
    return rememberMe ? "30d" : "2h";
}

function authCookieOptions(rememberMe = false) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api",
        ...(rememberMe ? { maxAge: REMEMBERED_SESSION_SECONDS * 1000 } : {})
    };
}

function setAuthCookie(res, token, rememberMe = false) {
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions(rememberMe));
}

function clearAuthCookie(res) {
    res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
}

function getAuthToken(req) {
    const authorization = req.headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
        const bearerToken = authorization.slice(7).trim();
        if (bearerToken) return bearerToken;
    }

    const cookieHeader = req.headers.cookie || "";
    const entry = cookieHeader.split(";").map(value => value.trim())
        .find(value => value.startsWith(`${AUTH_COOKIE_NAME}=`));
    if (!entry) return "";

    try {
        return decodeURIComponent(entry.slice(AUTH_COOKIE_NAME.length + 1));
    } catch {
        return "";
    }
}

module.exports = {
    AUTH_COOKIE_NAME,
    REMEMBERED_SESSION_SECONDS,
    SESSION_SECONDS,
    authCookieOptions,
    clearAuthCookie,
    getAuthToken,
    sessionLifetime,
    setAuthCookie
};
