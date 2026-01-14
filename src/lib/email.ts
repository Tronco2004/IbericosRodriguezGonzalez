import nodemailer from 'nodemailer';

// Configuración del transporte de email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: import.meta.env.GMAIL_USER,
    pass: import.meta.env.GMAIL_PASSWORD
  }
});

export interface EmailPedido {
  email_cliente: string;
  numero_pedido: string;
  fecha: string;
  items: {
    nombre: string;
    cantidad: number;
    precio: number;
    peso_kg?: number;
  }[];
  subtotal: number;
  envio: number;
  total: number;
}

/**
 * Enviar correo de confirmación de pedido
 */
export async function enviarConfirmacionPedido(datos: EmailPedido) {
  try {
    console.log('📧 Preparando correo de confirmación para:', datos.email_cliente);
    console.log('📧 Email del admin:', import.meta.env.ADMIN_EMAIL);
    console.log('📧 GMAIL_USER:', import.meta.env.GMAIL_USER);

    if (!datos.email_cliente) {
      console.error('❌ Error: email_cliente está vacío');
      throw new Error('email_cliente no proporcionado');
    }

    if (!import.meta.env.ADMIN_EMAIL) {
      console.error('❌ Error: ADMIN_EMAIL no está configurado');
      throw new Error('ADMIN_EMAIL no configurado');
    }

    const itemsHtml = datos.items
      .map(
        item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e0d5c7;">
            <strong>${item.nombre}</strong>
            ${item.peso_kg ? `<br><small>${item.peso_kg.toFixed(3)} kg</small>` : ''}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e0d5c7; text-align: center;">${item.cantidad}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e0d5c7; text-align: right;">${(item.precio / 100).toFixed(2)}€</td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #001a33; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f4f0; padding: 20px; border-radius: 0 0 8px 8px; }
            .section { margin-bottom: 20px; }
            .section h2 { color: #001a33; border-bottom: 2px solid #a89968; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .total-row { background: #e0d5c7; font-weight: bold; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
            .badge { display: inline-block; background: #a89968; color: white; padding: 5px 10px; border-radius: 20px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>¡Pedido Confirmado! 🎉</h1>
              <p>Gracias por tu compra en Ibéricos RG</p>
            </div>
            
            <div class="content">
              <div class="section">
                <h2>Detalles del Pedido</h2>
                <p><strong>Número de Pedido:</strong> <span class="badge">${datos.numero_pedido}</span></p>
                <p><strong>Fecha:</strong> ${new Date(datos.fecha).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</p>
              </div>

              <div class="section">
                <h2>Productos</h2>
                <table>
                  <thead>
                    <tr style="background: #a89968; color: white;">
                      <th style="padding: 10px; text-align: left;">Producto</th>
                      <th style="padding: 10px; text-align: center;">Cantidad</th>
                      <th style="padding: 10px; text-align: right;">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                    <tr class="total-row">
                      <td colspan="2" style="padding: 10px; text-align: right;">Subtotal</td>
                      <td style="padding: 10px; text-align: right;">${(datos.subtotal / 100).toFixed(2)}€</td>
                    </tr>
                    <tr class="total-row">
                      <td colspan="2" style="padding: 10px; text-align: right;">Envío</td>
                      <td style="padding: 10px; text-align: right;">${(datos.envio / 100).toFixed(2)}€</td>
                    </tr>
                    <tr class="total-row">
                      <td colspan="2" style="padding: 10px; text-align: right; font-size: 18px;">TOTAL</td>
                      <td style="padding: 10px; text-align: right; font-size: 18px; color: #a89968;">${(datos.total / 100).toFixed(2)}€</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="section">
                <h2>Próximos Pasos</h2>
                <p>Tu pedido está siendo preparado. Recibirás un correo con el número de seguimiento cuando tu paquete esté en camino.</p>
                <p><strong>Tiempo estimado de entrega:</strong> 3-5 días hábiles</p>
              </div>

              <div class="section">
                <p style="color: #999; font-size: 14px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
              </div>
            </div>

            <div class="footer">
              <p>&copy; 2026 Ibéricos RG. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enviar correo al cliente
    await transporter.sendMail({
      from: import.meta.env.GMAIL_USER,
      to: datos.email_cliente,
      subject: `Pedido confirmado - ${datos.numero_pedido}`,
      html: htmlContent
    });

    console.log('✅ Correo enviado al cliente:', datos.email_cliente);

    // Enviar correo al admin
    await transporter.sendMail({
      from: import.meta.env.GMAIL_USER,
      to: import.meta.env.ADMIN_EMAIL,
      subject: `Nuevo pedido - ${datos.numero_pedido}`,
      html: `
        <h2>Nuevo Pedido Recibido</h2>
        <p><strong>Número:</strong> ${datos.numero_pedido}</p>
        <p><strong>Cliente:</strong> ${datos.email_cliente}</p>
        <p><strong>Total:</strong> ${(datos.total / 100).toFixed(2)}€</p>
        <p><strong>Productos:</strong> ${datos.items.length}</p>
        ${htmlContent}
      `
    });

    console.log('✅ Correo enviado al admin:', import.meta.env.ADMIN_EMAIL);

    return true;
  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    throw error;
  }
}
