import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import "./LoginScreen.css";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { label: "At least one letter", test: (p) => /[a-zA-Z]/.test(p) },
  { label: "At least one number", test: (p) => /\d/.test(p) },
];

function mapAuthError(error, isSignUp) {
  if (!error) return null;
  const msg = (error.message || "").toLowerCase();
  const code = error.code || "";
  if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials") || code === "invalid_credentials") {
    return "Invalid email or password. Please check and try again.";
  }
  if (msg.includes("email not confirmed") || code === "email_not_confirmed") {
    return "Please check your email and click the confirmation link to activate your account.";
  }
  if (msg.includes("user already registered") || msg.includes("already been registered") || code === "user_already_exists") {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (msg.includes("password") && (msg.includes("weak") || msg.includes("short"))) {
    return "Password must be at least 8 characters, with a letter and a number.";
  }
  if (msg.includes("invalid email") || msg.includes("valid email")) {
    return "Please enter a valid email address.";
  }
  if (msg.includes("too many requests") || code === "rate_limit_exceeded") {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Connection error. Please check your internet and try again.";
  }
  return error.message || (isSignUp ? "Sign up failed. Please try again." : "Sign in failed. Please try again.");
}

function validateSignUp(email, password, confirmPassword) {
  if (!email.trim()) return "Enter your email address.";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return "Enter a valid email address.";
  if (PASSWORD_REQUIREMENTS.some((r) => !r.test(password))) {
    return "Password must be at least 8 characters, with a letter and a number.";
  }
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}

