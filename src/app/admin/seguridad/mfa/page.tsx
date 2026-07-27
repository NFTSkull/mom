"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Factor = { id: string; friendlyName?: string | null; status: string };

export default function MfaPage() {
  const router = useRouter();
  const search = useSearchParams();
  const mode = search.get("mode") ?? "verify";
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void (async () => {
        const res = await fetch("/api/auth/mfa/status");
        const data = await res.json();
        if (data.ok) {
          setFactors(data.factors ?? []);
          const verified = (data.factors as Factor[]).find((f) => f.status === "verified");
          if (verified) setFactorId(verified.id);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  async function startEnroll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "No se pudo enrolar.");
        return;
      }
      setFactorId(data.factorId);
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setInfo(
        "Escanee el código QR o use el secreto. Puede enrolar un segundo factor como respaldo más adelante. No se ofrecen códigos de recuperación."
      );
      const ch = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId: data.factorId }),
      });
      const chData = await ch.json();
      if (chData.ok) setChallengeId(chData.challengeId);
    } finally {
      setLoading(false);
    }
  }

  async function startChallenge() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "No se pudo iniciar la verificación.");
        return;
      }
      setChallengeId(data.challengeId);
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      let chId = challengeId;
      if (!chId) {
        const ch = await fetch("/api/auth/mfa/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factorId }),
        });
        const chData = await ch.json();
        if (!chData.ok) {
          setError(chData.message ?? "No se pudo verificar.");
          return;
        }
        chId = chData.challengeId;
        setChallengeId(chId);
      }
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, challengeId: chId, code }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "Código incorrecto.");
        return;
      }
      setQrCode(null);
      setSecret(null);
      router.replace(data.next ?? "/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Verificación en dos pasos</h1>
      <p className="mt-2 text-sm text-slate-600">
        {mode === "enroll"
          ? "Configure su autenticador TOTP para continuar."
          : "Ingrese el código de seis dígitos de su autenticador."}
      </p>

      {mode === "enroll" && !qrCode ? (
        <button
          type="button"
          onClick={() => void startEnroll()}
          disabled={loading}
          className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {loading ? "Preparando…" : "Iniciar enrolamiento"}
        </button>
      ) : null}

      {qrCode ? (
        <div className="mt-6 space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="Código QR de enrolamiento MFA" className="mx-auto h-48 w-48" />
          {secret ? (
            <p className="break-all text-center text-xs text-slate-500">
              Secreto (solo durante el enrolamiento): {secret}
            </p>
          ) : null}
        </div>
      ) : null}

      {info ? <p className="mt-4 text-sm text-slate-600">{info}</p> : null}

      {!challengeId && mode === "verify" && factorId ? (
        <button
          type="button"
          onClick={() => void startChallenge()}
          disabled={loading}
          className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          Solicitar desafío
        </button>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={onVerify}>
        <div>
          <label htmlFor="code" className="block text-sm font-medium">
            Código de 6 dígitos
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading || !factorId}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {loading ? "Verificando…" : "Verificar"}
        </button>
      </form>

      {factors.length > 0 ? (
        <p className="mt-6 text-xs text-slate-500">
          Factores configurados: {factors.map((f) => f.status).join(", ")}
        </p>
      ) : null}
    </main>
  );
}
