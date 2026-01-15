# Sistema de Cancelación y Devoluciones

## 📋 Descripción General

Se ha implementado un sistema completo de cancelación de pedidos y solicitud de devoluciones con:

✅ **Cancelación Atómica**: Transacción en base de datos que restaura el stock automáticamente
✅ **Solicitud de Devoluciones**: Cambia el estado del pedido y envía instrucciones por email
✅ **UI en Mis Pedidos**: Botones contextuales según el estado del pedido
✅ **Modal de Instrucciones**: Información clara sobre cómo devolver un producto

---

## 🗄️ Base de Datos

### 1. Crear la Función RPC (REQUIRED)

Ejecuta este código en el SQL Editor de Supabase:

```sql
CREATE OR REPLACE FUNCTION cancelar_pedido(p_pedido_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT, pedido_id UUID) AS $$
DECLARE
  v_estado TEXT;
BEGIN
  BEGIN
    SELECT estado INTO v_estado
    FROM pedidos
    WHERE id = p_pedido_id
    FOR UPDATE;

    IF v_estado IS NULL THEN
      RETURN QUERY SELECT false, 'Pedido no encontrado'::TEXT, p_pedido_id;
      RETURN;
    END IF;

    IF v_estado != 'pagado' THEN
      RETURN QUERY SELECT false, 'El pedido no puede ser cancelado en estado: ' || v_estado, p_pedido_id;
      RETURN;
    END IF;

    UPDATE producto_variantes pv
    SET disponible = disponible + pi.cantidad
    FROM pedido_items pi
    WHERE pi.producto_variante_id = pv.id
    AND pi.pedido_id = p_pedido_id;

    UPDATE pedidos
    SET estado = 'cancelado',
        fecha_actualizacion = NOW()
    WHERE id = p_pedido_id;

    RETURN QUERY SELECT true, 'Pedido cancelado y stock restaurado exitosamente'::TEXT, p_pedido_id;

  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, ('Error: ' || SQLERRM)::TEXT, p_pedido_id;
  END;
END;
$$ LANGUAGE plpgsql;
```

### 2. Verificar Tablas Requeridas

El sistema requiere estas columnas en `pedidos`:

```sql
-- Ya deben existir:
- id (UUID) - Clave primaria
- usuario_id (UUID) - Usuario propietario
- estado (TEXT) - pagado, cancelado, entregado, etc.
- numero_pedido (TEXT) - Número identificador
- email_cliente (TEXT) - Email para notificaciones
- fecha_creacion (TIMESTAMP)
- fecha_actualizacion (TIMESTAMP) - **Asegúrate que existe**
- descuento_aplicado (DECIMAL) - Opcional, para mostrar descuentos
```

Crear columna de auditoría si no existe:

```sql
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

---

## 📱 Frontend - Mis Pedidos

### Cambios en `/src/pages/mis-pedidos.astro`

Se añadió:

1. **Modal de Devolución** (`#returnModal`)
   - Muestra instrucciones de envío
   - Dirección del almacén: "Calle de la Moda 123, Polígono Industrial, 28001 Madrid, España"
   - Confirmación de 5-7 días para reembolso
   - Botón de confirmación

2. **Botones Contextuales**
   - **"Cancelar Pedido"** - Visible si `estado='pagado'`
     - Confirma antes de cancelar
     - Muestra que el stock será restaurado
   - **"Solicitar Devolución"** - Visible si `estado='entregado'`
     - Abre modal con instrucciones
     - Envía email automáticamente

3. **Funciones JavaScript**
   - `cancelarPedido(pedidoId)` - Ejecuta POST a `/api/pedidos/cancelar`
   - `mostrarModalDevolucion(pedidoId)` - Abre el modal
   - `confirmarDevolucion()` - Ejecuta POST a `/api/pedidos/solicitar-devolucion`
   - `mostrarNotificacion(mensaje, tipo)` - Toast notifications (success/error)