function LoginScreen({ onLogin, onError, needsNewPassword, onPasswordUpdated, onCancelPasswordRecovery }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (isSignUp && password !== confirmPassword) {
      onError?.("Passwords do not match.");
      return;
    }

    if (!supabase) {
      onError?.("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Amplify environment variables.");
      return;
    }

    if (isSignUp) {
      const validationError = validateSignUp(email, password, confirmPassword);
      if (validationError) {
        onError?.(validationError);
        return;
      }
    }

    setIsLoading(true);
    setSignUpSuccess(false);

    try {
      if (isSignUp) {
        const redirectTo = window.location.origin + "/";
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo },
        });

        if (error) {
          onError?.(mapAuthError(error, true) || "Sign up failed");
          return;
        }

        if (data?.user?.identities?.length === 0) {
          onError?.("An account with this email already exists. Try signing in instead.");
          return;
        }

        if (data?.session) {
          onLogin();
        } else {
          setSignUpSuccess(true);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          onError?.(mapAuthError(error, false) || "Invalid email or password");
          return;
        }

        if (data?.session) {
          onLogin();
        }
      }
    } catch (err) {
      onError?.(mapAuthError(err, isSignUp) || err?.message || (isSignUp ? "Sign up failed" : "Sign in failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp((prev) => !prev);
    setSignUpSuccess(false);
    setShowForgotPassword(false);
    setForgotPasswordSuccess(false);
    setConfirmPassword("");
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (!supabase) {
      onError?.("Supabase is not configured.");
      return;
    }
    setIsLoading(true);
    setForgotPasswordSuccess(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/",
      });
      if (error) {
        onError?.(mapAuthError(error, false) || error.message);
        return;
      }
      setForgotPasswordSuccess(true);
    } catch (err) {
      onError?.(err?.message || "Failed to send reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    if (PASSWORD_REQUIREMENTS.some((r) => !r.test(password))) {
      onError?.("Password must be at least 8 characters, with a letter and a number.");
      return;
    }
    if (password !== confirmPassword) {
      onError?.("Passwords do not match.");
      return;
    }
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        onError?.(mapAuthError(error, true) || error.message);
        return;
      }
      onPasswordUpdated?.();
      if (typeof window !== "undefined" && window.history?.replaceState) {
        const path = window.location.pathname || "/";
        window.history.replaceState(null, "", path);
      }
      onLogin?.();
    } catch (err) {
      onError?.(err?.message || "Failed to update password.");
    } finally {
      setIsLoading(false);
    }
  };

  const signUpValid =
    email.trim() &&
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-zA-Z]/.test(password) &&
    /\d/.test(password) &&
    password === confirmPassword;

  const newPasswordValid =
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-zA-Z]/.test(password) &&
    /\d/.test(password) &&
    password === confirmPassword;

  // Set new password (after clicking reset link in email)
  if (needsNewPassword) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <div className="login-header">
            <img src="/shesha_pay_logo.png" alt="Shesha Pay" className="login-logo" />
            <h1 className="login-title">Set new password</h1>
            <p className="login-subtitle">Your reset link is valid for a short time. Choose a new password to secure your account.</p>
          </div>
          <form className="login-form" onSubmit={handleSetNewPassword}>
            <div className="login-field">
              <label htmlFor="new-password" className="login-label">New password</label>
              <input
                id="new-password"
                type="password"
                className="login-input"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={PASSWORD_MIN_LENGTH}
              />
              <ul className="login-requirements">
                {PASSWORD_REQUIREMENTS.map(({ label, test }) => (
                  <li key={label} className={test(password) ? "login-requirement-met" : ""}>
                    {test(password) ? "✓" : "○"} {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="login-field">
              <label htmlFor="new-confirm" className="login-label">Re-enter password</label>
              <input
                id="new-confirm"
                type="password"
                className="login-input"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <span className="login-error-text">Passwords do not match</span>
              )}
            </div>
            <button
              type="submit"
              className="login-button"
              disabled={!newPasswordValid || isLoading}
            >
              {isLoading ? "Updating..." : "Update password"}
            </button>
            {onCancelPasswordRecovery && (
              <button
                type="button"
                className="login-link"
                onClick={() => onCancelPasswordRecovery()}
                disabled={isLoading}
                style={{ marginTop: 16, display: "block", width: "100%", textAlign: "center" }}
              >
                Cancel and sign out
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Forgot password flow
  if (showForgotPassword) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <div className="login-header">
            <img src="/shesha_pay_logo.png" alt="Shesha Pay" className="login-logo" />
            <h1 className="login-title">Reset password</h1>
            <p className="login-subtitle">
              {forgotPasswordSuccess
                ? "Check your email"
                : "Enter your email and we'll send you a reset link."}
            </p>
          </div>
          {forgotPasswordSuccess ? (
            <div className="login-success">
              <p className="login-success-icon">✉️</p>
              <p>We sent a password reset link to <strong>{email}</strong>.</p>
              <p className="login-success-hint">Click the link in that email to set a new password.</p>
              <button type="button" className="login-link" onClick={() => { setShowForgotPassword(false); setForgotPasswordSuccess(false); }}>
                Back to sign in
              </button>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleForgotPassword}>
              <div className="login-field">
                <label htmlFor="reset-email" className="login-label">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  className="login-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              <button type="submit" className="login-button" disabled={!email.trim() || isLoading}>
                {isLoading ? "Sending..." : "Send reset link"}
              </button>
              <button
                type="button"
                className="login-link"
                onClick={() => setShowForgotPassword(false)}
                disabled={isLoading}
                style={{ marginTop: 12, display: "block" }}
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <img
            src="/shesha_pay_logo.png"
            alt="Shesha Pay"
            className="login-logo"
          />
          <h1 className="login-title">{isSignUp ? "Create account" : "Login"}</h1>
          <p className="login-subtitle">
            {isSignUp
              ? "Sign up to access your dashboard"
              : "Sign in to access your dashboard"}
          </p>
        </div>

        {signUpSuccess ? (
          <div className="login-success">
            <p className="login-success-icon">✉️</p>
            <p>We sent a confirmation link to <strong>{email}</strong>.</p>
            <p className="login-success-hint">Click the link in that email to activate your account, then come back here to sign in.</p>
            <button
              type="button"
              className="login-link"
              onClick={switchMode}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="email" className="login-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="login-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="login-field">
                <label htmlFor="password" className="login-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="login-input"
                  placeholder={isSignUp ? "Create a password" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  minLength={isSignUp ? PASSWORD_MIN_LENGTH : undefined}
                />
                {isSignUp && (
                  <ul className="login-requirements">
                    {PASSWORD_REQUIREMENTS.map(({ label, test }) => (
                      <li key={label} className={test(password) ? "login-requirement-met" : ""}>
                        {test(password) ? "✓" : "○"} {label}
                      </li>
                    ))}
                  </ul>
                )}
                {!isSignUp && (
                  <button
                    type="button"
                    className="login-link login-forgot-link"
                    onClick={() => setShowForgotPassword(true)}
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              {isSignUp && (
                <div className="login-field">
                  <label htmlFor="confirmPassword" className="login-label">
                    Re-enter password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className="login-input"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required={isSignUp}
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <span className="login-error-text">Passwords do not match</span>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="login-button"
                disabled={
                  !email.trim() ||
                  !password.trim() ||
                  isLoading ||
                  (isSignUp && !signUpValid)
                }
              >
                {isLoading
                  ? isSignUp
                    ? "Creating account..."
                    : "Signing in..."
                  : isSignUp
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            <p className="login-toggle">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                className="login-link"
                onClick={switchMode}
                disabled={isLoading}
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginScreen;
