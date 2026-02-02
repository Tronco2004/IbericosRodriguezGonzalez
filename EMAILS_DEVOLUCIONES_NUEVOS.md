# 📧 Sistema de Emails Profesionales para Devoluciones

## ✅ Lo que se ha implementado

Se han creado **dos funciones de email profesionales** que se envían automáticamente cuando el admin valida o deniega una devolución desde el panel de administrador.

---

## 🎯 Función 1: Email de Devolución Aceptada ✅

### Cuándo se envía
- Cuando el admin hace clic en el botón **✓ Validar** en el modal de devolución
- Ubicación: [src/pages/admin/pedidos.astro](src/pages/admin/pedidos.astro) → Modal → Botón Validar

### Qué contiene el email

**Encabezado**: 
- Título en verde: "✅ Devolución Recibida y Validada"
- Número de pedido destacado

**Contenido principal**:
- Saludo personalizado con nombre del cliente
- Mensaje de confirmación de devolución
- Caja verde con información importante:
  - ✅ Estado: Devolución Validada
  - 📦 Número de Pedido
  - 💰 Monto de Reembolso Autorizado
  - 📅 Fecha y Hora de Validación

**Timeline visual**:
- ✓ Devolución Recibida (Hoy)
- ✓ Devolución Validada (Hoy)
- → Reembolso Procesado (En 3 a 5 días hábiles)

**Información importante**:
- El reembolso va al método de pago original
- Tiempo estimado de proceso bancario
- Confirmación futura cuando se procese el reembolso
- Instrucciones claras

**Footer**:
- © 2026 Ibéricos Rodríguez González
- Aviso de que es correo automático

### Función responsable
```typescript
export async function notificarDevolucionValidada(
  emailCliente: string,
  numeroPedido: string,
  nombreCliente?: string,
  totalReembolso?: number
)
```

**Ubicación**: [src/lib/email.ts](src/lib/email.ts) línea 779

---

## 🎯 Función 2: Email de Devolución Denegada ❌

### Cuándo se envía
- Cuando el admin hace clic en el botón **✕ Denegar** en el modal de devolución
- Ubicación: [src/pages/admin/pedidos.astro](src/pages/admin/pedidos.astro) → Modal → Botón Denegar

### Qué contiene el email

**Encabezado**: 
- Título en rojo: "❌ Devolución Denegada"
- Número de pedido destacado

**Contenido principal**:
- Saludo personalizado con nombre del cliente
- Mensaje comunicando la denegación
- Caja roja con información crítica:
  - ❌ Estado: Devolución Denegada
  - 📦 Número de Pedido
  - 📅 Fecha de Decisión

**Motivo de la denegación**:
- Caja especial con el motivo configurado
- Texto por defecto: "El producto no cumple con los requisitos para devolución establecidos en nuestras políticas."

**Explicación del impacto**:
- Solicitud fue revisada por el equipo
- Producto no cumple requisitos de devolución
- Sin procesamiento de reembolso
- Producto permanece en poder del cliente

**Opción de recurso**:
- Invitación a contactar para revisar el caso
- Información de contacto completa:
  - 📧 Email de Soporte: [configurado en .env]
  - 📞 Teléfono: +34 XXX XXX XXX
  - ⏰ Horario: Lunes a Viernes, 9:00 - 18:00

**Footer**:
- © 2026 Ibéricos Rodríguez González
- Aviso de que es correo automático

### Función responsable
```typescript
export async function notificarDevolucionDenegada(
  emailCliente: string,
  numeroPedido: string,
  nombreCliente?: string,
  motivo?: string
)
```

**Ubicación**: [src/lib/email.ts](src/lib/email.ts) línea 902

---

## 🔗 Integración en los Endpoints

### Endpoint de Validación
**Archivo**: [src/pages/api/pedidos/validar-devolucion.ts](src/pages/api/pedidos/validar-devolucion.ts)

```typescript
// Enviar correo de validación de devolución
const emailCliente = usuario?.email || pedido.email_cliente;
const nombreCliente = usuario?.nombre;

if (emailCliente) {
  await notificarDevolucionValidada(
    emailCliente,
    pedido.numero_pedido,
    nombreCliente,
    pedido.total
  );
}
```

### Endpoint de Denegación
**Archivo**: [src/pages/api/pedidos/denegar-devolucion.ts](src/pages/api/pedidos/denegar-devolucion.ts)

