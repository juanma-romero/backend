// tests/test_delivery_trigger.mjs
// Test local de los gatillos "Pedido en camino" / "Pedido entregado":
// delivery.handler.js -> dummy ERP (/api/orders/<jid>/deliver) -> dummy dashWhat2 (/send-message)
import assert from 'assert';
import http from 'http';
import { handleDeliveryTrigger } from '../services/message_events/delivery.handler.js';

const capturedErp = [];
const capturedDash = [];

let failed = false;
const check = async (label, fn) => {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (e) {
    failed = true;
    console.error(`❌ ${label}: ${e.message}`);
  }
};

// Servidor dummy: erp-service (/deliver; el JID "fail@lid" simula error 400) + dashWhat2 (/send-message)
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', async () => {
    if (req.url.startsWith('/api/orders/')) {
      capturedErp.push({ url: req.url, method: req.method });
      if (req.url.includes('fail@lid')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ detail: 'El cliente no tiene pedidos activos pendientes de entrega o cobro.' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        order_id: 'SAL-ORD-2026-TEST',
        message: 'Pedido entregado correctamente',
        delivery_note: 'MAT-DEC-2026-TEST'
      }));
    }
    if (req.url === '/send-message') {
      capturedDash.push(body ? JSON.parse(body) : {});
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }
    res.writeHead(404);
    res.end();
  });
});

const msg = (text, fromMe = true, jid = '267912107524268@lid') => ({
  key: { remoteJid: jid, fromMe },
  textContent: text,
});

server.listen(8096, async () => {
  process.env.ERP_SERVICE_URL = 'http://localhost:8096';
  process.env.DASHWHAT_URL = 'http://localhost:8096';

  try {
    // Caso 0: mensaje normal no dispara
    await check('Caso 0: mensaje normal no dispara el gatillo de entrega', async () => {
      const handled = await handleDeliveryTrigger(msg('Listo, gracias'));
      assert.strictEqual(handled, false);
    });

    // Caso 0b: mensaje del CLIENTE "Pedido entregado" no dispara (fromMe=false)
    await check('Caso 0b: solo responde al admin (fromMe)', async () => {
      const handled = await handleDeliveryTrigger(msg('Pedido entregado', false));
      assert.strictEqual(handled, false);
    });

    // Caso 1: "Pedido en camino" -> deliver con el JID + confirmación con ID y remito
    await handleDeliveryTrigger(msg('Pedido en camino'));
    await check('Caso 1: "Pedido en camino" -> deliver(JID) + confirmación con remito', () => {
      assert.strictEqual(capturedErp[0].url, '/api/orders/267912107524268@lid/deliver');
      assert.strictEqual(capturedErp[0].method, 'POST');
      assert.ok(capturedDash[0].message.includes('pedido en camino'), capturedDash[0].message);
      assert.ok(capturedDash[0].message.includes('SAL-ORD-2026-TEST'), capturedDash[0].message);
      assert.ok(capturedDash[0].message.includes('MAT-DEC-2026-TEST'), capturedDash[0].message);
    });

    // Caso 2: "Pedido entregado" -> registra entrega
    await handleDeliveryTrigger(msg('Pedido entregado'));
    await check('Caso 2: "Pedido entregado" -> deliver + confirmación', () => {
      assert.strictEqual(capturedErp[1].url, '/api/orders/267912107524268@lid/deliver');
      assert.ok(capturedDash[1].message.includes('Pedido entregado y registrado'), capturedDash[1].message);
    });

    // Caso 3: variantes con mayúsculas/sufijos
    await handleDeliveryTrigger(msg('PEDIDO EN CAMINO 🚚 salimos'));
    await check('Caso 3: insensible a mayúsculas y sufijos', () => {
      assert.strictEqual(capturedErp.length, 3);
    });

    // Caso 4: "entregado" suelto NO dispara
    await check('Caso 4: "entregado" suelto no dispara', async () => {
      const handled = await handleDeliveryTrigger(msg('ya esta entregado'));
      assert.strictEqual(handled, false);
    });

    // Caso 5: error del ERP -> ❌ con detalle en el chat
    await handleDeliveryTrigger(msg('Pedido entregado', true, 'fail@lid'));
    await check('Caso 5: error del ERP se reporta al chat con el detalle', () => {
      const reply = capturedDash[3].message;
      assert.ok(reply.includes('❌'), reply);
      assert.ok(reply.includes('no tiene pedidos activos'), reply);
    });

    if (failed) { process.exitCode = 1; }
    else { console.log('\nTODOS LOS CASOS PASARON'); }
  } finally {
    server.close();
  }
});
