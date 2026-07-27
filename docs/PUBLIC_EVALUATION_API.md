# API pública de evaluación por token (B4.3)

Backend exclusivo de servidor. El navegador **nunca** calcula scores ni conoce peppers/secret keys.

## Endpoints

Base: `/api/public/evaluations`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/session` | Token en body | Intercambia token → cookie HttpOnly |
| GET | `/session` | Cookie | Contexto mínimo + draft |
| DELETE | `/session` | Cookie | Cierra sesión (borra cookie) |
| POST | `/start` | Cookie | `pending → in_progress` (idempotente) |
| PUT | `/draft` | Cookie | Upsert de borrador central |
| POST | `/submit` | Cookie | Valida, calcula y persiste atómicamente |

## Cookies

- Nombre (dev): `nom035_eval_session`
- Nombre (prod): `__Host-nom035_eval_session`
- Atributos: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` en producción
- Valor: secreto de sesión (nunca el token, nunca assignmentId en claro)
- Se elimina al completar / cerrar

## Request / response

Contrato de error:

```json
{ "ok": false, "code": "string", "message": "string", "requestId": "uuid" }
```

Éxito:

```json
{ "ok": true, "...": "campos específicos" }
```

### POST `/session`

```json
{ "token": "ev_..." }
```

Respuesta 201: `{ ok, context }` + `Set-Cookie`.  
`context` incluye: `assignmentId`, `workerName`, `campaignName`, `status`, `startedAt`, `expiresAt`, `questionnaireVersion`, `draft`.  
**Nunca** expone: `token_hash`, `worker_id`, email, teléfono, scores, alerts.

### PUT `/draft`

```json
{ "payload": { "...sin scores..." }, "expectedUpdatedAt": "ISO|null" }
```

Campos `finalScore`, `riskLevel`, `token`, etc. se eliminan antes de persistir.

### POST `/submit`

```json
{
  "submissionId": "uuid",
  "guiaI": { "responses": { "guia_i_1": 0 } },
  "guiaII": { "gateClientes": "no", "gateJefe": "no", "responses": { "1": "nunca" } }
}
```

El servidor **ignora** cualquier `finalScore` / `riskLevel` / `scoringVersion` / `workerId` / `campaignId` enviado.  
Respuesta: `{ completed, completedAt, confirmationId }` — **sin scores**.

## Códigos HTTP

| Código | Uso |
|--------|-----|
| 200 | Consulta / idempotencia |
| 201 | Sesión o envío creado |
| 400 | Payload / Content-Type inválido |
| 401 | Sesión ausente/inválida/vencida/revocada |
| 403 | Origin no permitido |
| 404 | Enlace no válido (mensaje genérico) |
| 409 | Completada / conflicto / draft obsoleto |
| 410 | Vencida / revocada / campaña no disponible |
| 413 | Body demasiado grande |
| 429 | Rate limit |
| 500 | Error genérico |

## Idempotencia

- Mismo `submissionId` sobre assignment ya completed → 200 `already_completed`
- `submissionId` distinto sobre completed → 409 `conflict`
- `start` sobre `in_progress` → idempotente

## Expiración

- Assignment: `expires_at` obligatorio en emisión
- Sesión: `NOM035_EVALUATION_SESSION_MINUTES` (operativo local: **120**) — suficiente para completar Guía I+II (~15–25 min) con margen

## Rate limit

- Clave: HMAC de IP (`NOM035_RATE_LIMIT_PEPPER`); nunca IP en claro
- `session_exchange`: 60 / 60s
- `submit`: 20 / 60s

## Validación de Origin

Métodos mutables exigen `Origin` coincidente con `NEXT_PUBLIC_APP_URL` o el `Host` de la petición. Sin Origin → 403.

## Campos que nunca se exponen al trabajador

`finalScore`, `finalRiskLevel`, `categoryScores`, `domainScores`, `dimensionScores`, `alerts`, `requiresClinicalAttention`, `token_hash`, `worker_id`, email, teléfono, respuestas de terceros.
