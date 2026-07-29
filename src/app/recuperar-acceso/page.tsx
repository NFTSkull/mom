"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function RecuperarAccesoPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/password/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Siempre mensaje genérico
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Recuperar acceso</h1>
        {done ? (
          <p className="mt-4 text-sm text-slate-600">
            Si el correo está registrado, recibirá instrucciones para restablecer el acceso.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Correo
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {loading ? "Enviando…" : "Enviar instrucciones"}
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/login" prefetch={false} className="underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
