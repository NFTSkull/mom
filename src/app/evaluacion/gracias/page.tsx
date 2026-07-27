export default function EvaluacionGraciasPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-8">
      <section className="w-full rounded-lg border border-zinc-200 bg-white p-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Gracias por completar tu evaluación
        </h1>
        <p className="mt-3 text-zinc-700">
          Tus respuestas se registraron correctamente. Puedes cerrar esta ventana.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          No se muestran resultados individuales. La organización recibirá la información
          conforme a la NOM-035-STPS-2018.
        </p>
      </section>
    </main>
  );
}
