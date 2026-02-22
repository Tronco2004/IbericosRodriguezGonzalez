import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

// Configuración del transporte de email (lazy para asegurar que env vars estén disponibles)
let _transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export function getTransporter() {
  if (!_transporter) {
    const user = import.meta.env.GMAIL_USER;
    const pass = import.meta.env.GMAIL_PASSWORD;
    console.log('📧 Creando transporter con usuario:', user ? user : '⚠️ NO CONFIGURADO');
    console.log('📧 Password configurada:', pass ? 'Sí' : '⚠️ NO');
    
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }
  return _transporter;
}

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

export interface EmailDevolucion {
  email_cliente: string;
  numero_pedido: string;
  fecha_pedido: string;
  nombre_cliente?: string;
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

      doc.on('data', (buffer: Buffer) => {
        buffers.push(buffer);
      });

      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc.on('error', reject);

      // === HEADER CON LÍNEA DECORATIVA ===
      doc.rect(50, 45, 495, 3).fill('#a89968');
      doc.moveDown(0.5);
      
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#001a33').text('Ibéricos Rodríguez González', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica').fillColor('#555');
      doc.text('Calle de la Moda 123, Polígono Industrial, 28001 Madrid', { align: 'center' });
      doc.text('NIF: 25384756B  |  ibericosrg@gmail.com  |  +34 670 878 333', { align: 'center' });
      doc.moveDown(0.5);
      doc.rect(50, doc.y, 495, 1).fill('#e0d5c7');
      doc.moveDown(1);

      // === TÍTULO FACTURA ===
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#a89968').text('FACTURA', { align: 'right' });
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor('#888').text(`Nº ${datos.numero_pedido}`, { align: 'right' });
      doc.moveDown(1);

      // === INFORMACIÓN DEL PEDIDO ===
      doc.fillColor('#001a33');
      doc.fontSize(11).font('Helvetica-Bold').text('DATOS DEL PEDIDO');
      doc.moveDown(0.15);
      doc.rect(50, doc.y, 80, 2).fill('#a89968');
      doc.moveDown(0.4);
      doc.fontSize(9.5).font('Helvetica').fillColor('#333');
      doc.text(`Número de Pedido:   ${datos.numero_pedido}`);
      doc.text(`Fecha:   ${new Date(datos.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`);
      doc.text(`Email Cliente:   ${datos.email_cliente}`);
      doc.moveDown(1.2);

      // === TABLA DE PRODUCTOS ===
      doc.fillColor('#001a33');
      doc.fontSize(11).font('Helvetica-Bold').text('PRODUCTOS');
      doc.moveDown(0.15);
      doc.rect(50, doc.y, 80, 2).fill('#a89968');
      doc.moveDown(0.5);

      // Headers de tabla con fondo
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 270;
      const col3 = 370;
      const col4 = 470;

      // Fondo header tabla
      doc.rect(col1, tableTop - 4, 500, 20).fill('#f5f0e8');
      
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#001a33');
      doc.text('Producto', col1 + 5, tableTop, { width: 200 });
      doc.text('Cant.', col2, tableTop, { width: 70, align: 'center' });
      doc.text('P. Unitario', col3, tableTop, { width: 80, align: 'center' });
      doc.text('Subtotal', col4, tableTop, { width: 75, align: 'center' });

      // Línea bajo header
      doc.moveTo(col1, tableTop + 18).lineTo(545, tableTop + 18).lineWidth(0.5).strokeColor('#a89968').stroke();
      doc.moveDown(0.8);

      // Productos
      doc.font('Helvetica').fontSize(9).fillColor('#333');
      let yPosition = doc.y;

