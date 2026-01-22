import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, asunto, mensaje } = await request.json();

    // Validación
    if (!email || !asunto || !mensaje) {
      return new Response(
        JSON.stringify({ error: 'Todos los campos son obligatorios', success: false }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'El formato del email no es válido', success: false }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Configurar transporte de email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: import.meta.env.GMAIL_USER,
        pass: import.meta.env.GMAIL_PASSWORD
      }
    });

    // Email destino (el admin)
    const emailAdmin = import.meta.env.GMAIL_USER;

    // Fecha y hora actual
    const fechaHora = new Date().toLocaleString('es-ES', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    // Contenido del email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #f8f4f0; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: #001a33; color: white; padding: 2rem; text-align: center; }
          .header h1 { margin: 0; font-size: 1.5rem; }
          .content { padding: 2rem; }
          .field { margin-bottom: 1.5rem; }
          .label { font-weight: 600; color: #001a33; margin-bottom: 0.5rem; display: block; font-size: 0.9rem; }
          .value { background: #f8f4f0; padding: 1rem; border-radius: 6px; color: #333; border-left: 4px solid #a89968; }
          .mensaje-box { background: #f8f4f0; padding: 1.5rem; border-radius: 6px; border-left: 4px solid #a89968; white-space: pre-wrap; line-height: 1.6; }
          .footer { background: #f8f4f0; padding: 1.5rem; text-align: center; color: #666; font-size: 0.85rem; }
          .responder-btn { display: inline-block; background: #a89968; color: white; padding: 0.75rem 2rem; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📩 Nuevo mensaje de contacto</h1>
          </div>
          
          <div class="content">
            <div class="field">
              <span class="label">De:</span>
              <div class="value">
                <a href="mailto:${email}" style="color: #a89968; text-decoration: none; font-weight: 600;">${email}</a>
              </div>
            </div>
            
            <div class="field">
              <span class="label">Asunto:</span>
              <div class="value">${asunto}</div>
            </div>
            
            <div class="field">
              <span class="label">Mensaje:</span>
              <div class="mensaje-box">${mensaje.replace(/\n/g, '<br>')}</div>
            </div>
            
            <div class="field">
              <span class="label">Fecha y hora:</span>
              <div class="value" style="font-size: 0.9rem; color: #666;">${fechaHora}</div>
            </div>

            <div style="text-align: center; margin-top: 2rem;">
              <a href="mailto:${email}?subject=Re: ${encodeURIComponent(asunto)}" class="responder-btn">
                Responder al cliente
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">Este mensaje fue enviado desde el formulario de contacto de</p>
            <p style="margin: 0.5rem 0 0 0; font-weight: 600; color: #001a33;">Ibéricos Rodríguez González</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Enviar email al admin
    await transporter.sendMail({
      from: `"Contacto Web" <${emailAdmin}>`,
      to: emailAdmin,
      replyTo: email, // Para que al responder, vaya directamente al cliente
      subject: `[Contacto Web] ${asunto}`,
      html: htmlContent
    });

    console.log('✅ Email de contacto enviado desde:', email);

    return new Response(
      JSON.stringify({ success: true, message: 'Mensaje enviado correctamente' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error enviando email de contacto:', error);
    return new Response(
      JSON.stringify({ error: 'Error al enviar el mensaje', success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
