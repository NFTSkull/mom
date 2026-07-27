# Complaints Privacy Model (B4.5)

## Público (`POST /api/public/complaints`)

- Origin obligatorio (= `NEXT_PUBLIC_APP_URL` / host)
- Rate limit HMAC de IP (`public_rate_limits`)
- Honeypot `website` (debe ir vacío)
- No acepta folio/status/assignedTo/resolutionNotes
- Respuesta solo: `folio`, `confirmationCode`, `receivedAt`
- Folio atómico: `NOM035-Q-AAAA-NNNNNN` (secuencia)
- No imprime descripción ni contacto

## Admin (B4.6)

- Listado: `complaints.list` + `can_view_sensitive_cases` + AAL2
- Detalle: `complaints.detail` (+ contacto solo con `complaints.contact.read`)
- Gestión: `complaints.manage` + sensitive + AAL2
- Listado: folio, tipo, preview, anonimato, estado, responsable, fechas
- **Sin contacto en listado** (ni HTML oculto / props / logs)
- Detalle (explícito): descripción completa + contacto si identificada y autorizado
- Advertencia de confidencialidad en UI
- `audit_log` sin descripción ni PII del denunciante
- RH / Dirección: 403 (sin permiso)

## Transiciones

recibida → en_revision → resuelta → cerrada (también cierre justificado desde recibida/en_revision).
Bloqueadas regresiones desde cerrada.
