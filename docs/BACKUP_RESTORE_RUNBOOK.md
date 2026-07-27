# Backup / Restore Staging

## Antes de asumir PITR

Reportar plan Supabase del proyecto `nom035-staging`, backups disponibles, retención y limitaciones.

## Respaldo lógico (ficticio)

Usar el comando soportado por la CLI instalada (p. ej. `supabase db dump` hacia archivo fuera del repo o cifrado).

No incluir en el archivo:

- passwords Auth;
- service keys;
- peppers;
- JWT secrets.

## Restauración de prueba

1. Restaurar en Supabase **local** limpio o proyecto temporal claramente `*-restore`.
2. Validar migraciones, estructura, fixtures staging, inventario Storage.
3. No declarar “backup OK” solo porque el dump se generó.

## Post-prueba

Eliminar dumps o almacenarlos cifrados fuera de Git.
