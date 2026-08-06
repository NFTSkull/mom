export default function TrabajadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <p className="mx-auto max-w-lg text-sm font-medium text-slate-700">
          BIENVENIDO!
        </p>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">{children}</main>
    </div>
  );
}
