"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { businessConfig } from "@/lib/business-config";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push("/inbox");
        router.refresh();
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(
        response.status === 401
          ? "Wrong password"
          : data.error || "Invalid password"
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sa">
      <div id="login">
        <h2>{businessConfig.name} Admin</h2>
        <p>Enter the dashboard password.</p>
        <form onSubmit={handleSubmit}>
          <input
            id="pw"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p id="lerr" style={{ color: "var(--red)" }}>
            {error}
          </p>
          <button id="go" type="submit" style={{ width: "100%" }} disabled={loading}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
