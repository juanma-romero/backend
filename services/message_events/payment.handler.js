// services/message_events/payment.handler.js
import axios from 'axios';
import { sendClientMessage } from '../notification.service.js';

/**
 * Maneja la detección del comando de pago por transferencia: "Acreditado xxx gs" o "Acreditado [monto]"
 * Escrito por el admin en el chat con el cliente.
 * @param {object} messageData - El objeto completo del mensaje.
 * @returns {boolean} - Devuelve true si el evento fue manejado, de lo contrario false.
 */
export const handlePaymentTrigger = async (messageData) => {
  const contactJid = messageData.key.remoteJid;
  const isFromMe = messageData.key.fromMe;
  const textContent = messageData.textContent || '';

  if (!isFromMe) return false;

  const lowerText = textContent.toLowerCase().trim();
  if (lowerText.startsWith('acreditado')) {
    console.log(`[PaymentHandler] Comando de acreditación detectado: "${textContent}" para JID: ${contactJid}`);

    // Parsear monto
    // Ej: "Acreditado 150000 gs", "Acreditado 50 mil", "Acreditado 150.000"
    let amount = 0;
    const regex = /([\d.,]+)\s*(mil)?/i;
    const match = textContent.match(regex);
    if (match && match[1]) {
      let num = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      if (match[2] && match[2].toLowerCase() === 'mil') {
        num *= 1000;
      }
      if (!isNaN(num)) {
        amount = num;
      }
    }

    if (amount <= 0) {
      await sendClientMessage(contactJid, `❌ No pude reconocer el monto en el mensaje de acreditación. Formato esperado: "Acreditado 150000 gs" o "Acreditado 50 mil"`, { mirror: false });
      return true;
    }

    const erpServiceUrl = process.env.ERP_SERVICE_URL || 'http://erp_service:8001';

    try {
      // Registrar pago en ERPNext usando el JID del chat
      const response = await axios.post(`${erpServiceUrl}/api/orders/${contactJid}/pay`, {
        amount: amount,
        method: 'transferencia'
      });

      const data = response.data;
      if (data.success) {
        const outstanding = data.outstanding_amount !== undefined ? data.outstanding_amount : 0;
        let replyText = '';

        if (outstanding <= 0) {
          replyText = `✅ Pedido totalmente pagado en sistema (Gs. ${amount.toLocaleString('es-PY')}).`;
          if (data.sales_invoice) replyText += ` Factura: ${data.sales_invoice}.`;
          if (data.payment_entry) replyText += ` Recibo: ${data.payment_entry}.`;
        } else {
          replyText = `✅ Pago registrado en sistema por Gs. ${amount.toLocaleString('es-PY')}.\n⏳ Queda un saldo pendiente de Gs. ${outstanding.toLocaleString('es-PY')}.`;
          if (data.sales_invoice) replyText += ` Factura: ${data.sales_invoice}.`;
          if (data.payment_entry) replyText += ` Recibo: ${data.payment_entry}.`;
        }

        console.log(`[PaymentHandler] Pago registrado con éxito: ${replyText}`);
        await sendClientMessage(contactJid, replyText, { mirror: false });
      } else {
        await sendClientMessage(contactJid, `❌ No se pudo registrar el pago en el sistema ERP.`, { mirror: false });
      }
    } catch (error) {
      console.error(`[PaymentHandler] Error registrando pago para ${contactJid}:`, error.response?.data || error.message);
      const errDetail = error.response?.data?.detail || error.message;
      await sendClientMessage(contactJid, `❌ Error al registrar pago en ERP: ${errDetail}`, { mirror: false });
    }

    return true;
  }

  return false;
};