      datos.items.forEach((item) => {
        const subtotal = (item.precio * item.cantidad) / 100;
        const precioUnitario = item.precio / 100;

        const productText = item.peso_kg
          ? `${item.nombre} (${item.peso_kg.toFixed(3)} kg)`
          : item.nombre;

        // Fondo alterno para filas
        const rowIndex = datos.items.indexOf(item);
        if (rowIndex % 2 === 1) {
          doc.rect(col1, yPosition - 3, 500, 26).fill('#faf8f5');
        }

        doc.fillColor('#333').font('Helvetica').fontSize(9);
        doc.text(productText, col1 + 5, yPosition, { width: 200, height: 25 });
        doc.text(item.cantidad.toString(), col2, yPosition, { width: 70, align: 'center' });
        doc.text(`${precioUnitario.toFixed(2)} €`, col3, yPosition, { width: 80, align: 'center' });
        doc.text(`${subtotal.toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

        yPosition += 26;
      });

      // Línea divisoria final
      doc.moveTo(col1, yPosition + 2).lineTo(545, yPosition + 2).lineWidth(0.5).strokeColor('#a89968').stroke();
      yPosition += 18;

      // Totales con diseño mejorado
      doc.fontSize(9.5).font('Helvetica').fillColor('#555');
      doc.text('Subtotal:', col3, yPosition, { width: 80, align: 'right' });
      doc.text(`${(datos.subtotal / 100).toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

      yPosition += 18;
      doc.text('Envío:', col3, yPosition, { width: 80, align: 'right' });
      doc.text(`${(datos.envio / 100).toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

      // === DESGLOSE IVA ===
      yPosition += 18;
      const totalConEnvio = datos.total;
      const baseImponible = totalConEnvio / 1.10;
      const ivaAmount = totalConEnvio - baseImponible;

      doc.text('Base imponible:', col3, yPosition, { width: 80, align: 'right' });
      doc.text(`${(baseImponible / 100).toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

      yPosition += 18;
      doc.text('IVA (10%):', col3, yPosition, { width: 80, align: 'right' });
      doc.text(`${(ivaAmount / 100).toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

      yPosition += 8;
      doc.moveTo(col3, yPosition).lineTo(545, yPosition).lineWidth(0.5).strokeColor('#ccc').stroke();
      yPosition += 10;

      // Total destacado con fondo
      doc.rect(col3 - 5, yPosition - 5, 180, 28).fill('#001a33');
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff');
      doc.text('TOTAL:', col3, yPosition, { width: 80, align: 'right' });
      doc.text(`${(datos.total / 100).toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

      // === FOOTER LIMPIO ===
      const footerY = doc.page.height - 80;
      doc.rect(50, footerY, 495, 1).fill('#e0d5c7');
      doc.fontSize(8).font('Helvetica').fillColor('#999');
      doc.text('Ibéricos Rodríguez González  |  ibericosrodriguezgonzalez.victoriafp.online', 50, footerY + 10, { align: 'center', width: 495 });
      doc.text('Gracias por confiar en nosotros', 50, footerY + 22, { align: 'center', width: 495 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generar PDF de etiqueta de envío para devolución
 */
function generarPDFEtiquetaEnvio(numeroPedido: string, nombreCliente?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [400, 600],
        margin: 30
      });

      const buffers: Buffer[] = [];
      doc.on('data', (buffer: Buffer) => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const codigoEnvio = `DEV-${numeroPedido.replace('PED-', '')}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

      // === BORDE EXTERIOR ===
      doc.rect(10, 10, 380, 580).lineWidth(2).strokeColor('#001a33').stroke();
      doc.rect(13, 13, 374, 574).lineWidth(0.5).strokeColor('#a89968').stroke();

      // === HEADER ===
      doc.rect(20, 20, 360, 50).fill('#001a33');
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff').text('ETIQUETA DE ENVÍO', 30, 32, { width: 340, align: 'center' });
      doc.fontSize(9).fillColor('#a89968').text('DEVOLUCIÓN AUTORIZADA', 30, 52, { width: 340, align: 'center' });

      // === LÍNEA DECORATIVA ===
      doc.rect(20, 75, 360, 3).fill('#a89968');

      // === REMITENTE ===
      let y = 90;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#888').text('REMITENTE:', 30, y);
      y += 14;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#001a33').text(nombreCliente || 'Cliente', 30, y);
      y += 16;
      doc.fontSize(9).font('Helvetica').fillColor('#555').text('(Dirección del cliente)', 30, y);

      // === SEPARADOR ===
      y += 25;
      doc.moveTo(30, y).lineTo(370, y).lineWidth(1).strokeColor('#e0d5c7').dash(5, { space: 3 }).stroke();
      doc.undash();

      // === DESTINATARIO ===
      y += 15;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#888').text('DESTINATARIO:', 30, y);
      y += 14;
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#001a33').text('Ibéricos Rodríguez González', 30, y);
      y += 18;
      doc.fontSize(10).font('Helvetica').fillColor('#333');
      doc.text('Calle de la Moda 123', 30, y);
      y += 14;
      doc.text('Polígono Industrial', 30, y);
      y += 14;
      doc.text('28001 Madrid, España', 30, y);
      y += 14;
      doc.text('Tel: +34 670 878 333', 30, y);

      // === SEPARADOR ===
      y += 25;
      doc.moveTo(30, y).lineTo(370, y).lineWidth(1).strokeColor('#e0d5c7').dash(5, { space: 3 }).stroke();
      doc.undash();

      // === DATOS DEL ENVÍO ===
      y += 15;
      doc.rect(25, y - 5, 350, 80).lineWidth(1).strokeColor('#a89968').stroke();

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#888').text('REFERENCIA DE ENVÍO:', 35, y + 3);
      y += 16;
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#001a33').text(codigoEnvio, 35, y, { width: 330, align: 'center' });
      y += 24;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#888').text('PEDIDO ORIGINAL:', 35, y);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#001a33').text(numeroPedido, 160, y);
      y += 16;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#888').text('FECHA:', 35, y);
      doc.fontSize(10).font('Helvetica').fillColor('#333').text(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }), 160, y);

      // === CÓDIGO DE BARRAS SIMULADO ===
      y += 40;
      const barcodeY = y;
      const barcodeX = 80;
      const barcodeWidth = 240;
      const barCount = 50;
      const barWidth = barcodeWidth / barCount;

      // Generar barras pseudoaleatorias basadas en el código
      let seed = 0;
      for (let i = 0; i < codigoEnvio.length; i++) {
        seed += codigoEnvio.charCodeAt(i);
      }

      for (let i = 0; i < barCount; i++) {
        const thick = ((seed * (i + 1) * 7) % 3) + 1;
        const gap = ((seed * (i + 1) * 13) % 2) + 1;
        if (i % gap === 0) {
          doc.rect(barcodeX + (i * barWidth), barcodeY, barWidth * thick * 0.4, 50).fill('#000000');
        }
      }

      // Texto debajo del código de barras
      doc.fontSize(9).font('Helvetica').fillColor('#333').text(codigoEnvio, barcodeX, barcodeY + 55, { width: barcodeWidth, align: 'center' });

      // === INSTRUCCIONES ===
      y = barcodeY + 80;
      doc.rect(25, y, 350, 60).fill('#faf7f2');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#001a33').text('INSTRUCCIONES:', 35, y + 8);
      doc.fontSize(7.5).font('Helvetica').fillColor('#555');
      doc.text('1. Imprima esta etiqueta y péguela en el paquete de devolución.', 35, y + 22, { width: 330 });
      doc.text('2. Asegúrese de que los productos estén bien embalados.', 35, y + 33, { width: 330 });
      doc.text('3. Entregue el paquete en cualquier oficina de correos o punto de recogida.', 35, y + 44, { width: 330 });

      // === FOOTER ===
      const footerY = 560;
      doc.rect(20, footerY, 360, 25).fill('#001a33');
      doc.fontSize(7).font('Helvetica').fillColor('#a89968').text('Ibéricos Rodríguez González  |  ibericosrodriguezgonzalez.victoriafp.online', 30, footerY + 8, { width: 340, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generar PDF de factura rectificativa (nota de crédito)
 */
function generarPDFFacturaRectificativa(datos: EmailDevolucion): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      const buffers: Buffer[] = [];

      doc.on('data', (buffer: Buffer) => {
        buffers.push(buffer);
      });

      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc.on('error', reject);

      // === HEADER CON LÍNEA DECORATIVA ===
      doc.rect(50, 45, 495, 3).fill('#a89968');
      doc.moveDown(0.5);
      
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#001a33').text('Ibéricos Rodríguez González', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica').fillColor('#555');
      doc.text('Calle de la Moda 123, Polígono Industrial, 28001 Madrid', { align: 'center' });
      doc.text('NIF: 25384756B  |  ibericosrg@gmail.com  |  +34 670 878 333', { align: 'center' });
      doc.moveDown(0.5);
      doc.rect(50, doc.y, 495, 1).fill('#e0d5c7');
      doc.moveDown(1);

      // === TÍTULO FACTURA RECTIFICATIVA ===
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#dc3545').text('FACTURA RECTIFICATIVA', { align: 'right' });
      doc.moveDown(0.2);
      doc.fontSize(10).font('Helvetica').fillColor('#dc3545').text('(Nota de Crédito)', { align: 'right' });
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor('#888').text(`Ref. Factura Original: ${datos.numero_pedido}`, { align: 'right' });
      const rectNum = `RECT-${datos.numero_pedido.replace('PED-', '')}`;
      doc.text(`Nº Rectificativa: ${rectNum}`, { align: 'right' });
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'right' });
      doc.moveDown(1);

      // === MOTIVO DE RECTIFICACIÓN ===
      doc.fillColor('#001a33');
      doc.fontSize(11).font('Helvetica-Bold').text('MOTIVO DE RECTIFICACIÓN');
      doc.moveDown(0.15);
      doc.rect(50, doc.y, 120, 2).fill('#dc3545');
      doc.moveDown(0.4);
      doc.fontSize(9.5).font('Helvetica').fillColor('#333');
      doc.text('Devolución de productos del pedido original.');
      doc.moveDown(1);

      // === INFORMACIÓN DEL PEDIDO ORIGINAL ===
      doc.fillColor('#001a33');
      doc.fontSize(11).font('Helvetica-Bold').text('DATOS DEL PEDIDO ORIGINAL');
      doc.moveDown(0.15);
      doc.rect(50, doc.y, 80, 2).fill('#a89968');
      doc.moveDown(0.4);
      doc.fontSize(9.5).font('Helvetica').fillColor('#333');
      doc.text(`Número de Pedido Original:   ${datos.numero_pedido}`);
      doc.text(`Fecha Pedido Original:   ${new Date(datos.fecha_pedido).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`);
      doc.text(`Email Cliente:   ${datos.email_cliente}`);
      if (datos.nombre_cliente) {
        doc.text(`Cliente:   ${datos.nombre_cliente}`);
      }
      doc.moveDown(1.2);

      // === TABLA DE PRODUCTOS DEVUELTOS ===
      doc.fillColor('#001a33');
      doc.fontSize(11).font('Helvetica-Bold').text('PRODUCTOS DEVUELTOS');
      doc.moveDown(0.15);
      doc.rect(50, doc.y, 120, 2).fill('#dc3545');
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 270;
      const col3 = 370;
      const col4 = 470;

      // Fondo header tabla
      doc.rect(col1, tableTop - 4, 500, 20).fill('#fce4e4');
      
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#721c24');
      doc.text('Producto', col1 + 5, tableTop, { width: 200 });
      doc.text('Cant.', col2, tableTop, { width: 70, align: 'center' });
      doc.text('P. Unitario', col3, tableTop, { width: 80, align: 'center' });
      doc.text('Importe', col4, tableTop, { width: 75, align: 'center' });

      doc.moveTo(col1, tableTop + 18).lineTo(545, tableTop + 18).lineWidth(0.5).strokeColor('#dc3545').stroke();
      doc.moveDown(0.8);

      doc.font('Helvetica').fontSize(9).fillColor('#333');
      let yPosition = doc.y;

      datos.items.forEach((item, rowIndex) => {
        const subtotal = (item.precio * item.cantidad) / 100;
        const precioUnitario = item.precio / 100;

        const productText = item.peso_kg
          ? `${item.nombre} (${item.peso_kg.toFixed(3)} kg)`
          : item.nombre;

        if (rowIndex % 2 === 1) {
          doc.rect(col1, yPosition - 3, 500, 26).fill('#fef5f5');
        }

        doc.fillColor('#333').font('Helvetica').fontSize(9);
        doc.text(productText, col1 + 5, yPosition, { width: 200, height: 25 });
        doc.text(item.cantidad.toString(), col2, yPosition, { width: 70, align: 'center' });
        doc.text(`${precioUnitario.toFixed(2)} €`, col3, yPosition, { width: 80, align: 'center' });
        doc.fillColor('#dc3545').font('Helvetica-Bold');
        doc.text(`-${subtotal.toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

        yPosition += 26;
      });

      doc.moveTo(col1, yPosition + 2).lineTo(545, yPosition + 2).lineWidth(0.5).strokeColor('#dc3545').stroke();
      yPosition += 18;

      // Totales negativos
      doc.fontSize(9.5).font('Helvetica').fillColor('#555');
      doc.text('Subtotal:', col3, yPosition, { width: 80, align: 'right' });
      doc.fillColor('#dc3545').font('Helvetica-Bold');
      doc.text(`-${(datos.subtotal / 100).toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

      yPosition += 18;
      doc.font('Helvetica').fillColor('#555');
      doc.text('Envío:', col3, yPosition, { width: 80, align: 'right' });
      doc.fillColor('#dc3545').font('Helvetica-Bold');
      doc.text(`-${(datos.envio / 100).toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

      // Desglose IVA
      yPosition += 18;
      const totalDevolucion = datos.total / 100;
      const baseImponibleRect = totalDevolucion / 1.10;
      const ivaAmountRect = totalDevolucion - baseImponibleRect;
      doc.font('Helvetica').fillColor('#555');
      doc.text('Base imponible:', col3, yPosition, { width: 80, align: 'right' });
      doc.fillColor('#dc3545').font('Helvetica-Bold');
      doc.text(`-${baseImponibleRect.toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });
      yPosition += 16;
      doc.font('Helvetica').fillColor('#555');
      doc.text('IVA (10%):', col3, yPosition, { width: 80, align: 'right' });
      doc.fillColor('#dc3545').font('Helvetica-Bold');
      doc.text(`-${ivaAmountRect.toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

      yPosition += 8;
      doc.moveTo(col3, yPosition).lineTo(545, yPosition).lineWidth(0.5).strokeColor('#ccc').stroke();
      yPosition += 10;

      // Total a devolver destacado
      doc.rect(col3 - 5, yPosition - 5, 180, 28).fill('#dc3545');
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff');
      doc.text('A DEVOLVER:', col3, yPosition, { width: 80, align: 'right' });
      doc.text(`-${(datos.total / 100).toFixed(2)} €`, col4, yPosition, { width: 75, align: 'center' });

      // === AVISO LEGAL ===
      yPosition += 50;
      doc.fontSize(8).font('Helvetica').fillColor('#888');
      doc.text('Esta factura rectificativa anula parcial o totalmente la factura original referenciada.', 50, yPosition, { width: 495, align: 'center' });
      doc.text('El importe será reembolsado al método de pago original del cliente.', 50, yPosition + 12, { width: 495, align: 'center' });

      // === FOOTER ===
      const footerY = doc.page.height - 80;
      doc.rect(50, footerY, 495, 1).fill('#e0d5c7');
      doc.fontSize(8).font('Helvetica').fillColor('#999');
      doc.text('Ibéricos Rodríguez González  |  ibericosrodriguezgonzalez.victoriafp.online', 50, footerY + 10, { align: 'center', width: 495 });
      doc.text('Factura Rectificativa - Documento válido a efectos fiscales', 50, footerY + 22, { align: 'center', width: 495 });

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
        (item, idx) => `
        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#faf7f2'};">
          <td style="padding: 12px 15px; border-bottom: 1px solid #f0ebe3;">
            <span style="font-weight: 600; color: #001a33; font-size: 14px;">${item.nombre}</span>
            ${item.peso_kg ? `<br><span style="color: #999; font-size: 12px;">${item.peso_kg.toFixed(3)} kg</span>` : ''}
          </td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #f0ebe3; text-align: center; color: #555; font-size: 14px;">${item.cantidad}</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #f0ebe3; text-align: right; color: #333; font-size: 14px; font-weight: 500;">${(item.precio / 100).toFixed(2)} €</td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f2ede6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f2ede6; padding: 30px 0;">
            <tr><td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                
                <!-- BARRA DORADA SUPERIOR -->
                <tr><td style="background: linear-gradient(90deg, #a89968, #c4b07d, #a89968); height: 5px;"></td></tr>
                
                <!-- HEADER -->
                <tr><td style="background: #001a33; padding: 35px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">Pedido Confirmado</h1>
                  <p style="margin: 8px 0 0 0; color: #a89968; font-size: 15px; font-weight: 500;">Gracias por tu compra en Ibéricos Rodríguez González</p>
                </td></tr>
                
                <!-- CONTENIDO PRINCIPAL -->
                <tr><td style="padding: 35px 40px;">
                  
                  <!-- DETALLES DEL PEDIDO -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                    <tr><td>
                      <h2 style="margin: 0 0 15px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #a89968; padding-bottom: 8px;">Detalles del Pedido</h2>
                      <table role="presentation" width="100%" cellpadding="8" cellspacing="0">
                        <tr>
                          <td style="color: #888; font-size: 13px; width: 140px;">Nº de Pedido</td>
                          <td style="font-weight: 600; color: #001a33; font-size: 13px;">${datos.numero_pedido}</td>
                        </tr>
                        <tr>
                          <td style="color: #888; font-size: 13px;">Fecha</td>
                          <td style="color: #333; font-size: 13px;">${new Date(datos.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                  
                  ${datos.codigo_seguimiento ? `
                  <!-- CÓDIGO DE SEGUIMIENTO -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px; background: #faf7f2; border-radius: 8px; border: 1px solid #e8e0d4;">
                    <tr><td style="padding: 20px; text-align: center;">
                      <p style="margin: 0 0 8px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Código de Seguimiento</p>
                      <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 26px; font-weight: 700; color: #001a33; letter-spacing: 3px;">${datos.codigo_seguimiento}</p>
                      <p style="margin: 15px 0 0 0;">
                        <a href="https://ibericosrodriguezgonzalez.victoriafp.online/seguimiento?codigo=${datos.codigo_seguimiento}" style="display: inline-block; background: #a89968; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Rastrear Pedido</a>
                      </p>
                    </td></tr>
                  </table>
                  ` : ''}
                  
                  <!-- PRODUCTOS -->
                  <h2 style="margin: 0 0 15px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #a89968; padding-bottom: 8px;">Productos</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                    <thead>
                      <tr style="background: #001a33;">
                        <th style="padding: 12px 15px; text-align: left; color: #ffffff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 6px 0 0 0;">Producto</th>
                        <th style="padding: 12px 10px; text-align: center; color: #ffffff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Cant.</th>
                        <th style="padding: 12px 15px; text-align: right; color: #ffffff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 0 6px 0 0;">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                    </tbody>
                  </table>
                  
                  <!-- RESUMEN DE PRECIOS -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 6px 15px; text-align: right; color: #888; font-size: 13px;">Subtotal</td>
                      <td style="padding: 6px 15px; text-align: right; color: #333; font-size: 13px; width: 100px;">${(datos.subtotal / 100).toFixed(2)} €</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 15px; text-align: right; color: #888; font-size: 13px;">Envío</td>
                      <td style="padding: 6px 15px; text-align: right; color: #333; font-size: 13px;">${(datos.envio / 100).toFixed(2)} €</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding: 5px 15px;"><hr style="border: none; border-top: 1px solid #e0d5c7; margin: 0;"></td>
                    </tr>
                    <tr style="background: #001a33; border-radius: 6px;">
                      <td style="padding: 14px 15px; text-align: right; color: #ffffff; font-size: 16px; font-weight: 700; border-radius: 6px 0 0 6px;">TOTAL</td>
                      <td style="padding: 14px 15px; text-align: right; color: #a89968; font-size: 18px; font-weight: 700; border-radius: 0 6px 6px 0;">${(datos.total / 100).toFixed(2)} €</td>
                    </tr>
                  </table>
                  
                  <!-- FACTURA ADJUNTA -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px; background: #faf7f2; border-left: 4px solid #a89968; border-radius: 0 8px 8px 0;">
                    <tr><td style="padding: 18px 20px;">
                      <p style="margin: 0 0 5px 0; font-weight: 700; color: #001a33; font-size: 14px;">Factura Adjunta</p>
                      <p style="margin: 0; color: #666; font-size: 13px;">Encontrarás tu factura en PDF adjunta a este correo. Guárdala para tus registros.</p>
                    </td></tr>
                  </table>
                  
                  <!-- PRÓXIMOS PASOS -->
                  <h2 style="margin: 0 0 12px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #a89968; padding-bottom: 8px;">Próximos Pasos</h2>
                  <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">Tu pedido está siendo preparado con cuidado. Te avisaremos cuando esté en camino.</p>
                  <p style="color: #555; font-size: 14px; margin: 0;"><strong style="color: #001a33;">Entrega estimada:</strong> 3-5 días hábiles</p>
                  
                </td></tr>
                
                <!-- FOOTER -->
                <tr><td style="background: #001a33; padding: 25px 40px; text-align: center;">
                  <p style="margin: 0 0 5px 0; color: #a89968; font-size: 14px; font-weight: 600;">Ibéricos Rodríguez González</p>
                  <p style="margin: 0 0 12px 0; color: #667788; font-size: 12px;">Productos ibéricos de calidad desde nuestra dehesa a tu mesa</p>
                  <p style="margin: 0; color: #4a5568; font-size: 11px;">&copy; 2026 Ibéricos RG. Todos los derechos reservados.</p>
                </td></tr>
                
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `;

    // Generar PDF de factura
    console.log('📄 Generando PDF de factura...');
    const pdfBuffer = await generarPDFFactura(datos);
    console.log('✅ PDF generado, tamaño:', pdfBuffer.length, 'bytes');

    // Enviar correo al cliente con el PDF adjunto
    await getTransporter().sendMail({
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

    // Enviar correo al admin con la factura adjunta
    await getTransporter().sendMail({
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
      `,
      attachments: [
        {
          filename: `factura_${datos.numero_pedido}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
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
      <h2 style="color: #001a33; margin: 0 0 15px 0; font-size: 1.2rem;">ETIQUETA DE DEVOLUCIÓN</h2>
      
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
 * Enviar correo con instrucciones de devolución y factura rectificativa
 */
export async function enviarEmailDevolucion(emailCliente: string, numeroPedido: string, datosDevolucion?: EmailDevolucion) {
  try {
    console.log('📧 Preparando email de devolución para:', emailCliente);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f2ede6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f2ede6; padding: 30px 0;">
          <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <tr><td style="background: linear-gradient(90deg, #a89968, #c4b07d, #a89968); height: 5px;"></td></tr>
              
              <tr><td style="background: linear-gradient(135deg, #a89968, #8b6f47); padding: 35px 40px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Solicitud de Devolución Recibida</h1>
                <p style="margin: 8px 0 0 0; color: #f0e6d3; font-size: 14px;">Pedido: ${numeroPedido}</p>
              </td></tr>
              
              <tr><td style="padding: 35px 40px;">
                
                <p style="color: #555; font-size: 15px; line-height: 1.6;">Hola, hemos recibido tu solicitud de devolución. Sigue los pasos a continuación para completar el proceso.</p>
                
                <!-- INSTRUCCIONES -->
                <h2 style="margin: 25px 0 15px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #a89968; padding-bottom: 8px;">Instrucciones</h2>
                <p style="color: #555; font-size: 14px; line-height: 1.6;">Empaqueta el producto en su <strong style="color: #001a33;">embalaje original</strong> (sin abrir si es posible) y envíalo a:</p>
                
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #faf7f2; border-left: 4px solid #a89968; border-radius: 0 8px 8px 0; margin: 15px 0;">
                  <tr><td style="padding: 18px 20px;">
                    <p style="margin: 0; font-weight: 700; color: #001a33; font-size: 14px;">Ibéricos Rodríguez González</p>
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 13px; line-height: 1.6;">Calle de la Moda 123<br>Polígono Industrial<br>28001 Madrid, España</p>
                    <p style="margin: 10px 0 0 0; font-weight: 600; color: #a89968; font-size: 13px;">Referencia: ${numeroPedido}</p>
                  </td></tr>
                </table>
                
                <!-- ETIQUETA -->
                ${generarEtiquetaDevolucion(numeroPedido)}
                
                <!-- PASOS -->
                <h2 style="margin: 25px 0 15px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #a89968; padding-bottom: 8px;">Próximos Pasos</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding: 8px 0;"><span style="display: inline-block; background: #a89968; color: #fff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700; margin-right: 10px;">1</span><span style="color: #333; font-size: 14px;">Empaca el producto en su embalaje original</span></td></tr>
                  <tr><td style="padding: 8px 0;"><span style="display: inline-block; background: #a89968; color: #fff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700; margin-right: 10px;">2</span><span style="color: #333; font-size: 14px;">Imprime la etiqueta de devolución</span></td></tr>
                  <tr><td style="padding: 8px 0;"><span style="display: inline-block; background: #a89968; color: #fff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700; margin-right: 10px;">3</span><span style="color: #333; font-size: 14px;">Pega la etiqueta o código QR en el paquete</span></td></tr>
                  <tr><td style="padding: 8px 0;"><span style="display: inline-block; background: #a89968; color: #fff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700; margin-right: 10px;">4</span><span style="color: #333; font-size: 14px;">Lleva el paquete a tu oficina postal</span></td></tr>
                </table>
                
                <!-- AVISO IMPORTANTE -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fff8e1; border-left: 4px solid #f5c518; border-radius: 0 8px 8px 0; margin: 25px 0;">
                  <tr><td style="padding: 18px 20px;">
                    <p style="margin: 0 0 5px 0; font-weight: 700; color: #8b6f00; font-size: 14px;">Información Importante</p>
                    <p style="margin: 0; color: #7a6200; font-size: 13px; line-height: 1.6;">Tras recibir y validar el paquete, el reembolso se procesará en tu método de pago original en <strong>5 a 7 días hábiles</strong>.</p>
                  </td></tr>
                </table>
                
              </td></tr>
              
              <tr><td style="background: #001a33; padding: 25px 40px; text-align: center;">
                <p style="margin: 0 0 5px 0; color: #a89968; font-size: 14px; font-weight: 600;">Ibéricos Rodríguez González</p>
                <p style="margin: 0; color: #4a5568; font-size: 11px;">&copy; 2026 Ibéricos RG. Todos los derechos reservados.</p>
              </td></tr>
              
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    // Generar PDF de factura rectificativa si hay datos disponibles
    let attachments: any[] = [];
    if (datosDevolucion) {
      try {
        console.log('📄 Generando PDF de factura rectificativa para devolución...');
        const pdfRectificativa = await generarPDFFacturaRectificativa(datosDevolucion);
        console.log('✅ PDF rectificativa generado, tamaño:', pdfRectificativa.length, 'bytes');
        attachments.push({
          filename: `factura_rectificativa_${numeroPedido}.pdf`,
          content: pdfRectificativa,
          contentType: 'application/pdf'
        });
      } catch (pdfError) {
        console.error('⚠️ Error generando PDF rectificativa:', pdfError);
      }
    }

    await getTransporter().sendMail({
      from: import.meta.env.GMAIL_USER,
      to: emailCliente,
      subject: `Instrucciones de Devolución - ${numeroPedido}`,
      html: htmlContent,
      attachments
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
  nombreCliente?: string,
  datosDevolucion?: EmailDevolucion
) {
  try {
    const adminEmail = import.meta.env.ADMIN_EMAIL;
    console.log('📧 Preparando notificación de devolución para admin:', adminEmail);

    if (!adminEmail) {
      console.error('❌ ADMIN_EMAIL no configurado');
      throw new Error('ADMIN_EMAIL no configurado');
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f2ede6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f2ede6; padding: 30px 0;">
          <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <tr><td style="background: linear-gradient(90deg, #ff9800, #ffb74d, #ff9800); height: 5px;"></td></tr>
              
              <tr><td style="background: linear-gradient(135deg, #a89968, #8b6f47); padding: 35px 40px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">&#9888;&#65039; Nueva Devoluci&oacute;n Solicitada</h1>
                <p style="margin: 8px 0 0 0; color: #f2ede6; font-size: 14px;">Acci&oacute;n requerida - Pedido: ${numeroPedido}</p>
              </td></tr>
              
              <tr><td style="padding: 35px 40px;">
                
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 0 8px 8px 0; margin: 0 0 20px 0;">
                  <tr><td style="padding: 15px 20px;">
                    <p style="margin: 0; font-weight: 700; color: #856404; font-size: 15px;">&#128230; Un cliente ha solicitado una devoluci&oacute;n</p>
                  </td></tr>
                </table>
                
                <h2 style="margin: 25px 0 15px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #a89968; padding-bottom: 8px;">Detalles</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #faf7f2; border-radius: 8px; border: 1px solid #e0d5c7; margin: 0 0 20px 0;">
                  <tr><td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="6" cellspacing="0">
                      <tr>
                        <td style="color: #888; font-size: 13px; width: 160px;">N.&ordm; de Pedido</td>
                        <td style="font-weight: 700; color: #001a33; font-size: 13px;">${numeroPedido}</td>
                      </tr>
                      <tr>
                        <td style="color: #888; font-size: 13px;">Email del Cliente</td>
                        <td style="font-weight: 600; color: #001a33; font-size: 13px;">${emailCliente}</td>
                      </tr>
                      ${nombreCliente ? `<tr>
                        <td style="color: #888; font-size: 13px;">Cliente</td>
                        <td style="font-weight: 600; color: #001a33; font-size: 13px;">${nombreCliente}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="color: #888; font-size: 13px;">Fecha Solicitud</td>
                        <td style="color: #333; font-size: 13px;">${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    </table>
                  </td></tr>
                </table>
                
                <h2 style="margin: 25px 0 15px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #2196f3; padding-bottom: 8px;">Pr&oacute;ximos Pasos</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #e3f2fd; border-radius: 8px; border: 1px solid #90caf9; margin: 0 0 20px 0;">
                  <tr><td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 6px 0; color: #1565c0; font-size: 13px;"><strong>1.</strong> Monitorear la llegada del paquete al almac&eacute;n</td></tr>
                      <tr><td style="padding: 6px 0; color: #1565c0; font-size: 13px;"><strong>2.</strong> Verificar que el producto llegue en buen estado</td></tr>
                      <tr><td style="padding: 6px 0; color: #1565c0; font-size: 13px;"><strong>3.</strong> Validar el contenido del paquete</td></tr>
                      <tr><td style="padding: 6px 0; color: #1565c0; font-size: 13px;"><strong>4.</strong> Procesar el reembolso (m&aacute;ximo 5-7 d&iacute;as h&aacute;biles)</td></tr>
                      <tr><td style="padding: 6px 0; color: #1565c0; font-size: 13px;"><strong>5.</strong> Notificar al cliente cuando se apruebe la devoluci&oacute;n</td></tr>
                    </table>
                  </td></tr>
                </table>
                
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #faf7f2; border-left: 4px solid #a89968; border-radius: 0 8px 8px 0; margin: 20px 0;">
                  <tr><td style="padding: 18px 20px;">
                    <p style="margin: 0 0 8px 0; font-weight: 700; color: #001a33; font-size: 14px;">Informaci&oacute;n del Almac&eacute;n</p>
                    <p style="margin: 0; color: #5c4a3d; font-size: 13px; line-height: 1.6;">
                      El cliente enviar&aacute; el paquete a:<br>
                      <strong>Ib&eacute;ricos Rodr&iacute;guez Gonz&aacute;lez</strong><br>
                      Calle de la Moda 123<br>
                      Pol&iacute;gono Industrial<br>
                      28001 Madrid, Espa&ntilde;a<br><br>
                      <strong>Con referencia:</strong> ${numeroPedido}
                    </p>
                  </td></tr>
                </table>
                
                <p style="color: #888; font-size: 12px; margin-top: 20px;">Este es un correo autom&aacute;tico del sistema de gesti&oacute;n. Accede al panel de administraci&oacute;n para m&aacute;s detalles.</p>
                
              </td></tr>
              
              <tr><td style="background: #001a33; padding: 25px 40px; text-align: center;">
                <p style="margin: 0 0 5px 0; color: #a89968; font-size: 14px; font-weight: 600;">Ib&eacute;ricos Rodr&iacute;guez Gonz&aacute;lez</p>
                <p style="margin: 0; color: #4a5568; font-size: 11px;">&copy; 2026 Ib&eacute;ricos RG. Todos los derechos reservados.</p>
              </td></tr>
              
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    // Generar PDF de factura rectificativa si hay datos disponibles
    let attachments: any[] = [];
    if (datosDevolucion) {
      try {
        console.log('📄 Generando PDF de factura rectificativa para admin...');
        const pdfRectificativa = await generarPDFFacturaRectificativa(datosDevolucion);
        console.log('✅ PDF rectificativa generado para admin, tamaño:', pdfRectificativa.length, 'bytes');
        attachments.push({
          filename: `factura_rectificativa_${numeroPedido}.pdf`,
          content: pdfRectificativa,
          contentType: 'application/pdf'
        });
      } catch (pdfError) {
        console.error('⚠️ Error generando PDF rectificativa para admin:', pdfError);
      }
    }

    await getTransporter().sendMail({
      from: import.meta.env.GMAIL_USER,
      to: adminEmail,
      subject: `[DEVOLUCIÓN] Nueva devolución solicitada - ${numeroPedido}`,
      html: htmlContent,
      attachments
    });

    console.log('✅ Notificación de devolución enviada al admin:', adminEmail);
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
  totalReembolso?: number,
  datosDevolucion?: EmailDevolucion
) {
  try {
    console.log('📧 Preparando email de cancelación para:', emailCliente);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f2ede6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f2ede6; padding: 30px 0;">
          <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <tr><td style="background: linear-gradient(90deg, #a89968, #c4b07d, #a89968); height: 5px;"></td></tr>
              
              <tr><td style="background: #001a33; padding: 35px 40px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Pedido Cancelado</h1>
                <p style="margin: 8px 0 0 0; color: #a89968; font-size: 14px;">N.º ${numeroPedido}</p>
              </td></tr>
              
              <tr><td style="padding: 35px 40px;">
                
                <p style="color: #555; font-size: 15px; line-height: 1.6;">Hola${nombreCliente ? ' ' + nombreCliente : ''}, tu pedido ha sido cancelado correctamente.</p>
                
                <!-- RESUMEN -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f0faf0; border-radius: 8px; border: 1px solid #c3e6cb; margin: 20px 0;">
                  <tr><td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="6" cellspacing="0">
                      <tr>
                        <td style="color: #888; font-size: 13px; width: 150px;">Estado</td>
                        <td style="font-weight: 700; color: #28a745; font-size: 13px;">Cancelado</td>
                      </tr>
                      <tr>
                        <td style="color: #888; font-size: 13px;">N.º de Pedido</td>
                        <td style="font-weight: 600; color: #001a33; font-size: 13px;">${numeroPedido}</td>
                      </tr>
                      ${totalReembolso ? `<tr>
                        <td style="color: #888; font-size: 13px;">Reembolso</td>
                        <td style="font-weight: 700; color: #a89968; font-size: 15px;">${Number(totalReembolso).toFixed(2)} &euro;</td>
                      </tr>` : ''}
                      <tr>
                        <td style="color: #888; font-size: 13px;">Fecha</td>
                        <td style="color: #333; font-size: 13px;">${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    </table>
                  </td></tr>
                </table>
                
                <!-- REEMBOLSO -->
                <h2 style="margin: 25px 0 12px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #a89968; padding-bottom: 8px;">Reembolso</h2>
                <p style="color: #555; font-size: 14px; line-height: 1.7;">El importe se devolver&aacute; a tu m&eacute;todo de pago original en <strong style="color: #001a33;">3 a 5 d&iacute;as h&aacute;biles</strong>. Algunos bancos pueden tardar algo m&aacute;s.</p>
                
                <!-- QU&Eacute; PASA AHORA -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #faf7f2; border-left: 4px solid #a89968; border-radius: 0 8px 8px 0; margin: 20px 0;">
                  <tr><td style="padding: 18px 20px;">
                    <p style="margin: 0 0 8px 0; font-weight: 700; color: #001a33; font-size: 14px;">Qu&eacute; ha pasado</p>
                    <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.7;">El stock se ha restaurado autom&aacute;ticamente y tu cuenta refleja la cancelaci&oacute;n. Monitorea tu cuenta bancaria para confirmar el reembolso.</p>
                  </td></tr>
                </table>
                
                <p style="color: #888; font-size: 13px; margin-top: 25px;">Si tienes alguna duda, cont&aacute;ctanos. Estaremos encantados de ayudarte.</p>
                
              </td></tr>
              
              <tr><td style="background: #001a33; padding: 25px 40px; text-align: center;">
                <p style="margin: 0 0 5px 0; color: #a89968; font-size: 14px; font-weight: 600;">Ib&eacute;ricos Rodr&iacute;guez Gonz&aacute;lez</p>
                <p style="margin: 0; color: #4a5568; font-size: 11px;">&copy; 2026 Ib&eacute;ricos RG. Todos los derechos reservados.</p>
              </td></tr>
              
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    // Generar PDF de factura rectificativa si hay datos disponibles
    let attachments: any[] = [];
    if (datosDevolucion) {
      try {
        console.log('📄 Generando PDF de factura rectificativa para cancelación...');
        const pdfRectificativa = await generarPDFFacturaRectificativa(datosDevolucion);
        console.log('✅ PDF rectificativa generado, tamaño:', pdfRectificativa.length, 'bytes');
        attachments.push({
          filename: `factura_rectificativa_${numeroPedido}.pdf`,
          content: pdfRectificativa,
          contentType: 'application/pdf'
        });
      } catch (pdfError) {
        console.error('⚠️ Error generando PDF rectificativa:', pdfError);
      }
    }

    await getTransporter().sendMail({
      from: import.meta.env.GMAIL_USER,
      to: emailCliente,
      subject: `Confirmación de Cancelación - ${numeroPedido}`,
      html: htmlContent,
      attachments
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
  totalPedido?: number,
  datosDevolucion?: EmailDevolucion
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
              <strong>Un cliente ha cancelado su pedido</strong>
            </div>

            <div class="info-box">
              <h3 style="color: #001a33; margin-top: 0;">Detalles de la Cancelación</h3>
              <p style="margin: 5px 0;"><strong>Número de Pedido:</strong> ${numeroPedido}</p>
              <p style="margin: 5px 0;"><strong>Email del Cliente:</strong> ${emailCliente}</p>
              ${nombreCliente ? `<p style="margin: 5px 0;"><strong>Cliente:</strong> ${nombreCliente}</p>` : ''}
              ${totalPedido ? `<p style="margin: 5px 0;"><strong>Total Reembolsado:</strong> €${Number(totalPedido).toFixed(2)}</p>` : ''}
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

    // Generar PDF de factura rectificativa si hay datos disponibles
    let attachments: any[] = [];
    if (datosDevolucion) {
      try {
        console.log('📄 Generando PDF de factura rectificativa para admin (cancelación)...');
        const pdfRectificativa = await generarPDFFacturaRectificativa(datosDevolucion);
        console.log('✅ PDF rectificativa generado para admin, tamaño:', pdfRectificativa.length, 'bytes');
        attachments.push({
          filename: `factura_rectificativa_${numeroPedido}.pdf`,
          content: pdfRectificativa,
          contentType: 'application/pdf'
        });
      } catch (pdfError) {
        console.error('⚠️ Error generando PDF rectificativa para admin:', pdfError);
      }
    }

    await getTransporter().sendMail({
      from: import.meta.env.GMAIL_USER,
      to: import.meta.env.ADMIN_EMAIL,
      subject: `[CANCELACIÓN] Pedido cancelado - ${numeroPedido}`,
      html: htmlContent,
      attachments
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
  totalReembolso?: number,
  datosDevolucion?: EmailDevolucion
) {
  try {
    console.log('📧 Preparando email de devolución validada para:', emailCliente);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f2ede6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f2ede6; padding: 30px 0;">
          <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <tr><td style="background: linear-gradient(90deg, #28a745, #48c774, #28a745); height: 5px;"></td></tr>
              
              <tr><td style="background: linear-gradient(135deg, #28a745, #20c997); padding: 35px 40px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Devoluci&oacute;n Validada</h1>
                <p style="margin: 8px 0 0 0; color: #d4edda; font-size: 14px;">Pedido: ${numeroPedido}</p>
              </td></tr>
              
              <tr><td style="padding: 35px 40px;">
                
                <p style="color: #555; font-size: 15px; line-height: 1.6;">Hola${nombreCliente ? ' ' + nombreCliente : ''}, buenas noticias. Hemos recibido tu devoluci&oacute;n y la hemos validado correctamente.</p>
                
                <!-- RESUMEN -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f0faf0; border-radius: 8px; border: 1px solid #c3e6cb; margin: 20px 0;">
                  <tr><td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="6" cellspacing="0">
                      <tr>
                        <td style="color: #888; font-size: 13px; width: 150px;">Estado</td>
                        <td style="font-weight: 700; color: #28a745; font-size: 13px;">Validada</td>
                      </tr>
                      <tr>
                        <td style="color: #888; font-size: 13px;">N.&ordm; de Pedido</td>
                        <td style="font-weight: 600; color: #001a33; font-size: 13px;">${numeroPedido}</td>
                      </tr>
                      ${totalReembolso ? `<tr>
                        <td style="color: #888; font-size: 13px;">Reembolso Autorizado</td>
                        <td style="font-weight: 700; color: #a89968; font-size: 15px;">${Number(totalReembolso).toFixed(2)} &euro;</td>
                      </tr>` : ''}
                      <tr>
                        <td style="color: #888; font-size: 13px;">Fecha</td>
                        <td style="color: #333; font-size: 13px;">${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                      </tr>
                    </table>
                  </td></tr>
                </table>
                
                <!-- CRONOGRAMA -->
                <h2 style="margin: 25px 0 15px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #28a745; padding-bottom: 8px;">Cronograma</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding: 10px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td style="vertical-align: top; padding-right: 12px;"><span style="display: inline-block; background: #28a745; color: #fff; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px;">&#10003;</span></td>
                      <td><strong style="color: #001a33; font-size: 14px;">Devoluci&oacute;n Recibida</strong><br><span style="color: #888; font-size: 12px;">Hoy</span></td>
                    </tr></table>
                  </td></tr>
                  <tr><td style="padding: 10px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td style="vertical-align: top; padding-right: 12px;"><span style="display: inline-block; background: #28a745; color: #fff; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px;">&#10003;</span></td>
                      <td><strong style="color: #001a33; font-size: 14px;">Devoluci&oacute;n Validada</strong><br><span style="color: #888; font-size: 12px;">Hoy</span></td>
                    </tr></table>
                  </td></tr>
                  <tr><td style="padding: 10px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td style="vertical-align: top; padding-right: 12px;"><span style="display: inline-block; background: #ccc; color: #fff; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px;">&#8594;</span></td>
                      <td><strong style="color: #888; font-size: 14px;">Reembolso Procesado</strong><br><span style="color: #888; font-size: 12px;">En 3 a 5 d&iacute;as h&aacute;biles</span></td>
                    </tr></table>
                  </td></tr>
                </table>
                
                <!-- ETIQUETA DE ENVÍO -->
                <h2 style="margin: 25px 0 15px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #28a745; padding-bottom: 8px;">&#128230; Etiqueta de Env&iacute;o</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #e8f5e9; border: 2px dashed #28a745; border-radius: 8px; margin: 15px 0;">
                  <tr><td style="padding: 20px;">
                    <p style="margin: 0 0 8px 0; font-weight: 700; color: #001a33; font-size: 14px;">Adjuntamos tu etiqueta de env&iacute;o</p>
                    <p style="margin: 0 0 12px 0; color: #555; font-size: 13px; line-height: 1.6;">Hemos generado una etiqueta de env&iacute;o para tu devoluci&oacute;n. Sigue estos pasos:</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-left: 10px;">
                      <tr><td style="padding: 4px 0; color: #333; font-size: 13px;"><strong>1.</strong> Descarga e imprime la etiqueta adjunta en este correo.</td></tr>
                      <tr><td style="padding: 4px 0; color: #333; font-size: 13px;"><strong>2.</strong> P&eacute;gala en el exterior del paquete de devoluci&oacute;n.</td></tr>
                      <tr><td style="padding: 4px 0; color: #333; font-size: 13px;"><strong>3.</strong> Entrega el paquete en cualquier oficina de correos.</td></tr>
                    </table>
                  </td></tr>
                </table>

                <!-- INFO -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #faf7f2; border-left: 4px solid #28a745; border-radius: 0 8px 8px 0; margin: 25px 0;">
                  <tr><td style="padding: 18px 20px;">
                    <p style="margin: 0 0 5px 0; font-weight: 700; color: #001a33; font-size: 14px;">Sobre tu reembolso</p>
                    <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.7;">Se procesar&aacute; a tu m&eacute;todo de pago original. Puede tardar 3 a 5 d&iacute;as h&aacute;biles en aparecer. Te confirmaremos cuando se procese.</p>
                  </td></tr>
                </table>
                
                <p style="color: #888; font-size: 13px;">Si tienes alguna duda, estamos aqu&iacute; para ayudarte.</p>
                
              </td></tr>
              
              <tr><td style="background: #001a33; padding: 25px 40px; text-align: center;">
                <p style="margin: 0 0 5px 0; color: #a89968; font-size: 14px; font-weight: 600;">Ib&eacute;ricos Rodr&iacute;guez Gonz&aacute;lez</p>
                <p style="margin: 0; color: #4a5568; font-size: 11px;">&copy; 2026 Ib&eacute;ricos RG. Todos los derechos reservados.</p>
              </td></tr>
              
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    // Generar PDF de etiqueta de envío para el cliente
    let etiquetaAttachment: any = null;
    try {
      console.log('📄 Generando PDF de etiqueta de envío...');
      const pdfEtiqueta = await generarPDFEtiquetaEnvio(numeroPedido, nombreCliente);
      console.log('✅ PDF etiqueta de envío generado, tamaño:', pdfEtiqueta.length, 'bytes');
      etiquetaAttachment = {
        filename: `etiqueta_envio_${numeroPedido}.pdf`,
        content: pdfEtiqueta,
        contentType: 'application/pdf'
      };
    } catch (etiquetaError) {
      console.error('⚠️ Error generando PDF etiqueta de envío:', etiquetaError);
    }

    // Generar PDF de factura rectificativa si hay datos disponibles
    let attachments: any[] = [];
    let adminAttachments: any[] = [];
    if (datosDevolucion) {
      try {
        console.log('📄 Generando PDF de factura rectificativa para validación...');
        const pdfRectificativa = await generarPDFFacturaRectificativa(datosDevolucion);
        console.log('✅ PDF rectificativa generado, tamaño:', pdfRectificativa.length, 'bytes');
        const facturaAttach = {
          filename: `factura_rectificativa_${numeroPedido}.pdf`,
          content: pdfRectificativa,
          contentType: 'application/pdf'
        };
        attachments.push(facturaAttach);
        adminAttachments.push(facturaAttach);
      } catch (pdfError) {
        console.error('⚠️ Error generando PDF rectificativa:', pdfError);
      }
    }

    // Añadir etiqueta de envío solo al correo del cliente
    if (etiquetaAttachment) {
      attachments.push(etiquetaAttachment);
    }

    await getTransporter().sendMail({
      from: import.meta.env.GMAIL_USER,
      to: emailCliente,
      subject: `Devolución Validada - Reembolso Autorizado - ${numeroPedido}`,
      html: htmlContent,
      attachments
    });

    // Enviar solo la factura rectificativa al admin (SIN etiqueta de envío)
    if (adminAttachments.length > 0) {
      try {
        const adminEmail = import.meta.env.ADMIN_EMAIL;
        if (adminEmail) {
          await getTransporter().sendMail({
            from: import.meta.env.GMAIL_USER,
            to: adminEmail,
            subject: `[FACTURA RECTIFICATIVA] Devolución validada - ${numeroPedido}`,
            html: `
              <h2>Factura Rectificativa - Devolución Validada</h2>
              <p><strong>Número de Pedido:</strong> ${numeroPedido}</p>
              <p><strong>Cliente:</strong> ${emailCliente}</p>
              ${totalReembolso ? `<p><strong>Reembolso:</strong> ${Number(totalReembolso).toFixed(2)} €</p>` : ''}
              <p>Se adjunta la factura rectificativa correspondiente a la devolución validada.</p>
            `,
            attachments: adminAttachments
          });
          console.log('✅ Factura rectificativa enviada al admin');
        }
      } catch (adminError) {
        console.error('⚠️ Error enviando factura rectificativa al admin:', adminError);
      }
    }

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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f2ede6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f2ede6; padding: 30px 0;">
          <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              
              <tr><td style="background: linear-gradient(90deg, #dc3545, #e06070, #dc3545); height: 5px;"></td></tr>
              
              <tr><td style="background: #001a33; padding: 35px 40px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Devoluci&oacute;n Denegada</h1>
                <p style="margin: 8px 0 0 0; color: #a89968; font-size: 14px;">Pedido: ${numeroPedido}</p>
              </td></tr>
              
              <tr><td style="padding: 35px 40px;">
                
                <p style="color: #555; font-size: 15px; line-height: 1.6;">Hola${nombreCliente ? ' ' + nombreCliente : ''}, tras revisar tu solicitud de devoluci&oacute;n, lamentamos informarte de que ha sido denegada.</p>
                
                <!-- RESUMEN -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fef5f5; border-radius: 8px; border: 1px solid #f5c6cb; margin: 20px 0;">
                  <tr><td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="6" cellspacing="0">
                      <tr>
                        <td style="color: #888; font-size: 13px; width: 150px;">Estado</td>
                        <td style="font-weight: 700; color: #dc3545; font-size: 13px;">Denegada</td>
                      </tr>
                      <tr>
                        <td style="color: #888; font-size: 13px;">N.&ordm; de Pedido</td>
                        <td style="font-weight: 600; color: #001a33; font-size: 13px;">${numeroPedido}</td>
                      </tr>
                      <tr>
                        <td style="color: #888; font-size: 13px;">Fecha</td>
                        <td style="color: #333; font-size: 13px;">${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                      </tr>
                    </table>
                  </td></tr>
                </table>
                
                ${motivo ? `
                <!-- MOTIVO -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fff5f5; border-left: 4px solid #dc3545; border-radius: 0 8px 8px 0; margin: 20px 0;">
                  <tr><td style="padding: 18px 20px;">
                    <p style="margin: 0 0 5px 0; font-weight: 700; color: #721c24; font-size: 14px;">Motivo</p>
                    <p style="margin: 0; color: #721c24; font-size: 13px; line-height: 1.6;">${motivo}</p>
                  </td></tr>
                </table>
                ` : ''}
                
                <!-- QU&Eacute; SIGNIFICA -->
                <h2 style="margin: 25px 0 12px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #a89968; padding-bottom: 8px;">Qu&eacute; significa</h2>
                <p style="color: #555; font-size: 14px; line-height: 1.7;">El producto no cumple con los requisitos para devoluci&oacute;n, por lo que no se procesar&aacute; reembolso en esta ocasi&oacute;n. El art&iacute;culo permanecer&aacute; en tu poder.</p>
                
                <!-- CONTACTO -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #faf7f2; border-left: 4px solid #a89968; border-radius: 0 8px 8px 0; margin: 25px 0;">
                  <tr><td style="padding: 18px 20px;">
                    <p style="margin: 0 0 8px 0; font-weight: 700; color: #001a33; font-size: 14px;">&iquest;No est&aacute;s de acuerdo?</p>
                    <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.7;">Si crees que la decisi&oacute;n es incorrecta o tienes m&aacute;s informaci&oacute;n, cont&aacute;ctanos para revisar tu caso.</p>
                  </td></tr>
                </table>
                
              </td></tr>
              
              <tr><td style="background: #001a33; padding: 25px 40px; text-align: center;">
                <p style="margin: 0 0 5px 0; color: #a89968; font-size: 14px; font-weight: 600;">Ib&eacute;ricos Rodr&iacute;guez Gonz&aacute;lez</p>
                <p style="margin: 0; color: #4a5568; font-size: 11px;">&copy; 2026 Ib&eacute;ricos RG. Todos los derechos reservados.</p>
              </td></tr>
              
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    await getTransporter().sendMail({
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

/**
 * Enviar email de bienvenida con código de descuento al registrarse
 */
export async function enviarEmailBienvenida(emailCliente: string, nombreCliente: string, codigoDescuento: string = 'BIENVENIDA') {
  try {
    console.log('📧 Enviando email de bienvenida a:', emailCliente);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f2ede6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f2ede6; padding: 30px 0;">
            <tr><td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                
                <!-- BARRA DORADA SUPERIOR -->
                <tr><td style="background: linear-gradient(90deg, #a89968, #c4b07d, #a89968); height: 5px;"></td></tr>
                
                <!-- HEADER -->
                <tr><td style="background: #001a33; padding: 35px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">¡Bienvenido/a, ${nombreCliente}!</h1>
                  <p style="margin: 10px 0 0 0; color: #a89968; font-size: 15px; font-weight: 500;">Gracias por unirte a Ibéricos Rodríguez González</p>
                </td></tr>
                
                <!-- CONTENIDO PRINCIPAL -->
                <tr><td style="padding: 35px 40px;">
                  
                  <!-- MENSAJE DE BIENVENIDA -->
                  <p style="color: #333; font-size: 15px; line-height: 1.7; margin: 0 0 25px 0;">
                    Nos alegra mucho que formes parte de nuestra familia. Desde nuestra dehesa hasta tu mesa, 
                    seleccionamos los mejores productos ibéricos para que disfrutes de la auténtica calidad.
                  </p>
                  
                  <!-- CÓDIGO DE DESCUENTO -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px; background: linear-gradient(135deg, #001a33, #1a2d42); border-radius: 12px; overflow: hidden;">
                    <tr><td style="padding: 30px; text-align: center;">
                      <p style="margin: 0 0 8px 0; color: #a89968; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">🎁 Tu regalo de bienvenida</p>
                      <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px;">Usa este código en tu primera compra:</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                        <tr><td style="background: rgba(168, 153, 104, 0.2); border: 2px dashed #a89968; padding: 18px 40px; border-radius: 8px;">
                          <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: 4px;">${codigoDescuento}</p>
                        </td></tr>
                      </table>
                      <p style="margin: 15px 0 0 0; color: #c4b07d; font-size: 20px; font-weight: 700;">10% de descuento</p>
                      <p style="margin: 5px 0 0 0; color: #8899aa; font-size: 12px;">Válido en tu primera compra</p>
                    </td></tr>
                  </table>
                  
                  <!-- CÓMO USAR -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px; background: #faf7f2; border-left: 4px solid #a89968; border-radius: 0 8px 8px 0;">
                    <tr><td style="padding: 18px 20px;">
                      <p style="margin: 0 0 5px 0; font-weight: 700; color: #001a33; font-size: 14px;">¿Cómo usar tu código?</p>
                      <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.6;">
                        1. Añade productos a tu carrito<br>
                        2. En el resumen del carrito, introduce el código <strong>${codigoDescuento}</strong><br>
                        3. ¡Disfruta de tu descuento!
                      </p>
                    </td></tr>
                  </table>
                  
                  <!-- BOTÓN CTA -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                    <tr><td align="center">
                      <a href="https://ibericosrodriguezgonzalez.victoriafp.online/productos" style="display: inline-block; background: linear-gradient(135deg, #a89968, #c4b07d); color: #ffffff; padding: 14px 35px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 15px rgba(168, 153, 104, 0.3);">
                        Explorar Productos
                      </a>
                    </td></tr>
                  </table>
                  
                  <!-- BENEFICIOS -->
                  <h2 style="margin: 0 0 15px 0; color: #001a33; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #a89968; padding-bottom: 8px;">¿Por qué elegirnos?</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                    <tr>
                      <td style="padding: 8px 0; color: #555; font-size: 14px;">Productos ibéricos de bellota de primera calidad</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #555; font-size: 14px;">Envío cuidado y rápido en 3-5 días hábiles</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #555; font-size: 14px;">Corte personalizado a tu gusto</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #555; font-size: 14px;">Garantía de satisfacción total</td>
                    </tr>
                  </table>
                  
                </td></tr>
                
                <!-- FOOTER -->
                <tr><td style="background: #001a33; padding: 25px 40px; text-align: center;">
                  <p style="margin: 0 0 5px 0; color: #a89968; font-size: 14px; font-weight: 600;">Ibéricos Rodríguez González</p>
                  <p style="margin: 0 0 12px 0; color: #667788; font-size: 12px;">Productos ibéricos de calidad desde nuestra dehesa a tu mesa</p>
                  <p style="margin: 0; color: #4a5568; font-size: 11px;">&copy; 2026 Ibéricos RG. Todos los derechos reservados.</p>
                </td></tr>
                
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `;

    await getTransporter().sendMail({
      from: `"Ibéricos Rodríguez González" <${import.meta.env.GMAIL_USER}>`,
      to: emailCliente,
      subject: '¡Bienvenido/a a Ibéricos Rodríguez González! 🎁 Tu código de descuento',
      html: htmlContent
    });

    console.log('✅ Email de bienvenida enviado a:', emailCliente);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de bienvenida:', error);
    // No lanzar error para no bloquear el registro
    return false;
  }
}

