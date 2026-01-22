# 🔗 Vinculación de Pedidos de Invitados

## Cómo funciona

Cuando un **invitado compra sin crear cuenta**, sus pedidos se guardan con:
- `usuario_id = NULL`
- `es_invitado = TRUE`
- `email_cliente = su_email@ejemplo.com`

## ¿Qué pasa cuando se registra?

1. **Crea su cuenta** en `/registro`
2. **Automáticamente** se ejecuta la función `vincular_pedidos_invitado`
3. **La función busca** todos los pedidos donde:
   - `email_cliente` = su email
   - `usuario_id IS NULL` (sin usuario)
   - `es_invitado = TRUE`
4. **Vincula esos pedidos** asignando su `usuario_id` y marcando `es_invitado = FALSE`
5. **El usuario ve** todos sus pedidos en `/mis-pedidos`

## Ejemplo

```
ANTES DE REGISTRARSE:
- Juan compra como invitado con juan@email.com → Pedido #1 (usuario_id = NULL)
- Juan compra como invitado con juan@email.com → Pedido #2 (usuario_id = NULL)

DESPUÉS DE REGISTRARSE:
- Juan crea cuenta con juan@email.com
- Sistema ejecuta: vincular_pedidos_invitado(uuid_de_juan, 'juan@email.com')
- Pedido #1 ahora: usuario_id = uuid_de_juan, es_invitado = FALSE
- Pedido #2 ahora: usuario_id = uuid_de_juan, es_invitado = FALSE
- Juan ve ambos pedidos en su dashboard
```

## Instalación

### Paso 1: Ejecutar SQL en Supabase
Ve a `Supabase Dashboard → SQL Editor` y ejecuta:
```sql
-- Copiar todo el contenido de: schema/guest_checkout_setup.sql
```

### Paso 2: El API se actualiza automáticamente
El archivo [src/pages/api/auth/register.ts](../../src/pages/api/auth/register.ts) ya tiene el código para llamar a la función.

## Notas técnicas

- **Función SQL**: `vincular_pedidos_invitado(p_usuario_id UUID, p_email VARCHAR)`
- **Tipo de llamada**: RPC (Remote Procedure Call) desde Supabase
- **Seguridad**: La función tiene `SECURITY DEFINER` para permisos elevados
- **Retorno**: Número de pedidos vinculados (para logging)

## Testeo

Para verificar que funciona:

```sql
-- 1. Ver pedidos de invitado sin usuario
SELECT id, numero_pedido, email_cliente, usuario_id, es_invitado
FROM pedidos
WHERE es_invitado = TRUE AND usuario_id IS NULL;

-- 2. Después de que alguien se registre, ver sus pedidos vinculados
SELECT id, numero_pedido, email_cliente, usuario_id, es_invitado
FROM pedidos
WHERE email_cliente = 'juan@email.com';
```

## Casos especiales

### ¿Qué pasa si alguien se registra con otro email?
- No se vinculan pedidos (emails no coinciden)
- El invitado nunca podrá ver esos pedidos en su cuenta

### ¿Qué pasa si un email se registra dos veces?
- La segunda vez fallará en `auth.signUp` por email duplicado
- No hay problema

### ¿Se pueden deshacer los cambios?
- Sí, volviendo a actualizar manualmente:
```sql
UPDATE pedidos 
SET usuario_id = NULL, es_invitado = TRUE
WHERE id = 123;
```
