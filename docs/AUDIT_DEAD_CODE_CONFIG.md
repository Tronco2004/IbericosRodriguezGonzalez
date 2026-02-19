# Auditoría Completa: Código Muerto, Configuración y Problemas Varios

**Fecha:** 19 de febrero de 2026  
**Proyecto:** Ibéricos Rodríguez González  
**Auditor:** GitHub Copilot (Claude Opus 4.6)

---

## 1. ARCHIVOS MUERTOS (Dead Files)

### P1 — Archivos depreciados que aún existen como endpoints accesibles

| # | Archivo | Problema | Severidad |
|---|---------|----------|-----------|
| 1.1 | `src/layouts/Layout-old.astro` | Layout antiguo de 291 líneas. No lo importa ningún otro archivo. Solo referenciado en `ERRORES_DETECTADOS.txt` y `README.md`. | **P2** |
| 1.2 | `src/pages/api/carrito/agregar.ts` | Marcado como `DEPRECATED` en su propio código. Devuelve 410 Gone. Redirige a `/api/carrito` POST. Debería eliminarse y documentar la migración. | **P2** |
| 1.3 | `src/pages/api/variantes/eliminar.ts` | Marcado como `DEPRECATED`. Devuelve 410 Gone. La funcionalidad la cubre un trigger en BD. | **P2** |
| 1.4 | `src/pages/api/debug/crear-pedido-prueba.ts` | Endpoint de debug que crea pedidos de prueba con datos falsos (`test@example.com`, `Jamón de prueba`) en la BD de producción. Aunque el middleware protege con auth admin, el código no debería existir en producción. | **P1** |
| 1.5 | `src/pages/api/debug-categorias.ts` | Endpoint de debug para inspeccionar categorías. Expone toda la estructura de productos. Usa `supabaseClient` (anon key) sin protección propia (depende del middleware). | **P2** |
| 1.6 | `src/pages/api/debug-queso.ts` | Endpoint de debug hardcodeado para producto_id=13 ("Queso Montelareina"). Totalmente específico y sin uso legítimo. | **P2** |
| 1.7 | `src/pages/api/debug-variantes.ts` | Endpoint de debug que expone TODAS las variantes del inventario. Excesivo uso de `console.log`. | **P2** |
| 1.8 | `src/pages/api/admin/guardar-producto.ts` | **No hace nada útil.** El endpoint "valida" un body JSON y devuelve éxito, pero no guarda nada en BD. El comentario dice "localStorage" en el cliente. Endpoint completamente vacío de lógica real. | **P1** |
| 1.9 | `src/pages/api/admin/setup.ts` | Endpoint de setup inicial para crear categorías. Uso puntual durante el despliegue. No debería existir en producción. | **P2** |
| 1.10 | `src/pages/api/admin/init-data.ts` | Similar a setup.ts — crea datos iniciales. Solo se referencia en `src/pages/admin/setup.astro`. | **P2** |
| 1.11 | `src/pages/api/admin/setup-variantes-stock.ts` | Intenta ejecutar ALTER TABLE via RPC. Devuelve un mensaje pidiendo al usuario que ejecute SQL manualmente. | **P2** |
| 1.12 | `src/pages/api/admin/debug-ingresos.ts` | Endpoint de debug para diagnóstico de ingresos del dashboard. No debería estar en producción. | **P2** |
| 1.13 | `src/pages/admin/setup.astro` | Página de setup que llama a `init-data`. Para uso puntual de despliegue, no producción. | **P2** |
| 1.14 | `src/lib/cloudinary.ts` | **Potencialmente muerto.** Exporta funciones `getCloudinaryUrl`, `uploadToCloudinary`, `deleteFromCloudinary` pero `upload.ts` importa `cloudinary` directamente del paquete, no de este archivo. Ningún archivo importa desde `lib/cloudinary`. | **P2** |
| 1.15 | `src/lib/auth.ts` | Solo exporta tipos (`UserRole`, `User`). Ningún archivo lo importa. Los tipos podrían moverse a `supabase.ts` o eliminarse. | **P3** |
| 1.16 | `src/scripts/` | Carpeta vacía. Debería eliminarse. | **P3** |

---

## 2. CÓDIGO MUERTO DENTRO DE ARCHIVOS

### P1 — Datos placeholder / falsos en producción

