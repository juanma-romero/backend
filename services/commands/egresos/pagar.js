// services/commands/egresos/pagar.js
import axios from 'axios';

export const aliases = ['pago', 'pagar', 'pagado', 'gasto', 'compra'];

// Mapeo exacto a las cuentas descubiertas en ERPNext (usando variables de entorno para portabilidad)
const conceptMercaderia = process.env.ACCOUNT_MERCADERIA || "1414 - Ajuste de inventario - Vz";
const conceptGasto = process.env.ACCOUNT_GASTO || "Gastos varios - Vz";

const CONCEPT_MAP = {
  "mercaderia": conceptMercaderia,
  "gasto": conceptGasto
};

/**
 * Ejecuta el comando para registrar una salida de dinero (Asiento Contable) en ERPNext.
 * Uso: /pagar <concepto> <monto> [metodo]
 * Ejemplos:
 *   /pagar mercaderia 150000 efectivo
 *   /pagar gasto 50 mil transferencia
 */
export const execute = async (args) => {
  if (args.length < 2) {
    return "Uso incorrecto. Formato: /pagar <concepto> <monto> [metodo]\nConceptos permitidos: mercaderia, gasto\nEjemplo: /pagar mercaderia 150 mil efectivo";
  }

  const conceptArg = args[0].toLowerCase();
  
  // Validar concepto
  if (!CONCEPT_MAP[conceptArg]) {
    return `❌ Concepto no válido. Usa 'mercaderia' o 'gasto'.`;
  }
  
  const conceptAccount = CONCEPT_MAP[conceptArg];

  let amount = 0;
  let method = 'efectivo'; // por defecto

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
    if (!isNaN(num)) {
      amount = num;
    }
  }

  if (amount <= 0) {
    return `❌ No se pudo determinar un monto válido. Ejemplo: /pagar gasto 50 mil efectivo`;
  }

  const erpServiceUrl = process.env.ERP_SERVICE_URL || 'http://localhost:8001';

  try {
    const remark = `Registro de salida por comando: ${conceptArg}`;
    
    const response = await axios.post(`${erpServiceUrl}/api/accounting/expense`, {
      concept_account: conceptAccount,
      amount: amount,
      method: method,
      remark: remark
    });

    const data = response.data;
    if (data.success) {
      return `✅ *Pago registrado exitosamente*\nConcepto: *${conceptArg}*\nMonto: *${amount}*\nMétodo: *${method}*\nAsiento: ${data.journal_entry}`;
    } else {
      return `❌ Error al registrar pago: No se pudo confirmar la operación.`;
    }

  } catch (error) {
    console.error(`[Command pagar] Error:`, error.message);
    if (error.response && error.response.data && error.response.data.detail) {
      return `❌ *Error del sistema*: ${error.response.data.detail}`;
    }
    return `❌ Ocurrió un error al intentar registrar el pago. Asegúrate de que el ERP esté funcionando.`;
  }
};
