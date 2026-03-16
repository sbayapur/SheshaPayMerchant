import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import "./LoginScreen.css";

function LoginScreen({ onLogin, onError }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      return;
    }

    if (!supabase) {
      onError?.("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env");
      return;
    }

    setIsLoading(true);
    setSignUpSuccess(false);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });

        if (error) {
          onError?.(error.message || "Sign up failed");
          return;
        }

        if (data?.user?.identities?.length === 0) {
          onError?.("An account with this email already exists. Try signing in.");
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
          onError?.(error.message || "Invalid email or password");
          return;
        }

        if (data?.session) {
          onLogin();
        }
      }
    } catch (err) {
      onError?.(err.message || (isSignUp ? "Sign up failed" : "Sign in failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp((prev) => !prev);
    setSignUpSuccess(false);
  };

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
            <p>Check your email for a confirmation link to activate your account.</p>
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
                  placeholder="Enter your email"
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
                  placeholder={isSignUp ? "At least 6 characters" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  minLength={isSignUp ? 6 : undefined}
                />
              </div>

              <button
                type="submit"
                className="login-button"
                disabled={!email.trim() || !password.trim() || isLoading || (isSignUp && password.length < 6)}
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