| # | Archivo | Línea | Problema | Severidad |
|---|---------|-------|----------|-----------|
| 2.1 | `src/lib/email.ts` | L68 | **Dirección falsa en PDF de factura:** `"Calle de la Moda 123, Polígono Industrial, 28001 Madrid"` — Esta dirección es ficticia y se envía a clientes reales en la factura PDF. | **P0** |
| 2.2 | `src/lib/email.ts` | L69 | **NIF en factura:** `NIF: 25384756B` — Verificar que sea el NIF real de la empresa. | **P1** |
| 2.3 | `src/lib/email.ts` | L422, L473, L614 | **Dirección falsa repetida** en emails de devolución (3 ocurrencias más de "Calle de la Moda 123"). Los clientes recibirían instrucciones de envío a una dirección que no existe. | **P0** |
| 2.4 | `src/pages/mis-pedidos.astro` | L40-42 | **Dirección falsa hardcodeada** en la UI: `"Calle de la Moda 123"`, `"Polígono Industrial"`, `"28001 Madrid, España"`. | **P1** |
| 2.5 | `src/lib/email.ts` | L11-12 | **Console.log de credenciales:** Loguea si la password de Gmail está configurada (`'📧 Password configurada:', pass ? 'Sí' : '⚠️ NO'`). Aunque no imprime la contraseña en sí, este log en producción es un riesgo de fuga de información. | **P1** |
| 2.6 | `src/lib/email.ts` | L188-190 | **Console.log de datos sensibles** en producción: imprime `GMAIL_USER` y `ADMIN_EMAIL` en cada envío de correo. | **P2** |

### P1 — Console.log excesivo

| # | Archivo | Problema | Severidad |
|---|---------|----------|-----------|
| 2.7 | `src/lib/email.ts` | **30+ console.log/error** a lo largo de 1198 líneas. Muchos son informativos pero no deberían estar en producción. | **P2** |
| 2.8 | `src/pages/api/carrito/reservar.ts` | Console.log con datos de request en cada reserva. | **P3** |
| 2.9 | `src/pages/api/debug-variantes.ts` | Console.log masivo iterando cada variante de producto. | **P2** |

### P2 — Middleware: array vacío sin efecto

| # | Archivo | Línea | Problema | Severidad |
|---|---------|-------|----------|-----------|
| 2.10 | `src/middleware.ts` | L127 | `const rutasProtegidas: string[] = [];` — Array vacío. El bloque de protección de rutas generales (L127-133) **nunca protege nada** porque el array está vacío. Es código muerto funcional. | **P2** |

---

## 3. CONFIGURACIÓN

### package.json

| # | Problema | Detalle | Severidad |
|---|---------|---------|-----------|
| 3.1 | **Descripción incorrecta** | `"description": "IbericosRG - Tienda online de moda masculina premium"` — El proyecto es de **productos ibéricos**, no de moda masculina. Copia de un template anterior. | **P1** |
| 3.2 | **TypeScript desactualizado** | `"typescript": "5.3.3"` en devDependencies. La última versión estable es 5.7.x. No es bloqueante pero conviene actualizar. | **P3** |
| 3.3 | **`@astrojs/sitemap` sin tailwindcss** | El `tailwind.config.mjs` existe y está configurado, pero `tailwindcss` no aparece en `dependencies` ni `devDependencies`. Esto sugiere que Tailwind se carga de otra forma (¿CDN? ¿integración de Astro?) o que el config no se usa realmente. | **P2** |

### astro.config.mjs

| # | Problema | Detalle | Severidad |
|---|---------|---------|-----------|
| 3.4 | **`fileURLToPath` + `path` importados pero solo usados para alias** | No es un problema per se, pero el alias `@` no se usa consistentemente en el proyecto (muchos imports usan rutas relativas `../../lib/`). | **P3** |
| 3.5 | **Exclusión de ruta errónea en sitemap** | `'/categoria/categoria'` — Marcada como "ruta errónea". Si esta ruta existe como bug, debería arreglarse la ruta, no solo excluirla del sitemap. | **P2** |

### tailwind.config.mjs

| # | Problema | Detalle | Severidad |
|---|---------|---------|-----------|
| 3.6 | **Sin plugin `@tailwindcss/forms` ni `@tailwindcss/typography`** | Muchas páginas usan formularios (login, registro, contacto, checkout). Sin el plugin de forms, los estilos por defecto de inputs nativos no se resetean. | **P3** |
| 3.7 | **Fuentes declaradas pero sin `@import` en layout** | `'Playfair Display'` y `'Inter'` están en `tailwind.config.mjs` pero se cargan via Google Fonts en el Layout.astro. Esto está bien — solo notar que son consistentes. | **OK** |

