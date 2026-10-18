// services/commands/ingresos/cobrar.js
import axios from 'axios';

export const aliases = ['cobrado', 'cobra', 'cobrar'];

/**
 * Ejecuta el comando para registrar un pago de un pedido en ERPNext.
 * Uso: /cobrar <ID_ERP | Telefono | Nombre_Cliente> [monto] [metodo]
 * Ejemplos:
 *   /cobrar SAL-ORD-2026-00349
 *   /cobrar SAL-ORD-2026-00349 transferencia
 *   /cobrar SAL-ORD-2026-00349 50000 efectivo
 *   /cobrar +595 971 166266 transferencia
 *   /cobrar Ramiro transferencia
 *   /cobrar Sol 15000 efectivo
 */
export const execute = async (args) => {
  if (args.length < 1) {
    return "Uso incorrecto. Formato: /cobrar <ID_Orden | Telefono | Nombre> [monto] [metodo]\nEjemplos:\n  /cobrar SAL-ORD-2026-00349 transferencia\n  /cobrar +595 971 166266 transferencia\n  /cobrar Sol efectivo";
  }

  let orderId = '';
  let consumedArgsCount = 0;

  const firstArg = args[0];
  const upperFirst = firstArg.toUpperCase();

  // 1. Caso ID de orden directa de ERP (ej. SAL-ORD-..., SALES-ORD-...)
  if (upperFirst.startsWith('SAL') || (firstArg.includes('-') && !firstArg.includes('@') && /\d/.test(firstArg) && /[a-zA-Z]/.test(firstArg))) {
    orderId = upperFirst;
    consumedArgsCount = 1;
  } else if (firstArg.includes('@')) {
    orderId = firstArg;
    consumedArgsCount = 1;
  } else if (/^\+?\d/.test(firstArg)) {
    // 2. Comienza con dígito o +, probable número de teléfono con espacios
    let accumulatedDigits = '';
    for (let i = 0; i < args.length; i++) {
      const part = args[i];
      const digitsInPart = part.replace(/\D/g, '');
      // Si la palabra no tiene dígitos (ej. 'transferencia', 'mil'), paramos
      if (!digitsInPart) break;
      accumulatedDigits += digitsInPart;
      consumedArgsCount++;
      if (accumulatedDigits.length >= 9) break;
    }

    if (accumulatedDigits.length >= 6) {
      let contactJid = accumulatedDigits;
      if (contactJid.startsWith('0') && contactJid.length === 10) {
        contactJid = '595' + contactJid.slice(1);
      }
      orderId = contactJid.includes('@') ? contactJid : `${contactJid}@s.whatsapp.net`;
    } else {
      orderId = firstArg;
      consumedArgsCount = 1;
    }
  } else {
    // 3. Caso Nombre de cliente (puede ser compuesto, ej: "Maria Jose")
    const nameParts = [];
    const paymentKeywords = ['transferencia', 'transf', 'banco', 'efectivo', 'cash', 'mil'];

    for (let i = 0; i < args.length; i++) {
      const part = args[i];
      const lowerPart = part.toLowerCase();
      // Si encontramos un método conocido o un número puro/con decimales, termina el nombre
      if (paymentKeywords.includes(lowerPart) || /^[\d.,]+(mil)?$/i.test(part)) {
        break;
      }
      nameParts.push(part);
      consumedArgsCount++;
    }

    if (nameParts.length > 0) {
      orderId = nameParts.join(' ');
    } else {
      orderId = firstArg;
      consumedArgsCount = 1;
    }
  }

  let amount = 0;
  let method = 'efectivo'; // por defecto

  // Parsear resto de argumentos buscando monto y método
  const remainingArgs = args.slice(consumedArgsCount).map(a => a.toLowerCase());

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
