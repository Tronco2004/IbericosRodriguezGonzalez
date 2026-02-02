import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

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
  codigo_seguimiento?: string;
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
 * Generar PDF de factura
 */
function generarPDFFactura(datos: EmailPedido): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      const buffers: Buffer[] = [];

      doc.on('data', (buffer) => {
        buffers.push(buffer);
      });

      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc.on('error', reject);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('FACTURA', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text('Ibéricos Rodríguez González', { align: 'center' });
      doc.text('Calle de la Moda 123, Polígono Industrial, 28001 Madrid', { align: 'center' });
      doc.text('NIF: XX-XXX-XXX', { align: 'center' });
      doc.moveDown(1);

      // Información del pedido
      doc.fontSize(11).font('Helvetica-Bold').text('INFORMACIÓN DEL PEDIDO', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Número de Pedido: ${datos.numero_pedido}`, { width: 250 });
      doc.text(`Fecha: ${new Date(datos.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, { width: 250 });
      doc.text(`Email Cliente: ${datos.email_cliente}`, { width: 250 });
      doc.moveDown(1);

      // Tabla de productos
      doc.fontSize(11).font('Helvetica-Bold').text('PRODUCTOS PEDIDOS', { underline: true });
      doc.moveDown(0.3);

      // Headers de tabla
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 320;
      const col3 = 380;
      const col4 = 480;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Producto', col1, tableTop);
      doc.text('Cantidad', col2, tableTop);
      doc.text('P. Unitario', col3, tableTop);
      doc.text('Subtotal', col4, tableTop);

      // Línea divisoria
      doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      doc.moveDown(0.5);

      // Productos
      doc.font('Helvetica').fontSize(9);
      let yPosition = doc.y;

      datos.items.forEach((item) => {
        const subtotal = (item.precio * item.cantidad) / 100;
        const precioUnitario = item.precio / 100;

        const productText = item.peso_kg
          ? `${item.nombre} (${item.peso_kg.toFixed(3)} kg)`
          : item.nombre;

        doc.text(productText, col1, yPosition, { width: 200, height: 30 });
        doc.text(item.cantidad.toString(), col2, yPosition, { width: 40, align: 'center' });
        doc.text(`€${precioUnitario.toFixed(2)}`, col3, yPosition, { width: 60, align: 'right' });
        doc.text(`€${subtotal.toFixed(2)}`, col4, yPosition, { width: 60, align: 'right' });

        yPosition += 30;
      });

      // Línea divisoria final
      doc.moveTo(col1, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 10;

      // Totales
      doc.fontSize(10).font('Helvetica');
      doc.text('Subtotal:', col3 - 20, yPosition, { width: 100, align: 'right' });
      doc.text(`€${(datos.subtotal / 100).toFixed(2)}`, col4, yPosition, { width: 60, align: 'right' });

      yPosition += 20;
      doc.text('Envío:', col3 - 20, yPosition, { width: 100, align: 'right' });
      doc.text(`€${(datos.envio / 100).toFixed(2)}`, col4, yPosition, { width: 60, align: 'right' });

      yPosition += 25;
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('TOTAL:', col3 - 20, yPosition, { width: 100, align: 'right' });
      doc.text(`€${(datos.total / 100).toFixed(2)}`, col4, yPosition, { width: 60, align: 'right' });

      // Footer
      doc.moveDown(2);
      doc.fontSize(9).font('Helvetica').text('Gracias por tu compra en Ibéricos Rodríguez González', { align: 'center' });
      doc.text('Este documento es una factura oficial de compra', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
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
            .info-box { background: white; padding: 15px; border-left: 4px solid #a89968; border-radius: 4px; margin: 15px 0; }
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
                ${datos.codigo_seguimiento ? `
                <p><strong>📦 Código de Seguimiento:</strong></p>
                <div style="background: #f0e6d3; padding: 15px; border-radius: 8px; text-align: center; margin: 10px 0;">
                  <span style="font-family: monospace; font-size: 24px; font-weight: bold; color: #001a33; letter-spacing: 2px;">${datos.codigo_seguimiento}</span>
                  <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Guarda este código para rastrear tu pedido</p>
                </div>
                <p style="text-align: center;">
                  <a href="https://ibericosrg.com/seguimiento?codigo=${datos.codigo_seguimiento}" style="display: inline-block; background: #a89968; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Ver estado del pedido</a>
                </p>
                ` : ''}
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

              <div class="info-box">
                <h3 style="margin-top: 0; color: #a89968;">📎 Factura Adjunta</h3>
                <p>Adjunto a este correo encontrarás tu factura en PDF. Guárdala para tus registros.</p>
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

    // Generar PDF de factura
    console.log('📄 Generando PDF de factura...');
    const pdfBuffer = await generarPDFFactura(datos);
    console.log('✅ PDF generado, tamaño:', pdfBuffer.length, 'bytes');

    // Enviar correo al cliente con el PDF adjunto
    await transporter.sendMail({
      from: import.meta.env.GMAIL_USER,
      to: datos.email_cliente,
      subject: `Pedido confirmado - ${datos.numero_pedido}`,
      html: htmlContent,
      attachments: [
        {
          filename: `factura_${datos.numero_pedido}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
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

/**
 * Enviar correo de cancelación de pedido al cliente
 */
export async function enviarEmailCancelacion(
  emailCliente: string,
  numeroPedido: string,
  nombreCliente?: string,
  totalReembolso?: number
) {
  try {
    console.log('📧 Preparando email de cancelación para:', emailCliente);

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
          .info-box { background: #f8f7f4; padding: 15px; border-left: 4px solid #a89968; border-radius: 4px; margin: 15px 0; }
          .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 4px; color: #155724; margin: 15px 0; }
          .footer { background: #f8f7f4; padding: 15px; text-align: center; font-size: 0.85rem; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 1.8rem;">✅ Pedido Cancelado</h1>
            <p style="margin: 5px 0 0 0;">Número de Pedido: ${numeroPedido}</p>
          </div>
          
          <div class="content">
            <div class="section">
              <p>Hola${nombreCliente ? ' ' + nombreCliente : ''},</p>
              <p>Tu pedido ha sido cancelado exitosamente.</p>
            </div>

            <div class="success-box">
              <strong>✅ Estado: Cancelado</strong><br>
              <strong>📦 Número de Pedido:</strong> ${numeroPedido}<br>
              ${totalReembolso ? `<strong>💰 Reembolso:</strong> €${(totalReembolso / 100).toFixed(2)}<br>` : ''}
              <strong>📅 Fecha de Cancelación:</strong> ${new Date().toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>

            <div class="section">
              <h3>Información del Reembolso</h3>
              <p>El importe del pedido se reembolsará a tu método de pago original en un plazo de <strong>3 a 5 días hábiles</strong>. Ten en cuenta que algunos bancos pueden tardar más tiempo en procesar el reembolso.</p>
              <p>Si no ves el reembolso dentro de este tiempo, ponte en contacto con nosotros para investigar.</p>
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0; color: #001a33;">Próximos Pasos</h3>
              <ul style="margin: 10px 0;">
                <li>El stock ha sido restaurado automáticamente</li>
                <li>Tu cuenta refleja la cancelación</li>
                <li>Monitorea tu cuenta bancaria para el reembolso</li>
              </ul>
            </div>

            <div class="section">
              <h3>¿Tenías algún problema?</h3>
              <p>Si cancelaste por algún problema o si podemos ayudarte de otra manera, no dudes en contactarnos. Nos gustaría escuchar tu feedback.</p>
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
      subject: `Confirmación de Cancelación - ${numeroPedido}`,
      html: htmlContent
    });

    console.log('✅ Email de cancelación enviado a:', emailCliente);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de cancelación:', error);
    throw error;
  }
}

/**
 * Notificar al admin sobre una cancelación de pedido
 */
export async function notificarCancelacionAlAdmin(
  numeroPedido: string,
  emailCliente: string,
  nombreCliente?: string,
  totalPedido?: number
) {
  try {
    console.log('📧 Preparando notificación de cancelación para admin:', import.meta.env.ADMIN_EMAIL);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Inter', Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 20px; border: 1px solid #e0d5c7; }
          .alert { background: #f8d7da; border: 1px solid #f5c6cb; border-left: 4px solid #dc3545; padding: 15px; border-radius: 4px; color: #721c24; margin: 15px 0; }
          .info-box { background: #f8f7f4; padding: 15px; border-left: 4px solid #a89968; border-radius: 4px; margin: 15px 0; }
          .footer { background: #f8f7f4; padding: 15px; text-align: center; font-size: 0.85rem; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 1.8rem;">❌ PEDIDO CANCELADO</h1>
            <p style="margin: 5px 0 0 0;">Acción completada</p>
          </div>
          
          <div class="content">
            <div class="alert">
              <strong>🚨 Un cliente ha cancelado su pedido</strong>
            </div>

            <div class="info-box">
              <h3 style="color: #001a33; margin-top: 0;">Detalles de la Cancelación</h3>
              <p style="margin: 5px 0;"><strong>Número de Pedido:</strong> ${numeroPedido}</p>
              <p style="margin: 5px 0;"><strong>Email del Cliente:</strong> ${emailCliente}</p>
              ${nombreCliente ? `<p style="margin: 5px 0;"><strong>Cliente:</strong> ${nombreCliente}</p>` : ''}
              ${totalPedido ? `<p style="margin: 5px 0;"><strong>Total Reembolsado:</strong> €${(totalPedido / 100).toFixed(2)}</p>` : ''}
              <p style="margin: 5px 0;"><strong>Fecha de Cancelación:</strong> ${new Date().toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <h3 style="color: #856404; margin-top: 0;">Acciones Completadas Automáticamente</h3>
              <ul style="color: #856404; margin: 0;">
                <li>✅ Pedido marcado como cancelado</li>
                <li>✅ Stock restaurado al inventario</li>
                <li>✅ Reembolso procesado</li>
                <li>✅ Cliente notificado por email</li>
              </ul>
            </div>

            <div class="info-box">
              <h3 style="color: #001a33; margin-top: 0;">Información Adicional</h3>
              <p style="margin: 5px 0; color: #5c4a3d;">Accede al panel de administración para revisar los detalles completos del pedido y el historial del cliente.</p>
            </div>

            <p style="color: #666; font-size: 0.9rem; margin: 20px 0 0 0;">
              Este es un correo automático del sistema de gestión de pedidos.
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
      subject: `[CANCELACIÓN] Pedido cancelado - ${numeroPedido}`,
      html: htmlContent
    });

    console.log('✅ Notificación de cancelación enviada al admin');
    return true;
  } catch (error) {
    console.error('❌ Error enviando notificación de cancelación al admin:', error);
    throw error;
  }
}

/**
 * Notificar al cliente que su devolución fue recibida y validada
 */
export async function notificarDevolucionValidada(
  emailCliente: string,
  numeroPedido: string,
  nombreCliente?: string,
  totalReembolso?: number
) {
  try {
    console.log('📧 Preparando email de devolución validada para:', emailCliente);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Inter', Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 20px; border: 1px solid #e0d5c7; }
          .section { margin: 20px 0; }
          .section h3 { color: #001a33; margin-top: 0; }
          .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 4px; color: #155724; margin: 15px 0; }
          .info-box { background: #f8f7f4; padding: 15px; border-left: 4px solid #28a745; border-radius: 4px; margin: 15px 0; }
          .timeline { margin: 15px 0; }
          .timeline-item { display: flex; gap: 15px; margin: 10px 0; }
          .timeline-dot { width: 24px; height: 24px; background: #28a745; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; margin-top: 2px; }
          .timeline-content { flex: 1; }
          .footer { background: #f8f7f4; padding: 15px; text-align: center; font-size: 0.85rem; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 1.8rem;">✅ Devolución Recibida y Validada</h1>
            <p style="margin: 5px 0 0 0;">Pedido: ${numeroPedido}</p>
          </div>
          
          <div class="content">
            <div class="section">
              <p>Hola${nombreCliente ? ' ' + nombreCliente : ''},</p>
              <p>¡Buenas noticias! Hemos recibido tu devolución y la hemos validado correctamente.</p>
            </div>

            <div class="success-box">
              <strong>✅ Estado: Devolución Validada</strong><br>
              <strong>📦 Número de Pedido:</strong> ${numeroPedido}<br>
              ${totalReembolso ? `<strong>💰 Reembolso Autorizado:</strong> €${(totalReembolso / 100).toFixed(2)}<br>` : ''}
              <strong>📅 Fecha de Validación:</strong> ${new Date().toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>

            <div class="section">
              <h3>Cronograma de Reembolso</h3>
              <div class="timeline">
                <div class="timeline-item">
                  <div class="timeline-dot">✓</div>
                  <div class="timeline-content">
                    <strong style="color: #001a33;">Devolución Recibida</strong><br>
                    <span style="color: #5c4a3d; font-size: 0.9rem;">Hoy</span>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-dot">✓</div>
                  <div class="timeline-content">
                    <strong style="color: #001a33;">Devolución Validada</strong><br>
                    <span style="color: #5c4a3d; font-size: 0.9rem;">Hoy</span>
                  </div>
                </div>
                <div class="timeline-item">
                  <div style="width: 24px; height: 24px; background: #ccc; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; margin-top: 2px;">→</div>
                  <div class="timeline-content">
                    <strong style="color: #5c4a3d;">Reembolso Procesado</strong><br>
                    <span style="color: #5c4a3d; font-size: 0.9rem;">En 3 a 5 días hábiles</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0; color: #001a33;">Importante</h3>
              <ul style="margin: 10px 0; color: #155724;">
                <li>El reembolso se procesará a tu método de pago original</li>
                <li>Puede tardar 3 a 5 días hábiles en aparecer en tu cuenta bancaria</li>
                <li>Algunos bancos pueden tardar más en procesar la transacción</li>
                <li>Se te enviará una confirmación cuando se procese el reembolso</li>
              </ul>
            </div>

            <div class="section">
              <h3>¿Preguntas?</h3>
              <p>Si tienes alguna duda sobre tu reembolso, no dudes en contactarnos. Estamos aquí para ayudarte.</p>
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
      subject: `Devolución Validada - Reembolso Autorizado - ${numeroPedido}`,
      html: htmlContent
    });

    console.log('✅ Email de devolución validada enviado a:', emailCliente);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de devolución validada:', error);
    throw error;
  }
}

export async function notificarDevolucionDenegada(
  emailCliente: string,
  numeroPedido: string,
  nombreCliente?: string,
  motivo?: string
) {
  try {
    console.log('📧 Preparando email de devolución denegada para:', emailCliente);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Inter', Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 20px; border: 1px solid #e0d5c7; }
          .section { margin: 20px 0; }
          .section h3 { color: #001a33; margin-top: 0; }
          .warning-box { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; color: #721c24; margin: 15px 0; }
          .reason-box { background: #f8f7f4; border-left: 4px solid #dc3545; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .info-box { background: #f8f7f4; padding: 15px; border-left: 4px solid #ff6b6b; border-radius: 4px; margin: 15px 0; }
          .footer { background: #f8f7f4; padding: 15px; text-align: center; font-size: 0.85rem; color: #666; }
          .contact-info { margin: 15px 0; padding: 10px; background: #fff5f5; border-radius: 4px; }
          .contact-info strong { color: #001a33; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 1.8rem;">❌ Devolución Denegada</h1>
            <p style="margin: 5px 0 0 0;">Pedido: ${numeroPedido}</p>
          </div>
          
          <div class="content">
            <div class="section">
              <p>Hola${nombreCliente ? ' ' + nombreCliente : ''},</p>
              <p>Tras revisar tu solicitud de devolución, nos vemos en la necesidad de comunicarte que ha sido denegada.</p>
            </div>

            <div class="warning-box">
              <strong>❌ Estado: Devolución Denegada</strong><br>
              <strong>📦 Número de Pedido:</strong> ${numeroPedido}<br>
              <strong>📅 Fecha de Decisión:</strong> ${new Date().toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>

            ${motivo ? `
            <div class="reason-box">
              <h3 style="margin-top: 0; color: #721c24;">Motivo de la Denegación</h3>
              <p style="margin: 0; color: #721c24;">${motivo}</p>
            </div>
            ` : ''}

            <div class="section">
              <h3>¿Qué significa esto?</h3>
              <ul>
                <li>Tu solicitud de devolución ha sido revisada por nuestro equipo</li>
                <li>El producto no cumple con los requisitos para devolución</li>
                <li>No se procesará reembolso en esta ocasión</li>
                <li>El artículo permanecerá en tu poder</li>
              </ul>
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0; color: #001a33;">¿Tienes dudas?</h3>
              <p>Si crees que esta decisión es incorrecta o tienes más información que aportar, nos gustaría escucharte. Puedes contactarnos para revisar tu caso.</p>
              <div class="contact-info">
                <strong>📧 Email de Soporte:</strong> ${import.meta.env.GMAIL_USER || 'soporte@ibericosrodriguez.es'}<br>
                <strong>📞 Teléfono:</strong> +34 XXX XXX XXX<br>
                <strong>⏰ Horario:</strong> Lunes a Viernes, 9:00 - 18:00
              </div>
            </div>

            <div class="section">
              <h3>Información del Pedido</h3>
              <p>Número de Pedido: <strong>${numeroPedido}</strong></p>
              <p>Si necesitas información adicional sobre tu pedido, por favor, consulta tu panel de cliente.</p>
            </div>
          </div>

          <div class="footer">
            <p>© 2026 Ibéricos Rodríguez González. Todos los derechos reservados.</p>
            <p>Este es un correo automático. Por favor, no respondas directamente a este email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: import.meta.env.GMAIL_USER,
      to: emailCliente,
      subject: `Solicitud de Devolución Denegada - ${numeroPedido}`,
      html: htmlContent
    });

    console.log('✅ Email de devolución denegada enviado a:', emailCliente);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de devolución denegada:', error);
    throw error;
  }
}

