// tests/test_acreditado_trigger.mjs
// Test local del gatillo "Acreditado xxx gs": payment.handler.js -> ERP (dummy) -> dashWhat2 (dummy)
import assert from 'assert';
import http from 'http';
import { handlePaymentTrigger } from '../services/message_events/payment.handler.js';

const capturedErp = [];   // requests al erp-service
const capturedDash = [];  // mensajes que el handler mandó al chat (vía dashWhat2)

// Servidor dummy: hace de erp-service (/api/orders/.../pay) y de dashWhat2 (/send-message)
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (req.url.startsWith('/api/orders/')) {
      capturedErp.push({ url: req.url, body: body ? JSON.parse(body) : null });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // Simula el response nuevo con outstanding_amount: último pedido = pago total (0)
      const isTotal = capturedErp.length >= 4;
      return res.end(JSON.stringify({
        success: true,
        order_id: 'SAL-ORD-2026-TEST',
        sales_invoice: 'SINV-TEST-0001',
        payment_entry: 'PAY-TEST-0001',
        outstanding_amount: isTotal ? 0 : 100000
      }));
    }
    if (req.url === '/send-message') {
      capturedDash.push(body ? JSON.parse(body) : {});
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }
    if (req.url === '/fail-pay') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ detail: 'Pedido no encontrado' }));
    }
    res.writeHead(404);
    res.end();
  });
});

const msg = (text, fromMe = true, jid = '267912107524268@lid') => ({
  key: { remoteJid: jid, fromMe },
  textContent: text,
});

server.listen(8097, async () => {
  process.env.ERP_SERVICE_URL = 'http://localhost:8097';
  process.env.DASHWHAT_URL = 'http://localhost:8097';

  try {
    // Caso 0: mensaje que NO es gatillo -> devuelve false y no llama a nadie
    let handled = await handlePaymentTrigger(msg('Hola cómo estás'));
    assert.strictEqual(handled, false);
    assert.strictEqual(capturedErp.length, 0);
    console.log('✓ Caso 0 OK: mensaje normal no dispara el gatillo');

    // Caso 0b: mensaje del CLIENTE que menciona 'acreditado' -> no debe disparar (es fromMe=false)
    handled = await handlePaymentTrigger(msg('ya te acreditado 50 mil', false));
    assert.strictEqual(handled, false);
    assert.strictEqual(capturedErp.length, 0);
    console.log('✓ Caso 0b OK: solo responde al admin (fromMe)');

    // Caso 1: "Acreditado 150000 gs" (pago parcial -> espera aviso de saldo)
    handled = await handlePaymentTrigger(msg('Acreditado 150000 gs'));
    assert.strictEqual(handled, true);
    assert.strictEqual(capturedErp[0].url, '/api/orders/267912107524268@lid/pay');
    assert.strictEqual(capturedErp[0].body.amount, 150000);
    assert.strictEqual(capturedErp[0].body.method, 'transferencia');
    assert.ok(capturedDash[0].message.includes('Pago registrado en sistema por Gs. 150.000'));
    assert.ok(capturedDash[0].message.includes('saldo pendiente de Gs. 100.000'));
    assert.ok(capturedDash[0].message.includes('PAY-TEST-0001'));
    console.log('✓ Caso 1 OK: parcial con monto -> "Pago registrado" + saldo pendiente');

    // Caso 2: "Acreditado 50 mil" -> 50000
    handled = await handlePaymentTrigger(msg('Acreditado 50 mil'));
    assert.strictEqual(capturedErp[1].body.amount, 50000);
    console.log('✓ Caso 2 OK: formato "50 mil"');

    // Caso 3: "Acreditado 1.500.000" -> 1500000
    handled = await handlePaymentTrigger(msg('Acreditado 1.500.000 gs'));
    assert.strictEqual(capturedErp[2].body.amount, 1500000);
    console.log('✓ Caso 3 OK: formato con puntos de mil');

    // Caso 4: pago total (outstanding 0) -> "totalmente pagado"
    handled = await handlePaymentTrigger(msg('Acreditado 100000'));
    assert.ok(capturedDash[3].message.includes('Pedido totalmente pagado en sistema'), capturedDash[3].message);
    console.log('✓ Caso 4 OK: pago total -> "totalmente pagado"');

    // Caso 5: sin monto reconocible -> avisa al admin, no llama al ERP
    const erpBefore = capturedErp.length;
    handled = await handlePaymentTrigger(msg('Acreditado'));
    assert.strictEqual(handled, true);
    assert.strictEqual(capturedErp.length, erpBefore);
    assert.ok(capturedDash[4].message.includes('No pude reconocer el monto'));
    console.log('✓ Caso 5 OK: sin monto -> aviso, sin llamada al ERP');

    console.log('\nTODOS LOS CASOS PASARON');
  } catch (e) {
    console.error('\n❌ FALLÓ:', e.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
