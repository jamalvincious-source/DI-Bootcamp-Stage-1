"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");
const loginHtml = fs.readFileSync(path.join(projectRoot, "pages", "login.html"), "utf8");
const dashboardHtml = fs.readFileSync(path.join(projectRoot, "dashboard.html"), "utf8");

test("login page links to separate password-free role previews", () => {
    assert.match(loginHtml, /href="\.\.\/dashboard\.html\?demo=user"/);
    assert.match(loginHtml, /href="\.\.\/dashboard\.html\?demo=advertiser"/);
    assert.match(loginHtml, /href="\.\.\/dashboard\.html\?demo=super-admin"/);
    assert.match(loginHtml, /Sign in as Demo User/);
    assert.match(loginHtml, /Sign in as Demo Advertiser/);
    assert.match(loginHtml, /without a password/i);
    assert.match(loginHtml, /Changes do not affect real accounts or adverts/i);
    assert.match(loginHtml, /No real admin access/i);
    assert.doesNotMatch(loginHtml, /data-login-mode="demo/);
});

test("dashboard only opens the sample preview modes without loading an account", () => {
    assert.match(dashboardHtml, /function renderUserDemo\(\)/);
    assert.match(dashboardHtml, /simulated sample user account/);
    const userDemoStart = dashboardHtml.indexOf("function renderUserDemo()");
    const advertiserDemoStart = dashboardHtml.indexOf("function renderAdvertiserDemo()");
    assert.ok(userDemoStart >= 0 && advertiserDemoStart > userDemoStart, "both demo renderers should exist");
    const userDemo = dashboardHtml.slice(userDemoStart, advertiserDemoStart);
    assert.doesNotMatch(userDemo, /user-rioba-feature|user-rioba-gallery|rioba-grocery-proud/);
    assert.match(dashboardHtml, /function renderAdvertiserDemo\(\)/);
    assert.match(dashboardHtml, /Advertiser Dashboard \(Demo\)/);
    assert.match(dashboardHtml, /DEMO · ADVERTISER/);
    assert.match(dashboardHtml, /Businesses shining with RIOBA/);
    assert.match(dashboardHtml, /assets\/rioba-business-tower\.svg/);
    assert.match(dashboardHtml, /assets\/rioba-retail-growth\.svg/);
    assert.match(dashboardHtml, /assets\/rioba-innovation-hub\.svg/);
    assert.match(dashboardHtml, /not real customer testimonials/);
    assert.match(dashboardHtml, /Business profile/);
    assert.match(dashboardHtml, /Campaign performance/);
    assert.match(dashboardHtml, /Payments and billing/);
    assert.match(dashboardHtml, /Ad packages/);
    assert.match(dashboardHtml, /id="demoCreateCampaign"/);
    assert.match(dashboardHtml, /id="demoCampaignForm"/);
    assert.match(dashboardHtml, /status: "Draft"/);
    assert.match(dashboardHtml, /No real advert or account was changed/);
    assert.match(dashboardHtml, /Discover adverts/);
    assert.match(dashboardHtml, /View advert/);
    assert.match(dashboardHtml, /function renderSuperAdminDemo\(\)/);
    assert.match(dashboardHtml, /\["super-admin", "user", "advertiser"\]\.includes\(demoMode\)/);
    assert.match(dashboardHtml, /renderUserDemo\(\)/);
    assert.match(dashboardHtml, /renderAdvertiserDemo\(\)/);
    assert.match(dashboardHtml, /renderSuperAdminDemo\(\)/);
});

test("authenticated dashboard loads published adverts and allows only safe external links", () => {
    assert.match(dashboardHtml, /window\.GNK\.apiRequest\("\/adverts"\)/);
    assert.match(dashboardHtml, /window\.GNK\.apiRequest\("\/adverts\?category=Real%20Estate"\)/);
    assert.match(dashboardHtml, /publishedAdvertResponse\.adverts\.map\(advert => renderAdvertCard\(advert\)\)/);
    assert.match(dashboardHtml, /houseAdvertResponse\.adverts\.map\(renderHouseAdvertCard\)/);
    assert.match(dashboardHtml, /function renderHouseAdvertCard\(advert\)/);
    assert.match(dashboardHtml, /href="tel:0118237749"/);
    assert.match(dashboardHtml, /0118 237749/);
    assert.match(dashboardHtml, /window\.GNK\.apiRequest\("\/adverts\/mine"\)/);
    assert.match(dashboardHtml, /function safeExternalUrl\(value\)/);
    assert.match(dashboardHtml, /\["http:", "https:"\]\.includes\(url\.protocol\)/);
    assert.match(dashboardHtml, /target="_blank" rel="noopener noreferrer">View advert/);
    assert.match(dashboardHtml, /async function loadAuthenticatedUser\(\) \{\s*let result;/);
    assert.doesNotMatch(dashboardHtml, /GNK\.getToken\(\)/);
});
