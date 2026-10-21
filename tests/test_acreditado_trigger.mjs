// tests/test_acreditado_trigger.mjs
// Test local del gatillo "Acreditado xxx gs": payment.handler.js -> ERP (dummy) -> dashWhat2/Chatwoot (dummies)
// Política: éxito Y error/monto ilegible -> SOLO nota privada al admin; nada al cliente.
import assert from 'assert';
import http from 'http';
import { handlePaymentTrigger } from '../services/message_events/payment.handler.js';

const capturedErp = [];   // requests al erp-service
const capturedDash = [];  // mensajes enviados al WhatsApp del CLIENTE
const capturedCw = [];    // publicaciones en Chatwoot

// Servidor dummy: hace de erp-service, dashWhat2 y Chatwoot
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (req.url.startsWith('/api/orders/')) {
      capturedErp.push({ url: req.url, body: body ? JSON.parse(body) : null });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // Simula el response con outstanding_amount: 4ta llamada = pago total (0)
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
    if (req.url.includes('/contacts/search')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ payload: [{ id: 99 }] }));
    }
    if (req.url.includes('/conversations') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ payload: [{ id: 123, inbox_id: 7, status: 'open' }] }));
    }
    if (req.url.includes('/conversations/') && req.url.endsWith('/messages')) {
      capturedCw.push(body ? JSON.parse(body) : {});
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ id: 5001 }));
    }
    res.writeHead(404);
    res.end();
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lastNote = () => [...capturedCw].reverse().find((m) => m.private === true);

const msg = (text, fromMe = true, jid = '267912107524268@lid') => ({
  key: { remoteJid: jid, fromMe },
  textContent: text,
});

server.listen(8097, async () => {
  process.env.ERP_SERVICE_URL = 'http://localhost:8097';
  process.env.DASHWHAT_URL = 'http://localhost:8097';
  process.env.CHATWOOT_API_TOKEN = 'test-token';
  process.env.CHATWOOT_URL = 'http://localhost:8097';
  process.env.CHATWOOT_INBOX_ID = '7';
  delete process.env.ADMIN_NOTIFY_JID; // no usar DM admin en tests

  try {
    // Caso 0: mensaje que NO es gatillo -> devuelve false y no llama a nadie
    let handled = await handlePaymentTrigger(msg('Hola cómo estás'));
    assert.strictEqual(handled, false);
    assert.strictEqual(capturedErp.length, 0);
    console.log('✓ Caso 0 OK: mensaje normal no dispara el gatillo');

    // Caso 0b: mensaje del CLIENTE que menciona 'acreditado' -> no dispara (fromMe=false)
    handled = await handlePaymentTrigger(msg('ya te acreditado 50 mil', false));
    assert.strictEqual(handled, false);
    assert.strictEqual(capturedErp.length, 0);
    console.log('✓ Caso 0b OK: solo responde al admin (fromMe)');

    // Caso 1: parcial -> nota privada con saldo pendiente
    handled = await handlePaymentTrigger(msg('Acreditado 150000 gs'));
    await sleep(200);
    assert.strictEqual(handled, true);
    assert.strictEqual(capturedErp[0].url, '/api/orders/267912107524268@lid/pay');
    assert.strictEqual(capturedErp[0].body.amount, 150000);
    assert.strictEqual(capturedErp[0].body.method, 'transferencia');
    let nota = lastNote();
    assert.ok(nota, 'debía publicarse una nota privada');
    assert.ok(nota.content.includes('Pago registrado en sistema por Gs. 150.000'), nota.content);
    assert.ok(nota.content.includes('saldo pendiente de Gs. 100.000'), nota.content);
    assert.ok(nota.content.includes('PAY-TEST-0001'), nota.content);
    console.log('✓ Caso 1 OK: parcial -> nota privada "Pago registrado" + saldo pendiente');

    // Caso 2: "Acreditado 50 mil" -> 50000
    await handlePaymentTrigger(msg('Acreditado 50 mil'));
    assert.strictEqual(capturedErp[1].body.amount, 50000);
    console.log('✓ Caso 2 OK: formato "50 mil"');

    // Caso 3: "Acreditado 1.500.000" -> 1500000
    await handlePaymentTrigger(msg('Acreditado 1.500.000 gs'));
    assert.strictEqual(capturedErp[2].body.amount, 1500000);
    console.log('✓ Caso 3 OK: formato con puntos de mil');

    // Caso 4: pago total (outstanding 0) -> "totalmente pagado" en nota privada
    await handlePaymentTrigger(msg('Acreditado 100000'));
    await sleep(200);
    nota = lastNote();
    assert.ok(nota.content.includes('Pedido totalmente pagado en sistema'), nota.content);
    console.log('✓ Caso 4 OK: pago total -> nota privada "totalmente pagado"');

    // Caso 5: sin monto reconocible -> nota privada, no llama al ERP
    const erpBefore = capturedErp.length;
    handled = await handlePaymentTrigger(msg('Acreditado'));
    await sleep(200);
    assert.strictEqual(handled, true);
    assert.strictEqual(capturedErp.length, erpBefore, 'no debía llamar al ERP');
    nota = lastNote();
    assert.ok(nota.content.includes('No reconocí el monto'), nota.content);
    console.log('✓ Caso 5 OK: sin monto -> nota privada, no llama al ERP');

    // Caso 6: en todo el test, cero mensajes al cliente
    assert.strictEqual(capturedDash.length, 0, JSON.stringify(capturedDash));
    assert.ok(capturedCw.every((m) => m.private === true), JSON.stringify(capturedCw));
    console.log('✓ Caso 6 OK: cero mensajes al cliente (ni WhatsApp ni salientes en Chatwoot)');

    console.log('\nTODOS LOS CASOS PASARON');
  } catch (e) {
    console.error('\n❌ FALLÓ:', e.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
