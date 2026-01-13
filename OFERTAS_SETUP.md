# Sistema de Ofertas - Documentación

## 📋 Descripción General

El sistema de ofertas permite crear, gestionar y mostrar ofertas especiales en tu tienda online. Las ofertas se muestran automáticamente en:
- Página principal (sección destacada)
- Página dedicada `/ofertas`

## 🗄️ Estructura de Base de Datos

### Tabla: `ofertas`

```sql
CREATE TABLE ofertas (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL REFERENCES productos(id),
  nombre_oferta VARCHAR(200) NOT NULL,
  descripcion TEXT,
  precio_original_centimos INT NOT NULL,
  precio_descuento_centimos INT NOT NULL,
  porcentaje_descuento INT GENERATED ALWAYS AS (...) STORED,
  fecha_inicio TIMESTAMP NOT NULL,
  fecha_fin TIMESTAMP NOT NULL,
  activa BOOLEAN DEFAULT TRUE,
  imagen_url VARCHAR(500),
  orden INT DEFAULT 0,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos importantes:**
- `porcentaje_descuento`: Se calcula automáticamente
- `fecha_inicio` y `fecha_fin`: Define cuándo está activa la oferta
- `orden`: Controla el orden de visualización (menor número = primero)
- `activa`: Permite desactivar sin eliminar

## 🚀 Cómo Usar

### 1. Crear la Tabla en Supabase

Ejecuta el script `ofertas_setup.sql` en tu dashboard de Supabase:

```sql
-- Copia el contenido de ofertas_setup.sql y pégalo en SQL Editor de Supabase
```

### 2. Crear Ofertas (Panel de Admin)

Ve a: `http://localhost:4321/admin/ofertas`

1. Click en "+ Nueva Oferta"
2. Completa el formulario:
   - **Producto**: Selecciona el producto a ofrecer
   - **Nombre de la Oferta**: Ej: "Black Friday 50% Off"
   - **Descripción**: Opcional, para detalles adicionales
   - **Precio Original**: El precio sin descuento (en €)
   - **Precio Descuento**: El precio con descuento (en €)
   - **Fecha Inicio**: Cuándo empieza la oferta
   - **Fecha Fin**: Cuándo termina la oferta
3. Click en "Guardar Oferta"

### 3. Ver Ofertas

Las ofertas activas aparecerán automáticamente en:

- **Página Principal**: Sección "🎉 Ofertas Especiales" después del hero
- **Página Completa**: `http://localhost:4321/ofertas`

## 📊 Endpoints API

### Obtener Ofertas Activas (Público)

```bash
GET /api/ofertas?limit=6
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre_oferta": "Black Friday",
      "precio_original_centimos": 10000,
      "precio_descuento_centimos": 5000,
      "porcentaje_descuento": 50,
      "producto": {
        "id": 1,
        "nombre": "Jamón Ibérico",
        "imagen_url": "https://..."
      }
    }
  ],
  "count": 1
}
```

### Obtener Todas las Ofertas (Admin)

```bash
GET /api/admin/ofertas
```

### Crear Oferta (Admin)

```bash
POST /api/admin/ofertas
Content-Type: application/json

{
  "producto_id": 1,
  "nombre_oferta": "Black Friday",
  "descripcion": "Descuento especial",
  "precio_original_centimos": 10000,
  "precio_descuento_centimos": 5000,
  "fecha_inicio": "2026-01-20T00:00:00Z",
  "fecha_fin": "2026-01-27T23:59:59Z"
}
```

### Actualizar Oferta (Admin)

```bash
PUT /api/admin/ofertas/[id]
Content-Type: application/json

{
  "nombre_oferta": "Updated Name",
  "activa": false
}
```

### Eliminar Oferta (Admin)

```bash
DELETE /api/admin/ofertas/[id]
```

## 🎨 Características

✅ **Descuento automático**: Porcentaje calculado automáticamente
✅ **Validación de fechas**: Solo muestra ofertas dentro del rango activo
✅ **Orden personalizado**: Controla el orden de visualización
✅ **Activar/Desactivar**: Sin necesidad de eliminar
✅ **Imagen personalizada**: Usa imagen propia o la del producto
✅ **Responsive**: Funciona en móvil, tablet y desktop

## 📝 Ejemplo Práctico

1. Tienes un "Jamón Ibérico" en el catálogo (Producto ID: 5)
2. Quieres hacer oferta: 99.99€ → 49.99€ (50% off)
3. Entra en `/admin/ofertas`
4. Crea nueva oferta:
   - Producto: Jamón Ibérico
   - Nombre: "Jamón al 50% Off"
   - Precio original: 99.99
   - Precio descuento: 49.99
   - Fechas: Hoy a Mañana
5. ¡Listo! La oferta aparecerá automáticamente

## 🔧 Personalización

### Modificar cantidad de ofertas en página principal

En `src/pages/index.astro`:
```astro
<OfertasSection limit={6} />  <!-- Cambia 6 por el número que quieras -->
```

### Cambiar estilos

Los estilos están inline en:
- `src/components/OfertasSection.astro` - Sección de la página principal
- `src/pages/admin/ofertas.astro` - Panel de administración

## ⚠️ Consideraciones

- Las ofertas solo se muestran si:
  - `activa = true`
  - Fecha actual está entre `fecha_inicio` y `fecha_fin`
- El descuento debe ser menor que el precio original
- Las fechas se validan automáticamente en la base de datos

## 🚨 Troubleshooting

**Las ofertas no aparecen:**
- Verifica que `activa = true` en la base de datos
- Asegúrate que la fecha actual esté dentro del rango
- Comprueba que el producto existe y está activo

**Error al crear oferta:**
- Asegúrate de seleccionar un producto válido
- Verifica que el precio de descuento sea menor que el original
- Comprueba que la fecha de fin sea posterior a la de inicio

---

¿Preguntas? Revisa los endpoints en los archivos de API.