---

## 4. DATOS INCORRECTOS EN `src/lib/email.ts`

| # | Línea(s) | Dato | Problema | Severidad |
|---|----------|------|----------|-----------|
| 4.1 | L68 | `Calle de la Moda 123, Polígono Industrial, 28001 Madrid` | **Dirección inventada.** Se imprime en la factura PDF que recibe el cliente. "Calle de la Moda" no existe. | **P0** |
| 4.2 | L69 | `NIF: 25384756B` | Verificar si es el NIF real. Si no lo es, la factura sería inválida legalmente. | **P1** |
| 4.3 | L69 | `ibericosrg@gmail.com` | Gmail en la factura. Podría ser correcto si es la dirección real, pero verificar. | **P2** |
| 4.4 | L69 | `+34 670 878 333` | Teléfono en la factura — verificar que sea real. También aparece en `contacto.astro` L201. | **P2** |
| 4.5 | L422, L473, L614 | `Calle de la Moda 123` (x4 más) | Misma dirección falsa repetida en templates de devolución. Los clientes enviarían paquetes a una dirección inexistente. | **P0** |
| 4.6 | L169 | `ibericosrodriguezgonzalez.victoriafp.online` | Dominio en el footer del PDF. Probablemente correcto (es el dominio configurado en `astro.config.mjs`), pero verificar si es el dominio final de producción o solo staging. | **P2** |

**No se encontró** `ibericosrg.com` en los archivos de código (solo en `ERRORES_DETECTADOS.txt`), por lo que ese problema parece ya estar corregido.

---

## 5. PROBLEMAS DE TYPESCRIPT

### `@ts-ignore`

| # | Archivo | Línea | Contexto | Severidad |
|---|---------|-------|----------|-----------|
| 5.1 | `src/pages/admin/dashboard.astro` | L653 | `@ts-ignore` — sin comentario de razón. | **P2** |
| 5.2 | `src/pages/admin/dashboard.astro` | L742 | `@ts-ignore` — sin comentario de razón. | **P2** |
| 5.3 | `src/pages/api/chat.ts` | L78 | `@ts-ignore - Supabase join returns object` — Legítimo, pero se podría tipar correctamente con tipos de Supabase. | **P3** |
| 5.4 | `src/pages/api/chat.ts` | L86 | `@ts-ignore - Supabase join returns object` — Igual que anterior. | **P3** |

### Abuso de `any`

| # | Archivo | Ocurrencias | Severidad |
|---|---------|-------------|-----------|
| 5.5 | `src/pages/api/checkout/validar-y-crear-pedido.ts` | **9 usos de `any`**: `usuarioDatos: any`, `cartItems.map((item: any)`, `variantesDB: any[]`, `productoMap`, `varianteMap`, `ofertaMap`, etc. | **P2** |
| 5.6 | `src/pages/api/pedidos/index.ts` | **4 usos de `any`**: `stripeError: any`, `item: any` (x2), `error: any`. | **P2** |
| 5.7 | `src/pages/api/admin/ingresos-usuarios.ts` | **3 usos de `any`**: `item: any` (x2), `error: any`. | **P2** |
| 5.8 | `src/pages/api/debug-categorias.ts` | **2 usos de `any`**: `categoriaMap: any`, `conteoPoCategoria: any`. | **P3** (archivo de debug) |
| 5.9 | `src/pages/api/debug-variantes.ts` | **3 usos de `any`**: `vars as any[]`, `acc: any, v: any`. | **P3** (archivo de debug) |
| 5.10 | `src/pages/api/productos/lista.ts` | **1 uso**: `categoriaMap: { [key: number]: any }`. | **P3** |
| 5.11 | `src/pages/api/productos/buscar.ts` | **1 uso**: `producto: any`. | **P3** |
| 5.12 | `src/lib/cloudinary.ts` | **2 usos**: `options?: Record<string, any>`, `Promise<any>` en `uploadToCloudinary` y `deleteFromCloudinary`. | **P3** |

### Clientes Supabase duplicados

