# Sistema de Subcategorías Jerárquico - Guía de Implementación

## 📋 Resumen
Se ha implementado un sistema de subcategorías jerárquico (2 niveles) que permite agrupar categorías bajo categorías padre. Ej: Lácteos > Mantecas.

---

## 🗄️ 1. MIGRACIÓN DE BASE DE DATOS

### Pasos:
1. Abre tu cliente de Supabase o el editor SQL
2. Ejecuta el script: `schema/add_subcategorias_hierarchy.sql`
3. Verifica que se agreguen las columnas `categoria_padre` y `orden`

**Cambios realizados:**
- ✅ Agregada columna `categoria_padre` (referencia a categorias.id)
- ✅ Agregada columna `orden` (INT, para ordenar subcategorías)
- ✅ Creados índices para optimización

---

## 📂 2. ARCHIVOS CREADOS/MODIFICADOS

### Nuevos archivos:
```
src/lib/categorias-hierarchy.ts          ← Funciones auxiliares para manejar jerarquía
src/components/CategoriaNav.astro        ← Menú de navegación con subcategorías
src/components/CategoriaSelector.astro   ← Selector para admin
src/components/CategoriaBreadcrumb.astro ← Breadcrumb para rutas
schema/add_subcategorias_hierarchy.sql   ← SQL migrations
```

### Archivos modificados:
```
src/pages/api/admin/categorias.ts        ← Agregado soporte para categoria_padre y orden
src/pages/api/productos/buscar.ts        ← Ahora busca en subcategorías también
```

---

## 🔧 3. IMPLEMENTACIÓN EN FRONTEND

### A) En el Header (navegación principal):

```astro
---
import CategoriaNav from '../components/CategoriaNav.astro';

// En tu Layout.astro o header component:
const { data: categorias } = await supabaseClient
  .from('categorias')
  .select('*')
  .eq('activa', true)
  .order('categoria_padre', { ascending: true })
  .order('orden', { ascending: true });
---

<CategoriaNav categorias={categorias} mostrarSubcategorias={true} />
```

### B) En página de producto (añadir breadcrumb):

```astro
---
import CategoriaBreadcrumb from '../components/CategoriaBreadcrumb.astro';

// En la página del producto:
---

<CategoriaBreadcrumb categoriaId={producto.categoria_id} categorias={categorias} />
```

### C) En página de categoría (mostrar filtros):

```astro
---
import { obtenerSubcategorias } from '../lib/categorias-hierarchy';

// Obtener subcategorías de una categoría
const subcategorias = obtenerSubcategorias(categoria.id, todas_las_categorias);
---

<!-- Mostrar como filtros laterales -->
<aside class="filtros">
  {subcategorias.map(subcat => (
    <a href={`?subcategoria=${subcat.slug}`}>{subcat.nombre}</a>
  ))}
</aside>
```

### D) En admin (crear/editar categoría):

```astro
---
import CategoriaSelector from '../components/CategoriaSelector.astro';

// En formulario de categoría:
---

<form>
  <input type="text" name="nombre" placeholder="Nombre de categoría" />
  <input type="text" name="slug" placeholder="slug-unico" />
  
  <!-- Selector de categoría padre -->
  <CategoriaSelector categorias={todasCategorias} valorSeleccionado={null} />
  
  <input type="number" name="orden" placeholder="Orden (0, 1, 2...)" />
  
  <button type="submit">Crear Categoría</button>
</form>
```

---

## 🎨 4. EJEMPLOS DE ESTRUCTURA

Con el sistema implementado, tu menú se verá así:

```
Inicio | Catálogo ▼ | Carrito | Admin
           ↓
    [Jamones]
    [Quesos]
    [Embutidos]
      └─ Taquitos (subcategoría)
    [Lácteos] ▼
      └─ Mantecas (subcategoría)
    [Promociones] ▼
      └─ Paquetes 100g (subcategoría)
```

En página de producto: `Inicio / Lácteos / Mantecas`

---

## 🚀 5. PASOS PARA EMPEZAR

