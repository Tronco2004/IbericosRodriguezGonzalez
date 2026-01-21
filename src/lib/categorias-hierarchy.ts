/**
 * Funciones auxiliares para manejar la jerarquía de categorías
 */

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  descripcion?: string;
  imagen_url?: string;
  activa: boolean;
  categoria_padre: number | null;
  orden: number;
}

export interface CategoriaConSubcategorias extends Categoria {
  subcategorias?: CategoriaConSubcategorias[];
}

/**
 * Construye un árbol jerárquico de categorías
 * @param categorias - Array plano de categorías
 * @returns Array de categorías con subcategorías anidadas
 */
export function construirArbolCategorias(categorias: Categoria[]): CategoriaConSubcategorias[] {
  // Crear mapa para acceso rápido
  const mapaById = new Map<number, CategoriaConSubcategorias>();
  
  // Inicializar todas las categorías en el mapa
  categorias.forEach(cat => {
    mapaById.set(cat.id, { ...cat, subcategorias: [] });
  });

  // Construir relaciones padre-hijo
  const categoriasPrincipales: CategoriaConSubcategorias[] = [];
  
  categorias.forEach(cat => {
    const categoriaActual = mapaById.get(cat.id)!;
    
    if (cat.categoria_padre === null) {
      // Es categoría principal
      categoriasPrincipales.push(categoriaActual);
    } else {
      // Es subcategoría - agregar a su padre
      const categoriaPadre = mapaById.get(cat.categoria_padre);
      if (categoriaPadre) {
        if (!categoriaPadre.subcategorias) {
          categoriaPadre.subcategorias = [];
        }
        categoriaPadre.subcategorias.push(categoriaActual);
      }
    }
  });

  // Ordenar subcategorías por campo "orden"
  categoriasPrincipales.forEach(cat => {
    if (cat.subcategorias) {
      cat.subcategorias.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    }
  });

  return categoriasPrincipales.sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

/**
 * Obtiene todas las IDs de categorías incluyendo subcategorías
 * @param categoriaId - ID de categoría padre
 * @param categorias - Array de todas las categorías
 * @returns Array de IDs (incluyendo la categoría padre)
 */
export function obtenerIdsCategoriaYSubcategorias(
  categoriaId: number,
  categorias: Categoria[]
): number[] {
  const ids: number[] = [categoriaId];
  
  categorias.forEach(cat => {
    if (cat.categoria_padre === categoriaId) {
      ids.push(cat.id);
    }
  });

  return ids;
}

/**
 * Obtiene la ruta de una categoría (breadcrumb)
 * @param categoriaId - ID de la categoría
 * @param categorias - Array de todas las categorías
 * @returns Array con la ruta desde padre hasta la categoría
 */
export function obtenerRutaCategoria(
  categoriaId: number,
  categorias: Categoria[]
): Categoria[] {
  const ruta: Categoria[] = [];
  let categoriaActual = categorias.find(c => c.id === categoriaId);

  while (categoriaActual) {
    ruta.unshift(categoriaActual);
    if (categoriaActual.categoria_padre) {
      categoriaActual = categorias.find(c => c.id === categoriaActual!.categoria_padre);
    } else {
      break;
    }
  }

  return ruta;
}

/**
 * Obtiene todas las subcategorías de una categoría
 * @param categoriaId - ID de la categoría padre
 * @param categorias - Array de todas las categorías
 * @returns Array de subcategorías
 */
export function obtenerSubcategorias(
  categoriaId: number,
  categorias: Categoria[]
): Categoria[] {
  return categorias
    .filter(cat => cat.categoria_padre === categoriaId && cat.activa)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

/**
 * Verifica si una categoría es principal (sin padre)
 */
export function esCategoriaPrincipal(categoria: Categoria): boolean {
  return categoria.categoria_padre === null;
}

/**
 * Obtiene la categoría padre de una categoría
 */
export function obtenerCategoriaPadre(
  categoriaId: number,
  categorias: Categoria[]
): Categoria | undefined {
  const categoria = categorias.find(c => c.id === categoriaId);
  if (!categoria || !categoria.categoria_padre) return undefined;
  return categorias.find(c => c.id === categoria.categoria_padre);
}
