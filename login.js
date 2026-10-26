/**
 * SpendWise — Login & Entry Routing Module (login.js)
 * Handles session checks, credential verification with SHA-256 salt hashing,
 * show/hide password toggle, and post-registration/logout status alerts.
 */

const STORAGE_KEYS = {
  USERS: "spendwise_users",
  SESSION: "spendwise_session",
  THEME: "spendwise_theme"
};

document.addEventListener("DOMContentLoaded", () => {
  initTheme();

  // If this script is running on index.html (entry router), route immediately
  const isLoginFormPresent = document.getElementById("loginForm");
  const activeSession = getActiveSession();

  if (!isLoginFormPresent) {
    if (activeSession && activeSession.userId) {
      window.location.replace("./dashboard.html");
    } else {
      window.location.replace("./login.html");
    }
    return;
  }

  // If already logged in while visiting login.html, redirect to dashboard.html
  if (activeSession && activeSession.userId) {
    window.location.replace("./dashboard.html");
    return;
  }

  checkUrlNotifications();
  setupPasswordToggle();
  setupLoginForm();
});

function getActiveSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || "light";
  applyTheme(savedTheme);

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(STORAGE_KEYS.THEME, next);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const themeIcon = document.getElementById("themeIcon");
  const themeLabel = document.getElementById("themeLabel");
  if (themeIcon && themeLabel) {
    if (theme === "dark") {
      themeIcon.textContent = "☀️";
      themeLabel.textContent = "Light Mode";
    } else {
      themeIcon.textContent = "🌙";
      themeLabel.textContent = "Dark Mode";
    }
  }
}

/**
 * Displays friendly banners when redirected from registration, logout, or auth guard
 */
function checkUrlNotifications() {
  const params = new URLSearchParams(window.location.search);
  const emailInput = document.getElementById("loginEmail");

  const prefillEmail = sessionStorage.getItem("spendwise_registered_email");
  if (prefillEmail && emailInput) {
    emailInput.value = prefillEmail;
    sessionStorage.removeItem("spendwise_registered_email");
  }

  if (params.get("registered") === "1") {
    showAlert("Account created successfully! Please log in with your credentials.", "success");
  } else if (params.get("logout") === "1") {
    showAlert("You have been safely logged out.", "success");
  } else if (params.get("auth") === "required") {
    showAlert("Please log in to access your SpendWise dashboard.", "error");
  }
}

function setupPasswordToggle() {
  const passwordInput = document.getElementById("loginPassword");
  const toggleBtn = document.getElementById("toggleLoginPasswordBtn");
  if (!passwordInput || !toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleBtn.textContent = isPassword ? "Hide" : "Show";
    toggleBtn.setAttribute("aria-pressed", String(isPassword));
    toggleBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });
}

async function hashPasswordWithSalt(password, salt) {
  const combined = `${salt}:${password}`;
  if (window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }
  return `fallback_${(hash >>> 0).toString(16)}`;
}

function setupLoginForm() {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const submitBtn = document.getElementById("loginSubmitBtn");

  [emailInput, passwordInput].forEach((input) => {
    input.addEventListener("input", () => {
      clearFieldError(input.id);
      hideAlert();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    let isValid = true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!email) {
      setFieldError("loginEmail", "Please enter your email address.");
      isValid = false;
    } else if (!emailRegex.test(email)) {
      setFieldError("loginEmail", "Please enter a valid email address.");
      isValid = false;
    }

    if (!password) {
      setFieldError("loginPassword", "Please enter your password.");
      isValid = false;
    }

    if (!isValid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Verifying...";

    try {
      const users = getRegisteredUsers();
      const matchedUser = users.find((u) => u.email.toLowerCase() === email);

      if (!matchedUser) {
        showAlert("Invalid email or password. Please check your credentials or create an account.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Log In to SpendWise";
        return;
      }

      const computedHash = await hashPasswordWithSalt(password, matchedUser.salt);
      if (computedHash !== matchedUser.passwordHash) {
        showAlert("Invalid email or password. Please try again.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Log In to SpendWise";
        return;
      }

      // Create active session record
      const sessionPayload = {
        userId: matchedUser.id,
        fullName: matchedUser.fullName,
        email: matchedUser.email,
        loginAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionPayload));

      showAlert(`Welcome back, ${matchedUser.fullName}! Redirecting to your dashboard...`, "success");

      setTimeout(() => {
        window.location.href = "./dashboard.html";
      }, 600);
    } catch (err) {
      console.error("Login error:", err);
      showAlert("An error occurred while signing in. Please try again.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Log In to SpendWise";
    }
  });
}

function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}Error`);
  if (input) input.classList.add("input-invalid");
  if (errorEl) errorEl.textContent = message;
}

function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}Error`);
  if (input) input.classList.remove("input-invalid");
  if (errorEl) errorEl.textContent = "";
}

function showAlert(message, type) {
  const alertBox = document.getElementById("loginAlert");
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.className = `alert-box ${type}`;
}

function hideAlert() {
  const alertBox = document.getElementById("loginAlert");
  if (!alertBox) return;
  alertBox.textContent = "";
  alertBox.className = "alert-box hidden";
}