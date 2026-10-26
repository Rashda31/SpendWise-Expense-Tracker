/**
 * SpendWise — Registration Module (register.js)
 * Handles user registration, field validation, duplicate email protection,
 * client-side SHA-256 password hashing, and theme persistence.
 */

const STORAGE_KEYS = {
  USERS: "spendwise_users",
  SESSION: "spendwise_session",
  THEME: "spendwise_theme"
};

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  redirectIfAlreadyLoggedIn();
  setupPasswordToggles();
  setupRegistrationForm();
});

/**
 * Redirects to dashboard.html if an active session already exists
 */
function redirectIfAlreadyLoggedIn() {
  const activeSession = getActiveSession();
  if (activeSession && activeSession.userId) {
    window.location.replace("./dashboard.html");
  }
}

/**
 * Safely parses active session from LocalStorage
 */
function getActiveSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("Failed to read session storage:", err);
    return null;
  }
}

/**
 * Safely reads registered users array from LocalStorage
 */
function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read users from LocalStorage:", err);
    return [];
  }
}

/**
 * Saves users array to LocalStorage
 */
function saveRegisteredUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

/**
 * Initializes Light/Dark mode based on LocalStorage preference
 */
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
 * Sets up Show/Hide buttons for Password and Confirm Password inputs
 */
function setupPasswordToggles() {
  bindToggle("password", "togglePasswordBtn");
  bindToggle("confirmPassword", "toggleConfirmPasswordBtn");
}

function bindToggle(inputId, buttonId) {
  const inputEl = document.getElementById(inputId);
  const btnEl = document.getElementById(buttonId);
  if (!inputEl || !btnEl) return;

  btnEl.addEventListener("click", () => {
    const isPassword = inputEl.type === "password";
    inputEl.type = isPassword ? "text" : "password";
    btnEl.textContent = isPassword ? "Hide" : "Show";
    btnEl.setAttribute("aria-pressed", String(isPassword));
    btnEl.setAttribute(
      "aria-label",
      isPassword ? `Hide ${inputEl.name}` : `Show ${inputEl.name}`
    );
  });
}

/**
 * Hashes a password with a salt using Web Crypto SHA-256 (with deterministic fallback)
 */
async function hashPasswordWithSalt(password, salt) {
  const combined = `${salt}:${password}`;
  if (window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback hash if opened in an environment where SubtleCrypto is restricted
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }
  return `fallback_${(hash >>> 0).toString(16)}`;
}

/**
 * Generates a random cryptographic salt string
 */
function generateSalt() {
  if (window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return `salt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Sets up form validation and submission handler
 */
function setupRegistrationForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  const fullNameInput = document.getElementById("fullName");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const submitBtn = document.getElementById("registerSubmitBtn");

  // Clear individual field errors on input
  [fullNameInput, emailInput, passwordInput, confirmPasswordInput].forEach((input) => {
    input.addEventListener("input", () => {
      clearFieldError(input.id);
      hideAlert();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert();

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    let isValid = true;

    // 1. Validate Full Name
    if (!fullName) {
      setFieldError("fullName", "Full name is required.");
      isValid = false;
    } else if (fullName.length < 2) {
      setFieldError("fullName", "Full name must be at least 2 characters.");
      isValid = false;
    }

    // 2. Validate Email Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!email) {
      setFieldError("email", "Email address is required.");
      isValid = false;
    } else if (!emailRegex.test(email)) {
      setFieldError("email", "Please enter a valid email address (e.g., name@domain.com).");
      isValid = false;
    }

    // 3. Validate Password
    if (!password) {
      setFieldError("password", "Password is required.");
      isValid = false;
    } else if (password.length < 6) {
      setFieldError("password", "Password must be at least 6 characters long.");
      isValid = false;
    }

    // 4. Validate Confirm Password
    if (!confirmPassword) {
      setFieldError("confirmPassword", "Please confirm your password.");
      isValid = false;
    } else if (password !== confirmPassword) {
      setFieldError("confirmPassword", "Passwords do not match.");
      isValid = false;
    }

    if (!isValid) {
      showAlert("Please fix the highlighted errors before continuing.", "error");
      return;
    }

    // 5. Check for duplicate email registration
    const users = getRegisteredUsers();
    const emailExists = users.some((u) => u.email.toLowerCase() === email);
    if (emailExists) {
      setFieldError("email", "An account with this email address already exists.");
      showAlert("This email is already registered. Please log in or use a different email.", "error");
      return;
    }

    // 6. Hash password & save new user
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating Account...";

    try {
      const salt = generateSalt();
      const passwordHash = await hashPasswordWithSalt(password, salt);

      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fullName,
        email,
        salt,
        passwordHash,
        monthlyBudget: 0,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      saveRegisteredUsers(users);

      // Store recently registered email for convenient pre-fill on login page
      sessionStorage.setItem("spendwise_registered_email", email);

      showAlert(
        "Registration successful! Redirecting you to the Login page...",
        "success"
      );
      form.reset();

      setTimeout(() => {
        window.location.href = "./login.html?registered=1";
      }, 1200);
    } catch (error) {
      console.error("Registration error:", error);
      showAlert("An unexpected error occurred. Please try again.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Create SpendWise Account";
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
  const alertBox = document.getElementById("formAlert");
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.className = `alert-box ${type}`;
}

function hideAlert() {
  const alertBox = document.getElementById("formAlert");
  if (!alertBox) return;
  alertBox.textContent = "";
  alertBox.className = "alert-box hidden";
}