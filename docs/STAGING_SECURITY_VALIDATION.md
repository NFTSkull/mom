# Validación de seguridad Staging

Checklist (marcar en certificación):

- [ ] Tablas directas denegadas a anon
- [ ] RPCs admin denegadas a anon
- [ ] Storage directo denegado
- [ ] `/api/admin/*` → 401 sin Auth
- [ ] `/admin` → login
- [ ] Bundles sin `SUPABASE_SECRET_KEY` / peppers / service_role JWT
- [ ] Agregados sin answers
- [ ] Quejas listado sin contacto
- [ ] Dirección sin individuales
- [ ] RH sin clínica
- [ ] Cookies Secure en Preview HTTPS
- [ ] Headers: CSP, HSTS (si aplica), nosniff, frame-ancestors, Referrer-Policy
- [ ] CSP: documentar `unsafe-inline` / `unsafe-eval` residuales sin fingir resolución
