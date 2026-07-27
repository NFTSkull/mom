import Link from "next/link";

export default function NoAutorizadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-slate-900">No autorizado</h1>
        <p className="mt-3 text-sm text-slate-600">
          No tiene permiso para acceder a este recurso.
        </p>
        <Link href="/admin" className="mt-6 inline-block text-sm underline">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
