"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function TrabajadorLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trabajador/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        mustChangePassword?: boolean;
      };
      if (!res.ok || !data.ok) {
        setError(data.message || "Usuario o contraseña incorrectos.");
        return;
      }
      router.replace(
        data.mustChangePassword ? "/trabajador/cambiar-contrasena" : "/trabajador"
      );
    } catch {
      setError("Usuario o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Inicio de sesión</h1>
      <p className="mt-1 text-sm text-slate-600">Ingrese su usuario y contraseña.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <label className="block text-sm">
          Usuario
          <input
            data-testid="worker-login-username"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Contraseña
          <input
            data-testid="worker-login-password"
            type="password"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? (
          <p data-testid="worker-login-error" className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          data-testid="worker-login-submit"
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Iniciando…" : "Iniciar sesión"}
        </button>
      </form>
    </section>
  );
}
