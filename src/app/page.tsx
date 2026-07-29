import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold text-zinc-900">Portal interno NOM-035</h1>
      <p className="max-w-2xl text-zinc-700">
        Panel general de seguimiento de trabajadores, campañas y evaluaciones.
      </p>
      <div className="flex gap-3">
        <Link href="/admin" className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700">
          Ir al panel admin
        </Link>
      </div>
    </main>
  );
}
