// tests/test_delivery_trigger.mjs
// Test local de los gatillos "Pedido en camino" / "Pedido entregado":
// delivery.handler.js -> dummy ERP (/api/orders/<jid>/deliver)
//                      -> dummy dashWhat2 (/send-message) = WhatsApp del CLIENTE
//                      -> dummy Chatwoot (POST .../messages) = panel del admin
// Política probada: éxito Y error -> SOLO nota privada en el panel; nada al cliente.
import assert from 'assert';
import http from 'http';
import { handleDeliveryTrigger } from '../services/message_events/delivery.handler.js';

const capturedErp = [];
const capturedDash = []; // WhatsApp del cliente
const capturedCw = [];   // publicaciones en Chatwoot

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const notesSince = (idx) => capturedCw.slice(idx).filter((m) => m.private === true);

// Un servidor dummy hace de ERP, dashWhat2 y Chatwoot
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
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
    // --- Chatwoot API dummy ---
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

const msg = (text, fromMe = true, jid = '267912107524268@lid') => ({
  key: { remoteJid: jid, fromMe },
  textContent: text,
});

server.listen(8096, async () => {
  process.env.ERP_SERVICE_URL = 'http://localhost:8096';
  process.env.DASHWHAT_URL = 'http://localhost:8096';
  process.env.CHATWOOT_API_TOKEN = 'test-token';
  process.env.CHATWOOT_URL = 'http://localhost:8096';
  process.env.CHATWOOT_INBOX_ID = '7';
  delete process.env.ADMIN_NOTIFY_JID; // no usar DM admin en tests

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

    // Caso 1: "Pedido en camino" -> deliver + confirmación como nota privada
    let cw = capturedCw.length;
    await handleDeliveryTrigger(msg('Pedido en camino'));
    await sleep(250);
    await check('Caso 1: "Pedido en camino" -> deliver(JID) + nota privada con ID y remito', () => {
      assert.strictEqual(capturedErp[0].url, '/api/orders/267912107524268@lid/deliver');
      assert.strictEqual(capturedErp[0].method, 'POST');
      const nota = notesSince(cw)[0];
      assert.ok(nota, JSON.stringify(capturedCw));
      assert.ok(nota.content.includes('pedido en camino'), nota.content);
      assert.ok(nota.content.includes('SAL-ORD-2026-TEST'), nota.content);
      assert.ok(nota.content.includes('MAT-DEC-2026-TEST'), nota.content);
    });

    // Caso 2: "Pedido entregado" -> nota privada
    cw = capturedCw.length;
    await handleDeliveryTrigger(msg('Pedido entregado'));
    await sleep(250);
    await check('Caso 2: "Pedido entregado" -> deliver + nota privada', () => {
      assert.strictEqual(capturedErp[1].url, '/api/orders/267912107524268@lid/deliver');
      const nota = notesSince(cw)[0];
      assert.ok(nota && nota.content.includes('Pedido entregado y registrado'), JSON.stringify(nota));
    });

    // Caso 3: variantes con mayúsculas/sufijos
    await handleDeliveryTrigger(msg('PEDIDO EN CAMINO 🚚 salimos'));
    await sleep(150);
    await check('Caso 3: insensible a mayúsculas y sufijos', () => {
      assert.strictEqual(capturedErp.length, 3);
    });

    // Caso 4: "entregado" suelto NO dispara
    await check('Caso 4: "entregado" suelto no dispara', async () => {
      const handled = await handleDeliveryTrigger(msg('ya esta entregado'));
      assert.strictEqual(handled, false);
    });

    // Caso 5: error del ERP (ej. pedido ya entregado) -> nota privada
    cw = capturedCw.length;
    await handleDeliveryTrigger(msg('Pedido entregado', true, 'fail@lid'));
    await sleep(250);
    await check('Caso 5: error del ERP -> nota privada al admin', () => {
      const nota = notesSince(cw)[0];
      assert.ok(nota, 'debía publicarse la nota privada en Chatwoot');
      assert.ok(nota.content.includes('no tiene pedidos activos'), nota.content);
    });

    // Caso 6: en TODO el test no salió nada al cliente (ni WhatsApp ni salientes en Chatwoot)
    await check('Caso 6: cero mensajes al cliente (ni WhatsApp ni salientes en Chatwoot)', () => {
      assert.strictEqual(capturedDash.length, 0, JSON.stringify(capturedDash));
      assert.ok(capturedCw.every((m) => m.private === true), JSON.stringify(capturedCw));
    });

    if (failed) { process.exitCode = 1; }
    else { console.log('\nTODOS LOS CASOS PASARON'); }
  } finally {
    server.close();
  }
});
