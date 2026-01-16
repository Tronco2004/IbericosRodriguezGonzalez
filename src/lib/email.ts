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

/**
 * Generar HTML de etiqueta de devolución con código QR
 */
function generarEtiquetaDevolucion(numeroPedido: string): string {
  // Generar QR usando API gratuita de QR Server
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=DEVOLUCION-${numeroPedido}`;
  
  return `
    <div style="
      background: white;
      border: 3px dashed #a89968;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
      font-family: 'Courier New', monospace;
    ">
      <h2 style="color: #001a33; margin: 0 0 15px 0; font-size: 1.2rem;">📦 ETIQUETA DE DEVOLUCIÓN</h2>
      
      <div style="background: #f8f7f4; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
        <p style="color: #5c4a3d; margin: 0 0 10px 0; font-size: 0.9rem;">Número de Referencia:</p>
        <p style="color: #001a33; margin: 0; font-weight: bold; font-size: 1.3rem; letter-spacing: 2px;">${numeroPedido}</p>
      </div>
      
      <div style="margin: 20px 0;">
        <img src="${qrUrl}" alt="QR Code" style="width: 200px; height: 200px; border: 2px solid #a89968; padding: 5px; background: white;">
      </div>
      
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; text-align: left; border-radius: 4px;">
        <p style="color: #856404; margin: 0; font-weight: 600;">⚠️ INSTRUCCIONES IMPORTANTES:</p>
        <ol style="color: #856404; margin: 10px 0 0 0; padding-left: 20px;">
          <li>Imprime esta etiqueta</li>
          <li>Pega el código QR o la referencia en el exterior del paquete</li>
          <li>Asegúrate de que sea visible para el transportista</li>
          <li>Usa el número de referencia para seguimiento</li>
        </ol>
      </div>
      
      <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; border-radius: 4px; margin: 15px 0;">
        <p style="color: #2e7d32; margin: 0 0 8px 0; font-weight: 600;">✓ DIRECCIÓN DE ENVÍO:</p>
        <p style="color: #2e7d32; margin: 0; line-height: 1.6;">
          <strong>Ibéricos Rodríguez González</strong><br>
          Calle de la Moda 123<br>
          Polígono Industrial<br>
          28001 Madrid, España<br><br>
          <strong>REF: ${numeroPedido}</strong>
        </p>
      </div>
      
      <p style="color: #666; font-size: 0.85rem; margin: 15px 0 0 0;">
        Guarda el número de referencia para consultar el estado de tu devolución
      </p>
    </div>
  `;
}

/**
 * Enviar correo con instrucciones de devolución
 */
export async function enviarEmailDevolucion(emailCliente: string, numeroPedido: string) {
  try {
    console.log('📧 Preparando email de devolución para:', emailCliente);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Inter', Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #a89968, #8b6f47); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 20px; border: 1px solid #e0d5c7; }
          .section { margin: 20px 0; }
          .section h3 { color: #001a33; margin-top: 0; }
          .address-box { background: #f8f7f4; padding: 15px; border-left: 4px solid #a89968; margin: 15px 0; }
          .disclaimer { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; color: #856404; font-size: 0.9rem; margin: 20px 0; }
          .footer { background: #f8f7f4; padding: 15px; text-align: center; font-size: 0.85rem; color: #666; }
          .button { display: inline-block; background: #a89968; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 1.8rem;">Solicitud de Devolución Recibida</h1>
            <p style="margin: 5px 0 0 0;">Pedido: ${numeroPedido}</p>
          </div>
          
          <div class="content">
            <div class="section">
              <p>Hola,</p>
              <p>Hemos recibido tu solicitud de devolución. Por favor, sigue los pasos a continuación para procesar la devolución de tu pedido.</p>
            </div>

            <div class="section">
              <h3>Instrucciones de Envío de Devolución</h3>
              <p>Por favor, empaqueta el producto en su <strong>embalaje original</strong> (sin abrir si es posible) y envíalo a:</p>
              <div class="address-box">
                <strong>Ibéricos Rodríguez González</strong><br>
                Calle de la Moda 123<br>
                Polígono Industrial<br>
                28001 Madrid, España<br><br>
                <strong>Referencia:</strong> ${numeroPedido}
              </div>
            </div>

            <div class="section">
              ${generarEtiquetaDevolucion(numeroPedido)}
            </div>

            <div class="section">
              <h3>Próximos Pasos</h3>
              <ol>
                <li>Empaca el producto en su embalaje original</li>
                <li>Imprime la etiqueta anterior desde este correo</li>
                <li>Pega la etiqueta (o el código QR) en el exterior del paquete</li>
                <li>Lleva el paquete a tu oficina postal más cercana</li>
                <li>Guarda el número de referencia para seguimiento</li>
              </ol>
            </div>

            <div class="disclaimer">
              <strong>Información Importante:</strong><br>
              Una vez recibido y validado el paquete en nuestros almacenes, el reembolso se procesará en tu método de pago original en un plazo de <strong>5 a 7 días hábiles</strong>. Recibirás un correo de confirmación cuando procesemos tu reembolso.
            </div>

            <div class="section">
              <h3>¿Preguntas?</h3>
              <p>Si tienes alguna duda, no dudes en contactarnos a través de nuestro correo electrónico.</p>
            </div>
          </div>

          <div class="footer">
            <p>© 2026 Ibéricos Rodríguez González. Todos los derechos reservados.</p>
            <p>Este es un correo automático. Por favor, no respondas directamente.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: import.meta.env.GMAIL_USER,
      to: emailCliente,
      subject: `Instrucciones de Devolución - ${numeroPedido}`,
      html: htmlContent
    });

    console.log('✅ Email de devolución enviado a:', emailCliente);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de devolución:', error);
    throw error;
  }
}

/**
 * Notificar al admin sobre una devolución solicitada
 */
export async function notificarDevolucionAlAdmin(
  numeroPedido: string,
  emailCliente: string,
  nombreCliente?: string
) {
  try {
    console.log('📧 Preparando notificación de devolución para admin:', import.meta.env.ADMIN_EMAIL);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Inter', Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #a89968, #8b6f47); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 20px; border: 1px solid #e0d5c7; }
          .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .info-box { background: #f8f7f4; padding: 15px; border-left: 4px solid #a89968; border-radius: 4px; margin: 15px 0; }
          .button { display: inline-block; background: #a89968; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; margin: 10px 0; }
          .footer { background: #f8f7f4; padding: 15px; text-align: center; font-size: 0.85rem; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 1.8rem;">⚠️ NUEVA DEVOLUCIÓN SOLICITADA</h1>
            <p style="margin: 5px 0 0 0;">Acción requerida</p>
          </div>
          
          <div class="content">
            <div class="alert">
              <strong>📦 Un cliente ha solicitado una devolución</strong>
            </div>

            <div class="info-box">
              <h3 style="color: #001a33; margin-top: 0;">Detalles de la Devolución</h3>
              <p style="margin: 5px 0;"><strong>Número de Pedido:</strong> ${numeroPedido}</p>
              <p style="margin: 5px 0;"><strong>Email del Cliente:</strong> ${emailCliente}</p>
              ${nombreCliente ? `<p style="margin: 5px 0;"><strong>Cliente:</strong> ${nombreCliente}</p>` : ''}
              <p style="margin: 5px 0;"><strong>Fecha de Solicitud:</strong> ${new Date().toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>

            <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <h3 style="color: #1565c0; margin-top: 0;">Próximos Pasos:</h3>
              <ol style="color: #1565c0; margin: 0;">
                <li>Monitorear la llegada del paquete al almacén</li>
                <li>Verificar que el producto llegue en buen estado</li>
                <li>Validar el contenido del paquete</li>
                <li>Procesar el reembolso (máximo 5-7 días hábiles)</li>
                <li>Notificar al cliente cuando se apruebe la devolución</li>
              </ol>
            </div>

            <div class="info-box">
              <h3 style="color: #001a33; margin-top: 0;">Información del Almacén:</h3>
              <p style="margin: 5px 0; color: #5c4a3d;">El cliente enviará el paquete a:</p>
              <p style="margin: 5px 0; color: #5c4a3d;">
                <strong>Ibéricos Rodríguez González</strong><br>
                Calle de la Moda 123<br>
                Polígono Industrial<br>
                28001 Madrid, España<br><br>
                <strong>Con referencia:</strong> ${numeroPedido}
              </p>
            </div>

            <p style="color: #666; font-size: 0.9rem; margin: 20px 0 0 0;">
              Este es un correo automático del sistema de gestión de devoluciones. Accede al panel de administración para más detalles.
            </p>
          </div>

          <div class="footer">
            <p>© 2026 Ibéricos Rodríguez González. Sistema de Gestión.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: import.meta.env.GMAIL_USER,
      to: import.meta.env.ADMIN_EMAIL,
      subject: `[DEVOLUCIÓN] Nuevo pedido en devolución - ${numeroPedido}`,
      html: htmlContent
    });

    console.log('✅ Notificación de devolución enviada al admin');
    return true;
  } catch (error) {
    console.error('❌ Error enviando notificación de devolución al admin:', error);
    throw error;
  }
}

