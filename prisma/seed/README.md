# Database Seeds

Esta carpeta contiene todos los scripts de seed para inicializar la base de datos.

## 📁 Estructura de Seeds

### `roles-permissions.ts`
Crea los roles y permisos básicos del sistema:

**Roles:**
- `admin`: Acceso completo
- `internal`: Acceso interno (sin delete)
- `client`: Solo registro, sin permisos

**Permisos:**
- `view_users`: Ver usuarios
- `create_users`: Crear usuarios
- `edit_users`: Editar usuarios
- `delete_users`: Eliminar usuarios
- `disable_users`: Deshabilitar usuarios

### `admin-user.ts`
Crea el usuario administrador inicial:
- **Nombre:** John Doe
- **Email:** admin@example.com
- **Contraseña:** Admin$123456 (hasheada con argon2)
- **Rol:** admin

### `test-connection.ts`
Script para probar la conexión a la base de datos y mostrar el estado de las tablas.

### `sample-data.ts`
Script para crear datos de muestra (usuarios, roles, etc.)

### `index.ts`
Script maestro que ejecuta todas las seeds en orden correcto.

## 🚀 Cómo ejecutar

### Ejecutar todas las seeds:
```bash
npx tsx prisma/seed/index.ts
```

### Ejecutar seeds individuales:
```bash
# Solo roles y permisos
npx tsx prisma/seed/roles-permissions.ts

# Solo usuario admin
npx tsx prisma/seed/admin-user.ts

# Probar conexión
npx tsx prisma/seed/test-connection.ts
```

## ⚠️ Orden de ejecución

1. **roles-permissions.ts** - Debe ejecutarse primero
2. **admin-user.ts** - Requiere que existan los roles

## 🔐 Credenciales por defecto

**Usuario Administrador:**
- Email: `admin@example.com`
- Contraseña: `Admin$123456`
- Rol: `admin`

## 📝 Notas

- Las contraseñas se hashean con **argon2**
- Los scripts manejan datos duplicados automáticamente
- El usuario admin se puede actualizar re-ejecutando la seed