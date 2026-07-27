import Link from "next/link";

export default function CuentaDeshabilitadaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Cuenta deshabilitada</h1>
        <p className="mt-3 text-sm text-slate-600">
          Su acceso administrativo ha sido deshabilitado. Contacte a un administrador.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm underline">
          Ir al inicio de sesión
        </Link>
      </div>
    </main>
  );
}
