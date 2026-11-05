"use strict";

const GNK_CONFIG = Object.freeze({
  API_BASE_URL: (window.GNK_API_BASE_URL || "http://localhost:3000/api").replace(/\/+$/, ""),
  USER_KEY: "gnk_user",
  TOKEN_KEY: "gnk_token"
});

function getToken() {
  return sessionStorage.getItem(GNK_CONFIG.TOKEN_KEY) ||
    localStorage.getItem(GNK_CONFIG.TOKEN_KEY) ||
    "";
}

function getCurrentUser() {
  const stored = sessionStorage.getItem(GNK_CONFIG.USER_KEY) ||
    localStorage.getItem(GNK_CONFIG.USER_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("Could not read the saved account profile:", error);
    clearSession();
    return null;
  }
}

async function apiRequest(endpoint, options = {}) {
  if (typeof endpoint !== "string" || !endpoint.startsWith("/") || endpoint.startsWith("//")) {
    throw new TypeError("API requests must use a path beginning with a single slash.");
  }

  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${GNK_CONFIG.API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include"
    });
  } catch (error) {
    throw new Error(
      "Unable to reach the Global Network Kenya server. Check that the backend is running.",
      { cause: error }
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const responseBody = await response.text();
  let result = responseBody;
  if (contentType.includes("application/json") && responseBody) {
    try {
      result = JSON.parse(responseBody);
    } catch (error) {
      const parseError = new Error("The server returned an invalid JSON response.", { cause: error });
      parseError.status = response.status;
      throw parseError;
    }
  } else if (contentType.includes("application/json")) {
    result = null;
  }

  if (!response.ok) {
    const error = new Error(
      typeof result === "object" && result !== null
        ? result.message || "The request could not be completed."
        : "The request could not be completed."
    );
    error.status = response.status;
    throw error;
  }
  return result;
}

function saveSession(user, remember = false) {
  if (!user || typeof user !== "object") {
    throw new Error("A valid account profile is required.");
  }

  const serializedUser = JSON.stringify(user);
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(GNK_CONFIG.USER_KEY, serializedUser);
}

function clearSession() {
  for (const storage of [sessionStorage, localStorage]) {
    storage.removeItem(GNK_CONFIG.TOKEN_KEY);
    storage.removeItem(GNK_CONFIG.USER_KEY);
  }
  for (const key of [GNK_CONFIG.TOKEN_KEY, GNK_CONFIG.USER_KEY]) {
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  }
}

async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
    clearSession();
    window.location.assign(window.location.pathname.includes("/pages/")
      ? "../index.html"
      : "index.html");
  } catch (error) {
    console.error("Could not end the current session:", error);
    window.alert("Unable to log out. Please check your connection and try again.");
  }
}

function requireLogin() {
  if (getCurrentUser()) return true;
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.assign(window.location.pathname.includes("/pages/")
    ? `login.html?next=${next}`
    : `pages/login.html?next=${next}`);
  return false;
}

window.GNK = Object.freeze({
  config: GNK_CONFIG,
  apiRequest,
  getToken,
  getCurrentUser,
  saveSession,
  clearSession,
  logout,
  requireLogin
});

document.addEventListener("DOMContentLoaded", () => {
  const isLoggedIn = Boolean(getCurrentUser());
  document.querySelectorAll('[data-auth-link="login"], [data-auth-link="register"]')
    .forEach(link => { link.hidden = isLoggedIn; });
  document.querySelectorAll('[data-auth-link="dashboard"]')
    .forEach(link => { link.hidden = !isLoggedIn; });
  document.querySelectorAll('[data-action="logout"], #logoutBtn')
    .forEach(button => {
      button.hidden = !isLoggedIn;
      button.addEventListener("click", logout);
    });
});