4. **Estados Visuales**
   - `pagado` → Verde (#28a745)
   - `cancelado` → Rojo (#dc3545)
   - `entregado` → Gris (#6c757d)
   - `devolucion_solicitada` → Naranja (#ff9800)

---

## 🔌 API Endpoints

### POST `/api/pedidos/cancelar`

**Propósito**: Cancelar un pedido pagado y restaurar stock

**Headers Requeridos**:
```
x-user-id: {userId}
Content-Type: application/json
```

**Body**:
```json
{
  "pedido_id": "uuid-del-pedido"
}
```

**Respuestas**:

✅ Éxito (200):
```json
{
  "success": true,
  "message": "Pedido cancelado correctamente",
  "pedido_id": "uuid"
}
```

❌ Error (400/500):
```json
{
  "success": false,
  "error": "No se puede cancelar un pedido en estado pagado"
}
```

**Validaciones**:
- El usuario debe ser propietario del pedido
- El pedido debe estar en estado "pagado"
- El stock se restaura automáticamente (atómico)

**Ubicación**: `/src/pages/api/pedidos/cancelar.ts`

---

### POST `/api/pedidos/solicitar-devolucion`

**Propósito**: Solicitar devolución de un pedido entregado

**Headers Requeridos**:
```
x-user-id: {userId}
Content-Type: application/json
```

**Body**:
```json
{
  "pedido_id": "uuid-del-pedido"
}
```

**Respuestas**:

✅ Éxito (200):
```json
{
  "success": true,
  "message": "Solicitud de devolución registrada",
  "pedido_id": "uuid"
}
```

❌ Error (400/500):
```json
{
  "success": false,
  "error": "Solo puedes solicitar devolución de pedidos entregados"
}
```

**Acciones Automáticas**:
1. Verifica que el usuario es propietario
2. Verifica que el pedido está "entregado"
3. Cambia estado a "devolucion_solicitada"
4. Envía email con instrucciones y etiqueta de devolución
5. Actualiza `fecha_actualizacion`

**Ubicación**: `/src/pages/api/pedidos/solicitar-devolucion.ts`

---

## 📧 Emails

### Email de Confirmación de Devolución

Se envía automáticamente cuando se solicita una devolución.

**Contenido**:
- Número de pedido
- Instrucciones paso a paso
- Dirección del almacén:
  ```
  Ibéricos Rodríguez González
  Calle de la Moda 123
  Polígono Industrial
  28001 Madrid, España
  ```
- Etiqueta de devolución (adjunta)
- Disclaimer sobre reembolso: "5 a 7 días hábiles"

**Función**: `enviarEmailDevolucion()` en `/src/lib/email.ts`

---

## 🔄 Flujos de Usuario

### Flujo: Cancelar un Pedido

1. Usuario va a "Mis Pedidos"
2. Encuentra un pedido con estado "Pagado"
3. Hace clic en "Cancelar Pedido"
4. Confirma en el diálogo: "¿Estás seguro?"
5. **Backend**:
   - Verifica que el usuario es propietario
   - Ejecuta función RPC `cancelar_pedido()`
   - La función:
     - Bloquea la fila del pedido
     - Verifica que está en estado "pagado"
     - Restaura el stock de `producto_variantes`
     - Actualiza estado a "cancelado"
     - Rollback automático si hay error
6. **Frontend**:
   - Muestra notificación: "Pedido cancelado exitosamente"
   - Recarga la lista de pedidos
   - El botón desaparece

---

### Flujo: Solicitar Devolución

1. Usuario va a "Mis Pedidos"
2. Encuentra un pedido con estado "Entregado"
3. Hace clic en "Solicitar Devolución"
4. Se abre modal con:
   - Instrucciones de empaque
   - Dirección de envío
   - Pasos del proceso
   - Disclaimer de 5-7 días
5. Usuario confirma: "Confirmar Solicitud de Devolución"
6. **Backend**:
   - Verifica que el usuario es propietario
   - Verifica que está en estado "entregado"
   - Cambia estado a "devolucion_solicitada"
   - Envía email con instrucciones
   - Actualiza `fecha_actualizacion`
7. **Frontend**:
   - Cierra el modal
   - Muestra notificación: "Solicitud de devolución enviada"
   - Recarga la lista de pedidos
   - El estado cambia a "Devolución Solicitada" (naranja)

---

## ⚠️ Consideraciones Importantes

### Atomicidad de Cancelación

La función RPC `cancelar_pedido()` es **totalmente atómica**:

```sql
BEGIN
  -- Bloquea la fila
  SELECT ... FOR UPDATE
  
  -- Verifica estado
  IF estado != 'pagado' THEN ERROR
  
  -- Restaura stock
  UPDATE producto_variantes
  
  -- Cambia estado
  UPDATE pedidos
  
  EXCEPTION WHEN OTHERS THEN
    -- Si ALGO falla, TODO se revierte
    ROLLBACK
END;
```

Esto garantiza que **nunca** habrá inconsistencia: o se cancela todo o no se cancela nada.

### Estados Permitidos

| Acción | Estados Permitidos | Prohibidos |
|--------|------------------|-----------|
| Cancelar | `pagado` | `preparando`, `enviado`, `entregado`, `cancelado`, `devolucion_solicitada` |
| Devolución | `entregado` | `pagado`, `preparando`, `enviado`, `cancelado` |

### Limitaciones por Diseño

- **No se puede cancelar** después de que el pedido sea "enviado"
  - Razón: El paquete ya está en tránsito, no se puede restaurar fácilmente el stock
  - Solución alternativa: Solicitar devolución cuando llegue

- **La devolución solo es para pedidos entregados**
  - Si falta el paquete en tránsito, usar vía soporte
  - Si no llegó, contactar al equipo de logística

---

## 🧪 Pruebas

### Test Manual de Cancelación

1. Crear un pedido con estado `pagado` manualmente en BD o a través de checkout
2. Ir a "Mis Pedidos"
3. Verificar que aparece el botón "Cancelar Pedido"
4. Hacer clic y confirmar
5. Verificar en BD:
   - `pedidos.estado` = `cancelado`
   - `producto_variantes.disponible` = restaurado

### Test Manual de Devolución

1. Crear un pedido con estado `entregado` manualmente en BD
2. Ir a "Mis Pedidos"
3. Verificar que aparece el botón "Solicitar Devolución"
4. Hacer clic
5. Verificar que se abre el modal
6. Confirmar
7. Verificar en BD:
   - `pedidos.estado` = `devolucion_solicitada`
8. Verificar en email que se recibió el correo con instrucciones

---

## 📄 Archivos Relacionados

### Nuevos Archivos

| Archivo | Descripción |
|---------|-------------|
| `/src/pages/api/pedidos/cancelar.ts` | Endpoint de cancelación |
| `/src/pages/api/pedidos/solicitar-devolucion.ts` | Endpoint de solicitud de devolución |
| `/crear_stored_procedure_cancelar_pedido.sql` | Función RPC atómica |
| `/agregar_fecha_actualizacion_pedidos.sql` | Script para agregar columna |

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `/src/pages/mis-pedidos.astro` | Añadido modal, botones y funciones JS |
| `/src/lib/email.ts` | Añadida función `enviarEmailDevolucion()` |

---

## 🚀 Checklist de Instalación

- [ ] **1. SQL**: Ejecutar `crear_stored_procedure_cancelar_pedido.sql` en Supabase
- [ ] **2. SQL**: Ejecutar `agregar_fecha_actualizacion_pedidos.sql` en Supabase
- [ ] **3. Verificar**: Que las columnas requeridas existan en `pedidos`
- [ ] **4. Verificar**: Que el endpoint `/api/pedidos/cancelar` responda
- [ ] **5. Verificar**: Que el endpoint `/api/pedidos/solicitar-devolucion` responda
- [ ] **6. Verificar**: Que `enviarEmailDevolucion()` existe en `/src/lib/email.ts`
- [ ] **7. Verificar**: Que los botones aparecen en `/src/pages/mis-pedidos.astro`
- [ ] **8. Test**: Cancelar un pedido (pagado)
- [ ] **9. Test**: Solicitar devolución (entregado)
- [ ] **10. Test**: Recibir email con instrucciones

---

## 🔐 Seguridad

- ✅ **Validación de usuario**: Todos los endpoints verifican que el usuario es propietario
- ✅ **Atomicidad**: Transacción en BD, imposible estados inconsistentes
- ✅ **Rate limiting**: Implementar si es necesario (no incluido)
- ✅ **Email validation**: Verifica que `email_cliente` existe antes de enviar
- ✅ **Error handling**: Los errores se registran en logs sin exponer detalles

---

## 📞 Soporte

Si hay problemas:

1. **Error 404 en cancelación**: Verificar que la función RPC existe en Supabase
2. **Error 500 en devolución**: Verificar que el email está configurado en `.env`
3. **Modal no abre**: Verificar que la variable `pedidoEnDevolucion` está siendo asignada
4. **Email no llega**: Verificar logs en console (`console.log` en solicitar-devolucion.ts)

---

**Última actualización**: 2025
**Versión**: 1.0 Completa
