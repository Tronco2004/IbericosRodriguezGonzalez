# ✅ Compra sin iniciar sesión - SISTEMA COMPLETO

## ¿Qué cambió?

### **Antes:** 
❌ Invitados → "Por favor inicia sesión para agregar productos al carrito" → Redirige a /login

### **Ahora:**
✅ Invitados pueden agregar productos sin login → Se guardan en localStorage → Pueden pagar en Stripe → Al registrarse, sus pedidos previos aparecen en su cuenta

---

## 🔧 Cambios implementados

### 1. Frontend - Agregar productos sin login

**Archivos modificados:**
- [src/pages/productos/index.astro](src/pages/productos/index.astro)
- [src/pages/productos/[id].astro](src/pages/productos/[id].astro)

**Lógica:**
```javascript
if (!userId) {
  // Es invitado → Guardar en localStorage
  agregarAlCarritoLocal(...);
  return;
}

// Es usuario logueado → Usar API del servidor
fetch('/api/carrito', { ... });
```

### 2. localStorage del invitado

Estructura de `carrito_invitado`:
```json
[
  {
    "id": 1705945023000,
    "producto_id": 1,
    "nombre": "Jamón Ibérico",
    "precio_unitario": 9999,
    "cantidad": 1,
    "imagen": "https://...",
    "peso_kg": 0.5,
    "fecha_agregado": "2026-01-22T10:30:00Z"
  }
]
```

### 3. Carrito.astro - Leer localStorage de invitados

[src/pages/carrito.astro](src/pages/carrito.astro) ya maneja:
```javascript
if (userId) {
  // Usuario logueado → Cargar desde BD
  const response = await fetch('/api/carrito', { ... });
} else {
  // Invitado → Cargar desde localStorage
  items = getCarritoLocal();
}
```

### 4. Checkout para invitados

**Modal de datos** ([src/pages/carrito.astro](src/pages/carrito.astro)):
- Pide: nombre, email, teléfono
- Guarda en localStorage `checkout_invitado`
- Se envía a Stripe

**API checkout** ([src/pages/api/checkout/create-session.ts](src/pages/api/checkout/create-session.ts)):
- Acepta `datosInvitado`
- Guarda en metadata de Stripe

**Creación de pedido** ([src/pages/api/pedidos/index.ts](src/pages/api/pedidos/index.ts)):
- Parámetro `es_invitado: true`
- `usuario_id = NULL`
- `email_cliente` = email del invitado

### 5. Vinculación automática

**SQL** ([schema/guest_checkout_setup.sql](schema/guest_checkout_setup.sql)):
```sql
CREATE FUNCTION vincular_pedidos_invitado(p_usuario_id UUID, p_email VARCHAR)
```

**API registro** ([src/pages/api/auth/register.ts](src/pages/api/auth/register.ts)):
```typescript
// Después de crear usuario
await supabaseClient.rpc('vincular_pedidos_invitado', {
  p_usuario_id: userId,
  p_email: email
});
```

---

## 📋 Flujo completo

```
1. INVITADO NAVEGA
   └─ No tiene user_id en localStorage
   └─ Ve productos

2. INVITADO AGREGA PRODUCTO
   └─ Click en "Agregar al carrito"
   └─ Se guarda en localStorage (carrito_invitado)
   └─ Aparece notificación "Producto agregado"

3. INVITADO VA AL CARRITO
   └─ Ve carrito desde localStorage
   └─ Puede ajustar cantidades
   └─ Click en "Proceder al Checkout"

4. APARECE MODAL DE DATOS
   └─ Pide: nombre, email, teléfono
   └─ Opción: "¿Ya tienes cuenta? Inicia sesión"

5. INVITADO RELLENA Y CONTINÚA
   └─ Se guarda en localStorage (checkout_invitado)
   └─ Redirige a Stripe

6. PAGA EN STRIPE
   └─ Stripe devuelve a /checkout/exito?guest=true

7. SISTEMA CREA PEDIDO
   └─ usuario_id = NULL
   └─ es_invitado = TRUE
   └─ email_cliente = su_email
   └─ nombre_cliente = su_nombre

8. RECIBE EMAIL
   └─ Confirmación del pedido con número

9. OPCIONAL: SE REGISTRA
   └─ Va a /registro
   └─ Rellena con MISMO EMAIL
   └─ Sistema ejecuta vincular_pedidos_invitado()
   └─ Sus pedidos previos aparecen en su cuenta
   └─ Ahora puede ver todo en /mis-pedidos
```

---

## 🧪 Cómo testear

### Test 1: Agregar sin login
1. Abre navegador en incógnito
2. Ve a `/productos`
3. Agrega un producto
4. Verifica en DevTools → Application → localStorage → `carrito_invitado`

### Test 2: Checkout como invitado
1. Sigue test 1
2. Ve a `/carrito`
3. Aparece modal pidiendo datos
4. Rellena y continúa
5. Verifica que va a Stripe con tu email

### Test 3: Completar pago
1. En Stripe test, usa tarjeta `4242 4242 4242 4242`
2. Fecha: 12/26, CVC: 123
3. Vuelve a `/checkout/exito?guest=true`
4. Sistema crea pedido en BD

### Test 4: Registrarse después
1. Crea nuevo usuario con MISMO EMAIL que usaste como invitado
2. Verifica en BD que se ejecutó `vincular_pedidos_invitado`
3. Inicia sesión
4. Ve a `/mis-pedidos`
5. Deberías ver los pedidos previos del invitado

---

## 🔍 Debugging

**Ver carrito de invitado:**
```javascript
JSON.parse(localStorage.getItem('carrito_invitado'))
```

**Ver datos checkout:**
```javascript
JSON.parse(localStorage.getItem('checkout_invitado'))
```

**Ver si está logueado:**
```javascript
localStorage.getItem('user_id') // null = invitado
```

**Ver pedidos vinculados en BD:**
```sql
SELECT * FROM pedidos 
WHERE email_cliente = 'invitado@email.com'
ORDER BY fecha_creacion DESC;
```

---

## ⚠️ Notas importantes

- El carrito de invitado **NO** se sincroniza entre pestañas
- Al cerrar el navegador, se **pierde** el carrito
- Los invitados **reciben email** de confirmación automáticamente
- Solo los datos de nombre, email y teléfono se guardan
- Si un invitado se registra con OTRO email, los pedidos NO se vinculan
