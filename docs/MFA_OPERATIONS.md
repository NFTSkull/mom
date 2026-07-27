# MFA TOTP — operaciones

- Enrolamiento: `POST /api/auth/mfa/enroll` (QR/secreto solo en esa respuesta).
- Verificación: challenge + verify → AAL2.
- Unenroll de factor verificado exige AAL2; no se elimina el último si `mfa_required`.
- No hay códigos de recuperación; se puede enrolar un segundo factor como respaldo.
- Reset MFA administrativo: `POST /api/admin/nom035/users/[id]/reset-mfa` (users.manage + AAL2).
- Secretos TOTP nunca en DB de negocio, logs ni localStorage.
