# Documentación Básica del Proyecto

## 1. Descripción general
Este proyecto es una tienda online de productos ibéricos.
Permite mostrar productos, añadirlos al carrito, realizar pagos online y gestionar pedidos.
Además, incluye un panel de administración para controlar el catálogo y el estado de las compras.

## 2. Objetivo
Ofrecer una experiencia de compra sencilla, rápida y segura para clientes que quieran comprar productos ibéricos desde cualquier dispositivo.

## 3. Funcionalidades principales

### Zona pública
- Página de inicio con productos destacados.
- Catálogo de productos por categorías.
- Página de detalle de cada producto.
- Carrito de compra.
- Aplicación de código de descuento.
- Proceso de checkout y pago online.
- Página de confirmación de compra.
- Seguimiento de pedidos.
- Páginas informativas: contacto, políticas legales y sobre nosotros.

### Zona de cliente
- Registro e inicio de sesión.
- Gestión de perfil.
- Consulta de pedidos realizados.
- Solicitud de cancelación o devolución según el estado del pedido.

### Zona de administración
- Panel con resumen de actividad.
- Gestión de productos.
- Gestión de categorías.
- Gestión de pedidos y actualización de estados.
- Gestión de ofertas y códigos promocionales.
- Gestión de usuarios.

## 4. Cómo funciona una compra (resumen)
1. El usuario entra en la tienda y selecciona productos.
2. Añade los productos al carrito.
3. Puede aplicar un código de descuento si corresponde en el caso de que este autenticado en el caso de que no podra aplicarlcarlo.
4. Realiza el pago en la pasarela de pago.
5. Se confirma la compra y se genera el pedido.
6. El cliente puede ver el pedido en su cuenta o por seguimiento.

## 5. Gestión de precios
El precio final mostrado al cliente incluye:
- Importe de productos.
- Coste de envío.
- Descuento (si hay código promocional válido).

## 6. Tecnologías utilizadas (resumen)
- Astro para la web.
- Supabase para base de datos y usuarios.
- Stripe para pagos.
- Cloudinary para imágenes.
- Servicio de correo para notificaciones por email.

## 7. Correos automáticos
La tienda envía correos automáticos para acciones importantes, como:
- Confirmación de pedido.
- Avisos relacionados con cancelaciones o devoluciones.

## 8. Compatibilidad
La tienda está pensada para funcionar correctamente en:
- Ordenador.
- Tablet.
- Móvil.

## 9. Estructura general del proyecto
- Frontend: páginas y componentes visuales.
- API: lógica de negocio y operaciones internas.
- Base de datos: productos, usuarios, pedidos y promociones.
- Admin: herramientas de gestión interna.

## 10. Estado del proyecto
El sistema está preparado para gestionar el flujo completo de venta online:
- Visualización de catálogo.
- Compra y pago.
- Registro de pedidos.
- Gestión administrativa.