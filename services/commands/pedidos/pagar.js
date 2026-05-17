// services/commands/pedidos/pagar.js
import axios from 'axios';

export const aliases = ['pagado', 'cobrar', 'pago'];

/**
 * Ejecuta el comando para registrar un pago de un pedido en ERPNext.
 * Uso: /pagar <ID_ERP> [monto] [metodo]
 * Ejemplos: 
 *   /pagar SAL-ORD-2026-00349
 *   /pagar SAL-ORD-2026-00349 transferencia
 *   /pagar SAL-ORD-2026-00349 50000 efectivo
 */
export const execute = async (args) => {
  if (args.length < 1) {
    return "Uso incorrecto. Formato: /pagar <ID_ERP> [monto] [metodo]\nEjemplo: /pagar SAL-ORD-2026-00349 transferencia";
  }

  const orderId = args[0].toUpperCase();
  let amount = 0;
  let method = 'efectivo'; // por defecto

  // Parsear resto de argumentos buscando monto y método
  const remainingArgs = args.slice(1).map(a => a.toLowerCase());
  
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
      let msg = `✅ *Pago registrado exitosamente* para ${orderId}.\n`;
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
    console.error(`[Command pagar] Error para ${orderId}:`, error.message);
    if (error.response && error.response.data && error.response.data.detail) {
      return `❌ *Error del sistema*: ${error.response.data.detail}`;
    }
    return `❌ Ocurrió un error al intentar registrar el pago para ${orderId}. Asegúrate de que el ID sea correcto y que el ERP esté funcionando.`;
  }
};
