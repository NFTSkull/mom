# Riesgos

Ver también `docs/PUBLIC_EVALUATION_THREAT_MODEL.md` (B4.3),
`docs/AUTH_SECURITY_MODEL.md` / `docs/AUTH_RBAC_MATRIX.md` (B4.6),
`docs/EVIDENCE_STORAGE_SECURITY.md` / `docs/COMPLAINTS_PRIVACY_MODEL.md` (B4.5).

## Residuales abiertos

- CSP permite `'unsafe-inline'` / `'unsafe-eval'` por compatibilidad Next (P1).
- Retención/purge de evidencias soft-deleted y jobs de `storage_delete_pending` (P1).
- Token en URL usable hasta el primer intercambio o vencimiento (diseño B4.3).
- Provisionamiento de usuarios reales de empresa y despliegue Cloud: **fuera de B4.6** (P0 siguiente).
- MFA rate-limit amplio en verify/challenge para viabilidad E2E; revisar umbral en producción (P1).

## Mitigado en B4.6

- Panel admin sin Auth (ahora Auth + RBAC + MFA).
- Confianza exclusiva en loopback/Origin como autoridad (sustituido por JWT+perfil DB; Origin sigue en mutaciones).
- Escalamiento por metadata JWT / UI / cookies: rechazado (pgTAP + E2E).
