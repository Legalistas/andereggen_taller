# Database Seeds

Scripts para inicializar la base de datos con los datos base necesarios para que la app arranque.

## Archivos

- `countries-states.ts` — Argentina + provincias.
- `roles-permissions.ts` — roles (`admin`, `internal`, `client`) y permisos (`view_users`, `create_users`, `edit_users`, `delete_users`, `disable_users`).
- `admin-user.ts` — usuario admin inicial.
- `app-settings.ts` — singleton de configuración de la empresa.
- `insurance-companies.ts` — catálogo de aseguradoras.
- `lead-sources.ts` — catálogo de fuentes de lead (web, whatsapp, manual, etc.).
- `index.ts` — orquestador que corre todos los seeds en orden.

## Uso

```bash
# Correr todos los seeds
bunx tsx prisma/seed/index.ts

# O uno individual
bunx tsx prisma/seed/admin-user.ts
```

## Orden de ejecución

Cada seed es reruneable (upsert o limpia primero), pero el orden importa porque hay dependencias:

1. `countries-states` (base geográfica)
2. `roles-permissions` (roles del sistema)
3. `admin-user` (requiere que exista el rol `admin`)
4. `app-settings`, `insurance-companies`, `lead-sources` (independientes)