| # | Archivo | Problema | Severidad |
|---|---------|----------|-----------|
| 5.13 | `src/pages/api/admin/ofertas.ts` | Crea su propio `createClient()` con anon key en lugar de importar `supabaseClient` desde `lib/supabase.ts`. | **P2** |
| 5.14 | `src/pages/api/admin/ofertas/[id].ts` | Ídem — crea su propio cliente Supabase. | **P2** |
| 5.15 | `src/pages/api/ofertas/index.ts` | Ídem — crea su propio cliente con anon key. | **P2** |
| 5.16 | `src/pages/api/admin/setup.ts` | L59: `error.message` sin tipo — `error` está tipado como `unknown` por defecto. | **P3** |

### Supabase fallback inseguro

| # | Archivo | Línea | Problema | Severidad |
|---|---------|-------|----------|-----------|
| 5.17 | `src/lib/supabase.ts` | L3-4 | Fallbacks hardcodeados: `'https://tu-proyecto.supabase.co'` y `'tu-clave-anonima'`. Si las env vars no están configuradas, la app arrancará con credenciales ficticias sin error visible. | **P1** |

---

## 6. ARCHIVOS SQL EN `schema/`

### Resumen: 40 archivos SQL

| Categoría | Archivos | Estado |
|-----------|----------|--------|
| **Schema principal** | `database.sql` | ✅ Base |
| **Migraciones de variantes** | `migration_variantes_productos.sql`, `agregar_variantes_peso_variable.sql`, `add_stock_to_variantes.sql`, `add_cantidad_disponible_variantes.sql` | ⚠️ Posible solapamiento |
| **RLS (Row Level Security)** | `RLS_CARRITO.sql`, `RLS_CATEGORIAS.sql`, `RLS_CODIGOS_PROMOCIONALES.sql`, `RLS_OFERTAS.sql`, `RLS_PEDIDOS.sql`, `RLS_PEDIDOS_V2.sql`, `RLS_PEDIDO_ITEMS.sql`, `RLS_PRODUCTOS.sql`, `RLS_PRODUCTO_VARIANTES.sql`, `RLS_USUARIOS.sql`, `FIX_RLS_PEDIDOS_INVITADOS.sql` | ⚠️ Ver abajo |
| **Pedidos** | `PEDIDOS_SCHEMA.sql`, `crear_pedido_function.sql`, `crear_pedido_invitado_rpc.sql`, `crear_stored_procedure_cancelar_pedido.sql`, `seguimiento_pedidos.sql` | ✅ |
| **Fixes** | `fix_pedido_items_subtotal.sql`, `fix_variantes_precio_centimos.sql`, `limpiar_carritos_duplicados.sql` | Puntuales |
| **Features** | `ofertas_setup.sql`, `CLIENTES_EMPRESARIALES_SETUP.sql`, `crear_codigos_promocionales.sql`, `PRECIOS_EMPRESA_SETUP.sql`, `IVA_SETUP.sql`, `guest_checkout_setup.sql`, `STOCK_FUNCTIONS.sql`, `TRIGGER_ELIMINAR_VARIANTES_VENDIDAS.sql` | ✅ |
| **Alter tables** | `alter_productos_stock_decimal.sql`, `alter_usuarios_estado.sql`, `add_direccion_usuarios.sql`, `add_subcategorias_hierarchy.sql`, `agregar_descuento_pedidos.sql`, `agregar_fecha_actualizacion_pedidos.sql`, `CAMBIAR_FOREIGN_KEY_VARIANTES.sql` | Puntuales |
| **Peligroso** | `DISABLE_RLS_TEMP.sql` | 🔴 Ver abajo |

### Problemas detectados

| # | Archivo(s) | Problema | Severidad |
|---|-----------|----------|-----------|
| 6.1 | `DISABLE_RLS_TEMP.sql` | **Deshabilita RLS** en tabla `usuarios`. Script de diagnóstico que **nunca debería ejecutarse en producción**. Debería eliminarse o moverse a una carpeta `schema/dangerous/`. | **P0** |
| 6.2 | `RLS_PEDIDOS.sql` vs `RLS_PEDIDOS_V2.sql` | Dos versiones de RLS para pedidos. V2 es más completa (incluye invitados). `RLS_PEDIDOS.sql` probablemente es obsoleto. | **P1** |
| 6.3 | `add_stock_to_variantes.sql` vs `add_cantidad_disponible_variantes.sql` | Ambos añaden `cantidad_disponible` a `producto_variantes`, pero con **valores por defecto distintos**: uno usa `DEFAULT 10`, otro usa `DEFAULT 1`. **Contradicción.** | **P1** |
| 6.4 | Sin orden de ejecución | No hay un README ni numeración que indique el **orden correcto** para ejecutar las migraciones. Un desarrollador nuevo no sabría qué ejecutar primero. | **P2** |

