"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const helperPath = path.join(__dirname, "..", "js", "app.js");
const helperSource = fs.readFileSync(helperPath, "utf8");

function createBrowser(fetchImplementation) {
    const storage = new Map();
    const localStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: key => storage.delete(key)
    };
    const document = {
        cookie: "",
        addEventListener() {},
        querySelectorAll() { return []; }
    };
    const window = {
        GNK_API_BASE_URL: "https://api.example.test/api/",
        location: { protocol: "https:", pathname: "/index.html", search: "" },
        locationObject: null,
        fetch: fetchImplementation
    };
    const context = {
        window,
        document,
        localStorage,
        sessionStorage: localStorage,
        Headers,
        FormData,
        fetch: fetchImplementation,
        URL,
        URLSearchParams,
        Date,
        JSON,
        console
    };

    vm.runInNewContext(helperSource, context, { filename: helperPath });
    return { gnk: window.GNK, storage };
}

test("apiRequest normalizes the API URL and keeps legacy bearer-token support", async () => {
    let request;
    const { gnk, storage } = createBrowser(async (url, options) => {
        request = { url, options };
        return new Response(JSON.stringify({ success: true }), {
            headers: { "content-type": "application/json" }
        });
    });
    storage.set("gnk_token", "test-token");

    const result = await gnk.apiRequest("/auth/me");

    assert.equal(result.success, true);
    assert.equal(request.url, "https://api.example.test/api/auth/me");
    assert.equal(request.options.headers.get("Authorization"), "Bearer test-token");
    assert.equal(request.options.credentials, "include");
});

test("apiRequest uses cookies for new sessions without storing an auth token", async () => {
    let request;
    const { gnk, storage } = createBrowser(async (url, options) => {
        request = { url, options };
        return new Response(JSON.stringify({ success: true }), {
            headers: { "content-type": "application/json" }
        });
    });
    gnk.saveSession({ id: 7, name: "Jane Doe" }, true);

    await gnk.apiRequest("/auth/me");

    assert.equal(request.options.credentials, "include");
    assert.equal(request.options.headers.has("Authorization"), false);
    assert.deepEqual(gnk.getCurrentUser(), { id: 7, name: "Jane Doe" });
    assert.equal(storage.has("gnk_token"), false);
});

test("apiRequest rejects non-path endpoints before making a request", async () => {
    let requested = false;
    const { gnk } = createBrowser(async () => {
        requested = true;
        return new Response("{}");
    });

    await assert.rejects(gnk.apiRequest("https://example.test/"), /API requests must use a path/);
    assert.equal(requested, false);
});

test("apiRequest reports invalid JSON responses with the HTTP status", async () => {
    const { gnk } = createBrowser(async () => new Response("<html>", {
        status: 502,
        headers: { "content-type": "application/json" }
    }));

    await assert.rejects(gnk.apiRequest("/health"), error =>
        error.message === "The server returned an invalid JSON response." &&
        error.status === 502
    );
});
