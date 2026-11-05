"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputDirectory = path.join(projectRoot, "dist");
const apiHost = process.env.API_HOST;

if (!apiHost || !/^[a-z0-9.-]+$/i.test(apiHost)) {
    throw new Error("Set API_HOST to the Render API service hostname before building the frontend.");
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

for (const file of ["index.html", "business.html", "dashboard.html", "style.css"]) {
    fs.copyFileSync(path.join(projectRoot, file), path.join(outputDirectory, file));
}

for (const directory of ["assets", "pages"]) {
    fs.cpSync(
        path.join(projectRoot, directory),
        path.join(outputDirectory, directory),
        { recursive: true }
    );
}

const frontendScriptDirectory = path.join(outputDirectory, "js");
fs.mkdirSync(frontendScriptDirectory, { recursive: true });
fs.copyFileSync(
    path.join(projectRoot, "js", "app.js"),
    path.join(frontendScriptDirectory, "app.js")
);

const htmlFiles = [
    "index.html",
    "business.html",
    "dashboard.html",
    ...fs.readdirSync(path.join(outputDirectory, "pages"))
        .filter((file) => file.endsWith(".html"))
        .map((file) => path.join("pages", file))
];

const appScriptPattern = /(<script\b[^>]*\bsrc=["'](?:\.\.\/)?js\/app\.js["'][^>]*>)/gi;
const runtimeConfigTag = '<script src="/runtime-config.js"></script>\n    ';

for (const relativePath of htmlFiles) {
    const htmlPath = path.join(outputDirectory, relativePath);
    const html = fs.readFileSync(htmlPath, "utf8");
    const configuredHtml = html.replace(appScriptPattern, `${runtimeConfigTag}$1`);
    fs.writeFileSync(htmlPath, configuredHtml);
}

const apiBaseUrl = `https://${apiHost}/api`;
fs.writeFileSync(
    path.join(outputDirectory, "runtime-config.js"),
    `window.GNK_API_BASE_URL = ${JSON.stringify(apiBaseUrl)};\n`
);
