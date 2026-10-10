
import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./Auth.css";

<button
  type="button"
  onClick={async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out failed:", error.message);
    }
  }}
>
  Sign out
</button>

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Account created successfully!");
        } else {
          setMessage(
            "Account created. Check your email to confirm your account, then log in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">H</div>
          <span>HealthThread</span>
        </div>

        <p className="auth-eyebrow">YOUR HEALTH, CONNECTED</p>

        <h1>
          {mode === "login"
            ? "Welcome back"
            : "Create your account"}
        </h1>

        <p className="auth-subtitle">
          Keep your health journey organized in one place.
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              Full name
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={8}
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login"
            ? "New to HealthThread?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setMessage("");
            }}
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>

        <p className="auth-disclaimer">
          Use fictional health information while testing this prototype.
        </p>
      </section>
    </main>
  );
}
