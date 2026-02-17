/// <reference types="astro/client" />
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = import.meta.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY no está configurada');
}

/** Instancia compartida de Stripe */
export const stripe = new Stripe(STRIPE_SECRET_KEY || '');

/**
 * Resultado de un intento de reembolso en Stripe.
 * `success` indica si se ejecutó correctamente.
 * `refundId` contiene el ID de Stripe del refund creado.
 * `alreadyRefunded` se activa cuando el pago ya fue reembolsado previamente.
 */
export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  alreadyRefunded?: boolean;
  error?: string;
}

/**
 * Procesa un reembolso completo en Stripe a partir del `stripe_session_id`
 * almacenado en la tabla de pedidos.
 *
 * Flujo:
 *  1. Recupera la sesión de Checkout con `stripe.checkout.sessions.retrieve`
 *  2. Extrae el `payment_intent` de la sesión
 *  3. Verifica que el PaymentIntent esté en un estado reembolsable
 *  4. Crea el reembolso con `stripe.refunds.create`
 *
 * @param stripeSessionId  ID de la sesión de Stripe Checkout (cs_xxx)
 * @param motivo            Motivo legible que se registrará en Stripe metadata
 * @returns RefundResult
 */
export async function procesarReembolsoStripe(
  stripeSessionId: string,
  motivo?: string
): Promise<RefundResult> {
  try {
    if (!STRIPE_SECRET_KEY) {
      return { success: false, error: 'STRIPE_SECRET_KEY no configurada' };
    }

    if (!stripeSessionId) {
      return { success: false, error: 'No se proporcionó stripe_session_id' };
    }

    console.log('💳 Iniciando reembolso Stripe para sesión:', stripeSessionId);

    // 1. Recuperar la sesión de Checkout
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

    if (!session.payment_intent) {
      console.error('❌ La sesión no tiene payment_intent asociado');
      return { success: false, error: 'La sesión de Stripe no tiene un pago asociado' };
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent.id;

    console.log('💳 PaymentIntent encontrado:', paymentIntentId);

    // 2. Recuperar el PaymentIntent para verificar estado
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log('💳 Estado del PaymentIntent:', paymentIntent.status, '| Monto:', paymentIntent.amount, paymentIntent.currency);

    // 3. Verificar si el pago ya fue completamente reembolsado
    if (paymentIntent.status === 'canceled') {
      console.warn('⚠️ El PaymentIntent ya fue cancelado');
      return { success: false, error: 'El pago ya fue cancelado en Stripe' };
    }

    // Comprobar si ya hay un reembolso completo existente
    const existingRefunds = await stripe.refunds.list({
      payment_intent: paymentIntentId,
      limit: 10,
    });

    const totalRefunded = existingRefunds.data
      .filter(r => r.status === 'succeeded')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    if (totalRefunded >= paymentIntent.amount) {
      console.warn('⚠️ El pago ya fue reembolsado completamente');
      return {
        success: true,
        alreadyRefunded: true,
        amount: totalRefunded,
        currency: paymentIntent.currency,
        status: 'already_refunded',
      };
    }

    // 4. Crear el reembolso completo (lo restante si hubo parcial)
    const amountToRefund = paymentIntent.amount - totalRefunded;

    console.log('💳 Creando reembolso por', amountToRefund, 'céntimos...');

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountToRefund,
      reason: 'requested_by_customer',
      metadata: {
        motivo: motivo || 'Reembolso procesado desde el panel',
        stripe_session_id: stripeSessionId,
        fecha: new Date().toISOString(),
      },
    });

    console.log('✅ Reembolso creado en Stripe:', {
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
    });

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status ?? undefined,
    };
  } catch (err: any) {
    // Manejar errores específicos de Stripe
    if (err?.type === 'StripeInvalidRequestError') {
      console.error('❌ Error de Stripe (petición inválida):', err.message);

      // Caso típico: charge already refunded
      if (err.message?.includes('already been refunded')) {
        return {
          success: true,
          alreadyRefunded: true,
          status: 'already_refunded',
          error: err.message,
        };
      }

      return { success: false, error: `Error de Stripe: ${err.message}` };
    }

    console.error('❌ Error inesperado procesando reembolso Stripe:', err);
    return { success: false, error: err?.message || 'Error desconocido al procesar reembolso' };
  }
}
