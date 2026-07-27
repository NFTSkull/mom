# Policy Versioning (B4.5)

## Estados

- `borrador` — editable
- `publicada` — vigente (máximo una; índice único parcial)
- `archivada` — historial (no se elimina)

## Flujo

1. Generar base desde `company_settings` central (texto plano)
2. Guardar borrador
3. Publicar → archiva la vigente en la misma transacción
4. Para cambiar una publicada: duplicar → editar borrador → publicar

## Restricciones

- Título/contenido no vacíos; sin HTML arbitrario
- `version_number` monotónico; `version_label` único
- UI sin `dangerouslySetInnerHTML`
- `audit_log` sin contenido completo
