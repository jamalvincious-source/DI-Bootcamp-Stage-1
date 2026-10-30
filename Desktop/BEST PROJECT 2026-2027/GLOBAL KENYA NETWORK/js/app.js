"use strict";

/* =========================================================
   GLOBAL NETWORK KENYA
   Shared Frontend Application
   ========================================================= */

/* 1. CONFIGURATION */

const GNK_CONFIG = Object.freeze({
    API_BASE_URL: "http://localhost:3000/api",
    TOKEN_KEY: "gnk_token",
    USER_KEY: "gnk_user"
});

function setCookie(name, value, days = 30) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

function getCookie(name) {
    const cookieString = document.cookie || "";
    const match = cookieString
        .split(";")
        .map(entry => entry.trim())
        .find(entry => entry.startsWith(`${name}=`));

    if (!match) {
        return "";
    }

    return decodeURIComponent(match.split("=").slice(1).join("="));
}

function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

/* 2. API REQUEST HELPER */

async function apiRequest(endpoint, options = {}) {
    const token = getToken();

    const headers = {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const response = await fetch(
        `${GNK_CONFIG.API_BASE_URL}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    const contentType = response.headers.get("content-type") || "";

    const result = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message =
            typeof result === "object" && result !== null
                ? result.message || "The request could not be completed."
                : "The request could not be completed.";

        throw new Error(message);
    }

    return result;
}
/* 3. SESSION HELPERS */

function getToken() {
    return (
        sessionStorage.getItem(GNK_CONFIG.TOKEN_KEY) ||
        localStorage.getItem(GNK_CONFIG.TOKEN_KEY) ||
        getCookie(GNK_CONFIG.TOKEN_KEY)
    );
}

function getCurrentUser() {
    const storedUser =
        sessionStorage.getItem(GNK_CONFIG.USER_KEY) ||
        localStorage.getItem(GNK_CONFIG.USER_KEY) ||
        getCookie(GNK_CONFIG.USER_KEY);

    if (!storedUser) {
        return null;
    }

    try {
        return JSON.parse(storedUser);
    } catch (error) {
        console.error("Could not read the stored user:", error.message);
        return null;
    }
}

function isLoggedIn() {
    return Boolean(getToken());
}

function saveSession(token, user, remember = true) {
    if (!token || !user) {
        throw new Error("A valid token and user are required.");
    }

    sessionStorage.setItem(GNK_CONFIG.TOKEN_KEY, token);
    sessionStorage.setItem(GNK_CONFIG.USER_KEY, JSON.stringify(user));

    if (remember) {
        localStorage.setItem(GNK_CONFIG.TOKEN_KEY, token);
        localStorage.setItem(GNK_CONFIG.USER_KEY, JSON.stringify(user));
        setCookie(GNK_CONFIG.TOKEN_KEY, token, 30);
        setCookie(GNK_CONFIG.USER_KEY, JSON.stringify(user), 30);
    } else {
        localStorage.removeItem(GNK_CONFIG.TOKEN_KEY);
        localStorage.removeItem(GNK_CONFIG.USER_KEY);
        deleteCookie(GNK_CONFIG.TOKEN_KEY);
        deleteCookie(GNK_CONFIG.USER_KEY);
    }
}

function clearSession() {
    sessionStorage.removeItem(GNK_CONFIG.TOKEN_KEY);
    sessionStorage.removeItem(GNK_CONFIG.USER_KEY);
    localStorage.removeItem(GNK_CONFIG.TOKEN_KEY);
    localStorage.removeItem(GNK_CONFIG.USER_KEY);
    deleteCookie(GNK_CONFIG.TOKEN_KEY);
    deleteCookie(GNK_CONFIG.USER_KEY);
}

function requireLogin() {
    if (isLoggedIn()) {
        return true;
    }

    const currentPath =
        window.location.pathname + window.location.search;

    const isPagesDirectory = window.location.pathname.includes("/pages/");

    const loginPath = isPagesDirectory
        ? "login.html"
        : "pages/login.html";

    window.location.href =
        `${loginPath}?next=${encodeURIComponent(currentPath)}`;

    return false;
}

function logout() {
    clearSession();

    const isPagesDirectory = window.location.pathname.includes("/pages/");
    const loginPath = isPagesDirectory
        ? "login.html"
        : "pages/login.html";

    window.location.href = `${loginPath}?message=logged-out`;
}

/* 4. REFRESH CURRENT USER */

async function refreshCurrentUser() {
    if (!getToken()) {
        return null;
    }

    try {
        const result = await apiRequest("/auth/me");
        const user = result.user || result.data || result;

        if (user && user.id) {
            sessionStorage.setItem(
                GNK_CONFIG.USER_KEY,
                JSON.stringify(user)
            );

            updateNavigationForUser(user);
            return user;
        }

        return null;
    } catch (error) {
        console.error("Could not refresh the user:", error.message);

        if (
            /token|unauthori[sz]ed|forbidden|jwt|expired/i.test(
                error.message
            )
        ) {
            clearSession();
        }

        updateNavigationForUser(null);
        return null;
    }
}

/* 5. SAFE HTML AND URL HELPERS */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function safeExternalURL(value) {
    try {
        const url = new URL(String(value || ""), window.location.origin);

        if (url.protocol === "https:" || url.protocol === "http:") {
            return url.href;
        }

        return "";
    } catch {
        return "";
    }
}

/* 6. FORMATTING HELPERS */

function formatKES(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value)) {
        return "KES 0";
    }

    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 2
    }).format(value);
}

function formatDate(value) {
    if (!value) {
        return "Not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return new Intl.DateTimeFormat("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

/* 7. NOTIFICATION SYSTEM */

function showNotification(message, type = "info", duration = 4000) {
    let container = document.querySelector(".notification-container");

    if (!container) {
        container = document.createElement("div");
        container.className = "notification-container";
        container.setAttribute("aria-live", "polite");
        container.setAttribute("aria-atomic", "false");
        document.body.appendChild(container);
    }

    const notification = document.createElement("div");
    const allowedTypes = ["success", "error", "warning", "info"];
    const safeType = allowedTypes.includes(type) ? type : "info";

    notification.className =
        `notification notification-${safeType}`;

    notification.setAttribute(
        "role",
        safeType === "error" ? "alert" : "status"
    );

    // textContent prevents a message from being interpreted as HTML.
    notification.textContent = String(message ?? "");

    container.appendChild(notification);

    const timeout = Math.max(1000, Number(duration) || 4000);

    window.setTimeout(() => {
        notification.remove();

        if (container && container.childElementCount === 0) {
            container.remove();
        }
    }, timeout);
}

/* 8. MOBILE NAVIGATION */

function initialiseMobileNavigation() {
    const menuToggle = document.querySelector("#menuToggle");
    const navLinks = document.querySelector("#navLinks");

    if (!menuToggle || !navLinks) {
        return;
    }

    if (menuToggle.dataset.gnkNavigationReady === "true") {
        return;
    }

    menuToggle.dataset.gnkNavigationReady = "true";

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-controls", "navLinks");

    menuToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("open");

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Close navigation menu" : "Open navigation menu"
        );
    });

    navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
        });
    });

    document.addEventListener("click", event => {
        if (
            !navLinks.contains(event.target) &&
            !menuToggle.contains(event.target)
        ) {
            navLinks.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
        }
    });
}

/* 9. UPDATE NAVIGATION AFTER LOGIN */

function updateNavigationForUser(user = getCurrentUser()) {
    document.querySelectorAll('[data-auth-link="login"]')
        .forEach(element => {
            element.hidden = Boolean(user);
        });

    document.querySelectorAll('[data-auth-link="register"]')
        .forEach(element => {
            element.hidden = Boolean(user);
        });

    document.querySelectorAll('[data-auth-link="dashboard"]')
        .forEach(element => {
            element.hidden = !user;
        });

    document.querySelectorAll("[data-action='logout']")
        .forEach(element => {
            element.hidden = !user;
        });

    document.querySelectorAll("[data-user-name]")
        .forEach(element => {
            element.textContent = user?.name || "";
        });

    document.querySelectorAll("[data-user-email]")
        .forEach(element => {
            element.textContent = user?.email || "";
        });

    document.querySelectorAll("[data-user-role]")
        .forEach(element => {
            element.textContent = user?.role || "";
        });
}

/* 10. LOGOUT BUTTONS */

function initialiseLogoutButtons() {
    document.querySelectorAll("[data-action='logout']")
        .forEach(button => {
            if (button.dataset.gnkLogoutReady === "true") {
                return;
            }

            button.dataset.gnkLogoutReady = "true";

            button.addEventListener("click", event => {
                event.preventDefault();
                logout();
            });
        });
}

/* 11. FOOTER YEAR */

function updateCurrentYear() {
    const year = String(new Date().getFullYear());

    document.querySelectorAll("[data-current-year], #currentYear")
        .forEach(element => {
            element.textContent = year;
        });
}

/* 12. URL STATUS MESSAGES */

function handleURLMessages() {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message");

    const messages = {
        "logged-out": {
            text: "You have been logged out.",
            type: "success"
        },
        "registered": {
            text: "Your account has been created successfully.",
            type: "success"
        }
    };

    if (message && messages[message]) {
        showNotification(
            messages[message].text,
            messages[message].type
        );

        params.delete("message");

        const query = params.toString();
        const cleanURL =
            window.location.pathname +
            (query ? `?${query}` : "") +
            window.location.hash;

        window.history.replaceState({}, "", cleanURL);
    }
}

/* 13. INITIALISE SHARED FEATURES */

document.addEventListener("DOMContentLoaded", () => {
    initialiseMobileNavigation();
    initialiseLogoutButtons();
    updateCurrentYear();
    updateNavigationForUser();
    handleURLMessages();

    console.log("Global Network Kenya frontend initialised.");
});

/* 14. PUBLIC APPLICATION API */

window.GNK = Object.freeze({
    config: GNK_CONFIG,

    apiRequest,

    getToken,
    getCurrentUser,
    isLoggedIn,
    saveSession,
    clearSession,
    requireLogin,
    logout,
    refreshCurrentUser,

    escapeHTML,
    safeExternalURL,
    formatKES,
    formatDate,

    showNotification,
    updateNavigationForUser
});