### Paso 1: Ejecutar SQL
```bash
# En Supabase, ejecuta el contenido de:
schema/add_subcategorias_hierarchy.sql
```

### Paso 2: Actualizar Header
1. Abre `src/layouts/Layout.astro`
2. Busca donde renderizas las categorías
3. Reemplaza con el componente `CategoriaNav`

### Paso 3: Crear Subcategorías
1. Ve a `/admin/categorias`
2. Crea las nuevas categorías:
   - Mantecas (padre: Lácteos)
   - Paquetes 100g (padre: Promociones)
   - Taquitos (padre: Embutidos)

### Paso 4: Verificar
- ✅ El menú muestra subcategorías al hover
- ✅ Los breadcrumbs funcionan en productos
- ✅ La búsqueda filtra por categoría y subcategoría

---

## 📊 BASE DE DATOS FINAL

```sql
-- Ver estructura completa:
SELECT 
  c.id,
  c.nombre,
  c.slug,
  c.categoria_padre,
  cp.nombre as padre_nombre,
  c.orden
FROM categorias c
LEFT JOIN categorias cp ON c.categoria_padre = cp.id
ORDER BY c.categoria_padre NULLS FIRST, c.orden ASC;
```

Resultado esperado:
```
id | nombre          | slug          | categoria_padre | padre_nombre | orden
1  | Jamones         | jamones       | NULL            | -            | 1
2  | Quesos          | quesos        | NULL            | -            | 2
3  | Embutidos       | embutidos     | NULL            | -            | 3
4  | Lácteos         | lacteos       | NULL            | -            | 4
5  | Promociones     | promociones   | NULL            | -            | 5
10 | Mantecas        | mantecas      | 4               | Lácteos      | 1
11 | Taquitos        | taquitos      | 3               | Embutidos    | 1
12 | Paquetes 100g   | paquetes-100g | 5               | Promociones  | 1
```

---

## 🔌 API ENDPOINTS

### GET /api/admin/categorias
Devuelve todas las categorías ordenadas por jerarquía:
```json
{
  "success": true,
  "categorias": [
    {
      "id": 1,
      "nombre": "Jamones",
      "slug": "jamones",
      "categoria_padre": null,
      "orden": 1,
      "activa": true
    },
    {
      "id": 10,
      "nombre": "Mantecas",
      "slug": "mantecas",
      "categoria_padre": 4,
      "orden": 1,
      "activa": true
    }
  ]
}
```

### POST /api/admin/categorias
Crear nueva categoría:
```json
{
  "nombre": "Mantecas",
  "slug": "mantecas",
  "descripcion": "Mantecas de cerdo ibérico",
  "categoria_padre": 4,
  "orden": 1
}
```

### PUT /api/admin/categorias
Actualizar categoría:
```json
{
  "id": 10,
  "nombre": "Mantecas Premium",
  "categoria_padre": 4,
  "orden": 2
}
```

---

## ⚠️ NOTAS IMPORTANTES

- **Profundidad**: Sistema de 2 niveles máximo (padre + hijo)
- **Reversible**: Puedes eliminar una subcategoría sin afectar su padre
- **Compatibilidad**: Las categorías antiguas siguen funcionando (categoria_padre = NULL)
- **Búsqueda**: Al buscar por categoría, automáticamente busca también en subcategorías
- **Orden**: El campo `orden` controla el orden de visualización (0, 1, 2...)

---

## 🎯 CHECKLIST FINAL

- [ ] SQL ejecutado en Supabase
- [ ] Componentes creados: CategoriaNav, CategoriaSelector, CategoriaBreadcrumb
- [ ] APIs actualizadas: categorias.ts, buscar.ts
- [ ] Header actualizado con CategoriaNav
- [ ] Admin de categorías muestra selector de padre
- [ ] Subcategorías creadas en DB
- [ ] Menú muestra jerarquía correctamente
- [ ] Breadcrumbs funcionan en productos
- [ ] Búsqueda filtra correctamente por categoría

---

**¿Preguntas?** Revisa los comentarios en los archivos `.astro` y `.ts` para más detalles.
