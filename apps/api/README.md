# API del gestor de presupuestos y gastos

Proyecto independiente de `apps/web`. La API se desarrollará con Next.js sobre Node.js,
PostgreSQL y Prisma ORM 7.

## Contratos iniciales

- `openapi.yaml` documenta rutas, datos, errores y autenticación.
- `prisma/schema.prisma` define las entidades y relaciones de PostgreSQL.
- Están implementados `GET /health`, `/api/v1/auth`, `/api/v1/institutions`,
  cuentas, cálculo de saldos y movimientos con auditoría. Las compras con
  tarjeta y los préstamos siguen pendientes.

Las instituciones, cuentas, movimientos y eventos de auditoría pertenecen a un
usuario. El ID del usuario se obtiene de la sesión y no se recibe del cliente.
Las referencias de movimientos a cuentas incluyen el ID del usuario en sus
claves foráneas. Los importes se intercambian como cadenas decimales con dos
posiciones y se guardan como `Decimal(18, 2)`.

## Preparación

1. Instalar dependencias con `pnpm install`.
2. Crear credenciales locales con `pnpm db:local:env` (solo una vez).
3. Iniciar PostgreSQL con `pnpm db:local:up` (requiere Docker Desktop).
4. Aplicar la migración inicial con `pnpm db:deploy` y generar el cliente con
   `pnpm db:generate`.
5. Validar con `pnpm db:validate` y `pnpm openapi:validate`.
6. Iniciar el servidor con `pnpm dev` (puerto 3001).

La API usa `WEB_ORIGIN` para permitir peticiones del frontend con credenciales
y `API_ORIGIN` para peticiones desde su propio origen.
En desarrollo se permite `http://localhost:3000` si no se configura la variable;
en producción debe configurarse con el origen real. El navegador debe enviar
`credentials: "include"`. El token vive en una cookie `HttpOnly` durante siete
días; PostgreSQL guarda únicamente su hash. Las contraseñas usan Argon2id.
Para comprobar el flujo de autenticación con el servidor iniciado, ejecutar
`node scripts/smoke-auth.mjs`; la prueba elimina su usuario temporal.
Para comprobar el aislamiento y las operaciones de cuentas, ejecutar
`node scripts/smoke-accounts.mjs`; también elimina sus datos temporales.
Para comprobar movimientos y saldos, ejecutar `node scripts/smoke-transactions.mjs`.
Las escrituras financieras y sus eventos de auditoría se guardan en una sola
transacción de PostgreSQL. Los saldos incluyen el saldo inicial y movimientos
activos hasta la fecha indicada; si se omite, se usa la fecha actual en UTC.

Tres contraseñas incorrectas para un correo durante quince minutos bloquean
nuevos inicios de sesión para ese correo durante quince minutos. Una entrada
correcta reinicia el contador. La recuperación de contraseña sigue pendiente
de definición.

Antes de exponer el servicio públicamente se requiere HTTPS, configurar
`WEB_ORIGIN` y `API_ORIGIN` con los dominios reales y limitar también el volumen
de solicitudes de registro. La verificación de correo no está implementada.

La migración inicial está en `prisma/migrations/20261122000000_init`. Incluye
restricciones SQL para importes positivos, combinación válida de cuentas según
tipo de movimiento, cuentas distintas en transferencias y nombres activos únicos
por usuario. Prisma no expresa estas reglas directamente en `schema.prisma`.
El volumen `postgres_data` conserva los datos cuando se detiene el contenedor.
