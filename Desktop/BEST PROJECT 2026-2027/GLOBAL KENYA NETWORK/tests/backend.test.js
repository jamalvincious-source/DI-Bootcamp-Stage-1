"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test?schema=public";
}

const app = require("../js/backend/crc/app");

test("Express mounts the Prisma-backed API routes used by the frontend", async () => {
    const server = app.listen(0, "127.0.0.1");

    try {
        await new Promise((resolve, reject) => {
            server.once("listening", resolve);
            server.once("error", reject);
        });

        const address = server.address();
        assert.ok(address && typeof address !== "string");
        const baseUrl = `http://127.0.0.1:${address.port}/api`;

        const cases = [
            { path: "/auth/register", method: "POST", body: {}, status: 400 },
            { path: "/auth/logout", method: "POST", status: 200 },
            { path: "/businesses?page=0", status: 400 },
            { path: "/adverts?placement=invalid", status: 400 },
            { path: `/adverts?category=${"x".repeat(101)}`, status: 400 },
            { path: "/listings?sort=invalid", status: 400 },
            { path: "/packages/not-a-number", status: 400 },
            { path: "/payments/mine", status: 401 },
            { path: "/admin/overview", status: 401 }
        ];

        for (const route of cases) {
            const response = await fetch(`${baseUrl}${route.path}`, {
                method: route.method || "GET",
                ...(route.body ? {
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(route.body)
                } : {})
            });
            assert.equal(response.status, route.status, `${route.method || "GET"} ${route.path}`);
            if (route.path === "/auth/logout") {
                assert.match(response.headers.get("set-cookie") || "", /gnk_session=;/);
            }
        }
    } finally {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }
});