---

## 7. ARCHIVOS MARKDOWN EN LA RAÍZ

### Archivos encontrados en la raíz del proyecto:

| Archivo | Contenido | ¿Debería estar en `docs/`? |
|---------|-----------|--------------------------|
| `CANCELACION_DEVOLUCIONES_GUIA.md` | Guía operativa de cancelaciones/devoluciones. Incluye dirección falsa "Calle de la Moda 123". | **Sí → `docs/`** |
| `COMPRA_SIN_LOGIN_SISTEMA_COMPLETO.md` | Documentación del sistema de compra como invitado. | **Sí → `docs/`** |
| `EMAILS_DEVOLUCIONES_NUEVOS.md` | Documentación de templates de email. | **Sí → `docs/`** |
| `ERRORES_DETECTADOS.txt` | Lista de errores encontrados previamente. | **Sí → `docs/`** |
| `FLUTTER_API_CAMBIOS.md` | Documentación de cambios de API para Flutter. | **Sí → `docs/`** |
| `INGRESOS_DASHBOARD_ARREGLADO.md` | Documentación de fix del dashboard. | **Sí → `docs/`** |
| `OFERTAS_SETUP.md` | Guía de configuración de ofertas. | **Sí → `docs/`** |
| `PRODUCTOS_SETUP.md` | Guía de configuración de productos. | **Sí → `docs/`** |
| `SUBCATEGORIAS_IMPLEMENTACION.md` | Documentación de implementación. | **Sí → `docs/`** |
| `SUPABASE_SETUP.md` | Guía de configuración de Supabase. | **Sí → `docs/`** |
| `VINCULACION_PEDIDOS_INVITADOS.md` | Documentación de feature. | **Sí → `docs/`** |
| `README.md` | README principal del proyecto. | **No — se queda en raíz** |

**Severidad: P2** — No son operacionales (son solo documentación), pero ensucian la raíz del proyecto. Todos excepto `README.md` deberían moverse a `docs/`.

---

## RESUMEN EJECUTIVO

| Severidad | Cantidad | Descripción |
|-----------|----------|-------------|
| **P0** | 3 | Dirección falsa en facturas/emails enviados a clientes (5 ocurrencias), script DISABLE_RLS en producción |
| **P1** | 8 | Endpoint de debug que crea datos de prueba en BD, endpoint guardar-producto sin lógica, package.json con descripción incorrecta, fallback de Supabase inseguro, NIF sin verificar, SQL contradictorios, dirección falsa en UI |
| **P2** | 24 | Archivos deprecados accesibles, endpoints de debug/setup en producción, clientes Supabase duplicados, console.log excesivo, `any` en archivos de producción, config issues, MDs en raíz |
| **P3** | 10 | Tipos no usados, carpetas vacías, TS desactualizado, plugins Tailwind faltantes, `any` en archivos de debug |

### Acciones recomendadas (por prioridad)

1. **URGENTE (P0):** Reemplazar "Calle de la Moda 123" con la dirección real del negocio en las 5+ ocurrencias de `email.ts` y `mis-pedidos.astro`. Eliminar `DISABLE_RLS_TEMP.sql`.
2. **IMPORTANTE (P1):** Eliminar endpoints de debug/test (`crear-pedido-prueba.ts`, `guardar-producto.ts`). Corregir descripción de `package.json`. Quitar fallbacks ficticios de `supabase.ts`. Resolver contradicción en `add_stock_to_variantes.sql` vs `add_cantidad_disponible_variantes.sql`. Archivar `RLS_PEDIDOS.sql` (reemplazado por V2).
3. **MEJORA (P2):** Eliminar archivos deprecados (agregar.ts, eliminar.ts, Layout-old.astro). Consolidar clientes Supabase en un solo módulo. Mover MDs a `docs/`. Reducir console.log en producción.
4. **NICE-TO-HAVE (P3):** Tipar correctamente los `any`, actualizar TypeScript, limpiar carpetas vacías.
