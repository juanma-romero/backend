// services/commands/ingresos/cobrar.js
import axios from 'axios';

export const aliases = ['cobrado', 'cobra', 'cobrar'];

/**
 * Ejecuta el comando para registrar un pago de un pedido en ERPNext.
 * Uso: /cobrar <ID_ERP_o_JID> [monto] [metodo]
 * Ejemplos:
 *   /cobrar SAL-ORD-2026-00349
 *   /cobrar SAL-ORD-2026-00349 transferencia
 *   /cobrar SAL-ORD-2026-00349 50000 efectivo
 *   /cobrar 19292551824@s.whatsapp.net 198 mil transferencia   ← busca último pedido del cliente
 */
export const execute = async (args) => {
  if (args.length < 1) {
    return "Uso incorrecto. Formato: /cobrar <ID_ERP_o_Telefono> [monto] [metodo]\nEjemplo: /cobrar SAL-ORD-2026-00349 transferencia\nO bien: /cobrar +595 971 166266 transferencia";
  }

  let orderId = '';
  let phoneArgsCount = 0;

  const firstArg = args[0].toUpperCase();
  if (firstArg.startsWith('SAL') || firstArg.includes('-')) {
    orderId = firstArg;
    phoneArgsCount = 1;
  } else if (firstArg.includes('@')) {
    orderId = firstArg;
    phoneArgsCount = 1;
  } else {
    // Asumimos que es un número de teléfono con posibles espacios (ej. +595 971 166266)
    let accumulatedDigits = '';
    let rawPhoneStr = '';

    for (let i = 0; i < args.length; i++) {
      const part = args[i];
      rawPhoneStr += (i > 0 ? ' ' : '') + part;
      phoneArgsCount++;
      
      const digitsInPart = part.replace(/\D/g, '');
      accumulatedDigits += digitsInPart;

      // Si ya acumulamos 10 o más dígitos, asumimos que terminamos de leer el teléfono
      if (accumulatedDigits.length >= 10) {
        break;
      }
    }

    if (accumulatedDigits.length < 10) {
      phoneArgsCount = 1;
      orderId = firstArg;
    } else {
      let contactJid = accumulatedDigits;
      if (contactJid.startsWith('0') && contactJid.length === 10) {
        contactJid = '595' + contactJid.slice(1);
      }
      contactJid += '@s.whatsapp.net';
      orderId = contactJid;
    }
  }

  let amount = 0;
  let method = 'efectivo'; // por defecto

  // Parsear resto de argumentos buscando monto y método
  const remainingArgs = args.slice(phoneArgsCount).map(a => a.toLowerCase());

  // Buscar método de pago
  if (remainingArgs.some(a => ['transferencia', 'transf', 'banco'].includes(a))) {
    method = 'transferencia';
  } else if (remainingArgs.some(a => ['efectivo', 'cash'].includes(a))) {
    method = 'efectivo';
  }

  // Buscar monto
  const amountStr = remainingArgs.join(' ');
  const regex = /([\d.,]+)\s*(mil)?/i;
  const match = amountStr.match(regex);
  if (match && match[1]) {
    let num = parseFloat(match[1].replace(/[^\d.-]/g, ''));
    if (match[2] && match[2].toLowerCase() === 'mil') {
      num *= 1000;
    }
    // Para evitar que '2026' del ID se tome si se escribe mal, solo aplicamos si hay args restantes
    if (!isNaN(num)) {
      amount = num;
    }
  }

  const erpServiceUrl = process.env.ERP_SERVICE_URL || 'http://localhost:8001';

  try {
    const response = await axios.post(`${erpServiceUrl}/api/orders/${orderId}/pay`, {
      amount: amount,
      method: method
    });

    const data = response.data;
    if (data.success) {
      const finalOrderId = data.order_id || orderId;
      let msg = `✅ *Pago registrado exitosamente* para ${finalOrderId}.\n`;
      msg += `Método: *${method}*\n`;
      if (data.sales_invoice) {
        msg += `Factura: ${data.sales_invoice}\n`;
      }
      msg += `Recibo: ${data.payment_entry}`;
      return msg;
    } else {
      return `❌ Error al registrar pago: No se pudo confirmar la operación.`;
    }

  } catch (error) {
    console.error(`[Command cobrar] Error para ${orderId}:`, error.message);
    if (error.response && error.response.data && error.response.data.detail) {
      return `❌ *Error del sistema*: ${error.response.data.detail}`;
    }
    return `❌ Ocurrió un error al intentar registrar el pago para ${orderId}. Asegúrate de que el ID sea correcto y que el ERP esté funcionando.`;
  }
};