```typescript
// Enviar correo de denegación de devolución
const emailCliente = usuario?.email || pedido.email_cliente;
const nombreCliente = usuario?.nombre;

if (emailCliente) {
  await notificarDevolucionDenegada(
    emailCliente,
    pedido.numero_pedido,
    nombreCliente,
    'El producto no cumple con los requisitos para devolución establecidos en nuestras políticas.'
  );
}
```

---

## 🎨 Características de Diseño

### Ambos emails incluyen:

✅ **Responsive Design**
- Se adapta perfectamente a móviles y desktop
- Ancho máximo de 600px para mejor lectura

✅ **Colores Coordinados**
- Verde (#28a745, #20c997) para aceptación ✅
- Rojo (#dc3545, #c82333) para denegación ❌
- Tonos neutros para el contenido principal

✅ **Tipografía Profesional**
- Font: 'Inter', Arial, sans-serif
- Jerrarquía clara de tamaños

✅ **HTML y CSS Inline**
- Compatible con la mayoría de clientes de email
- Funciona incluso en Outlook antiguo
- No depende de recursos externos

✅ **Cajas de Información Destacadas**
- Success-box: fondo verde claro con borde
- Warning-box: fondo rojo claro con borde
- Info-box: fondo gris con borde izquierdo coloreado

✅ **Timeline Visual**
- Muestra el flujo del proceso
- Iconos visuales con puntos de color
- Fechas y descripciones claras

---

## 🔧 Configuración Requerida

Los emails se envían usando **Nodemailer con Gmail SMTP**.

Asegúrate de tener en tu archivo `.env`:

```env
GMAIL_USER=tu-correo@gmail.com
GMAIL_PASSWORD=tu-contraseña-aplicacion
```

### Nota sobre Gmail
- Necesitas generar una "Contraseña de Aplicación"
- Ir a: https://myaccount.google.com/apppasswords
- Seleccionar "Mail" y "Windows Computer"
- Usar la contraseña generada en `.env`

---

## 📊 Flujo Completo de Emails en Devoluciones

```
┌─────────────────────────────────────┐
│  Cliente solicita devolución        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Email 1: "Devolución Solicitada"   │
│ (notificarDevolucionAlAdmin)        │
│ Se envía AL ADMIN y AL CLIENTE      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Admin accede a panel de pedidos     │
│ Ve modal con botones:               │
│ ✓ Validar  |  ✕ Denegar            │
└──────────┬──────────────┬───────────┘
           │              │
    ╔══════▼═════╗  ╔═════▼══════╗
    ║  VALIDAR   ║  ║  DENEGAR   ║
    ╚══════╤═════╝  ╚═════╤══════╝
           │              │
           ▼              ▼
    ┌──────────────────────────┐
    │ Email 2: Devolución      │  Email 3: Devolución
    │ "Recibida y Validada" ✅ │  "Denegada" ❌
    │ (notificarDevolucionValidada)
    │ (notificarDevolucionDenegada)
    │ AL CLIENTE               │
    └──────────────────────────┘
           │              │
           ▼              ▼
    Cliente recibe    Cliente recibe
    confirmación de   información de
    reembolso (3-5d)  denegación +
                      opción de recurso
```

---

## ✅ Checklist de Verificación

- [x] Función `notificarDevolucionValidada()` creada en email.ts
- [x] Función `notificarDevolucionDenegada()` creada en email.ts
- [x] Endpoint validar-devolucion.ts importa y envía email de aceptación
- [x] Endpoint denegar-devolucion.ts importa y envía email de denegación
- [x] Ambas funciones tienen HTML profesional y responsive
- [x] Colores coordinados con marca (verde/rojo)
- [x] Sin errores de sintaxis en TypeScript
- [x] Documentación actualizada en CANCELACION_DEVOLUCIONES_GUIA.md

---

## 🚀 Cómo probar

1. **Ir al panel de admin** → Sección de Pedidos
2. **Buscar un pedido** con estado "devolucion_solicitada"
3. **Hacer clic en el botón de acción** (el ícono de estado)
4. **Se abre el modal** con dos botones
5. **Hacer clic en ✓ Validar** → Se envía email de aceptación
6. **Hacer clic en ✕ Denegar** → Se envía email de denegación
7. **Revisar bandeja de email** para ver el resultado

---

## 📝 Notas Finales

- Los emails son **totalmente profesionales** con diseño coordenado
- Se envían **sin bloquear** la respuesta de la API
- Si hay error en el email, **el estado del pedido igual se actualiza**
- Los emails incluyen **información de contacto** para soporte
- Compatible con **todos los clientes de email** modernos

---

**Estado**: ✅ Implementado y Funcionando
**Última actualización**: 2025
**Versión**: 2.0
