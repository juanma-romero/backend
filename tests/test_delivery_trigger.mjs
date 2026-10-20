// tests/test_delivery_trigger.mjs
// Test local de los gatillos "Pedido en camino" / "Pedido entregado":
// delivery.handler.js -> dummy ERP (/api/orders/<jid>/deliver)
//                      -> dummy dashWhat2 (/send-message) = WhatsApp del CLIENTE
//                      -> dummy Chatwoot (POST .../messages) = panel del admin
// Política probada: éxito -> mensaje al cliente + espejo en panel;
//                     error -> SOLO nota privada en el panel, nada al cliente.
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

    // Caso 1: "Pedido en camino" -> deliver con el JID + confirmación con ID y remito
    await handleDeliveryTrigger(msg('Pedido en camino'));
    await sleep(250); // el mirror a Chatwoot es async
    await check('Caso 1: "Pedido en camino" -> deliver(JID) + confirmación con remito', () => {
      assert.strictEqual(capturedErp[0].url, '/api/orders/267912107524268@lid/deliver');
      assert.strictEqual(capturedErp[0].method, 'POST');
      assert.ok(capturedDash[0].message.includes('pedido en camino'), capturedDash[0].message);
      assert.ok(capturedDash[0].message.includes('SAL-ORD-2026-TEST'), capturedDash[0].message);
      assert.ok(capturedDash[0].message.includes('MAT-DEC-2026-TEST'), capturedDash[0].message);
    });

    // Caso 2: la confirmación ALSO se espeja al panel como outgoing (no privada)
    await check('Caso 2: confirmación espejada en el panel (outgoing, no privada)', () => {
      const mirror = capturedCw.find((m) => m.message_type === 'outgoing' && m.private === false);
      assert.ok(mirror, JSON.stringify(capturedCw));
      assert.ok(mirror.content.includes('pedido en camino'), mirror.content);
    });

    // Caso 3: "Pedido entregado" -> registra entrega
    await handleDeliveryTrigger(msg('Pedido entregado'));
    await sleep(250);
    await check('Caso 3: "Pedido entregado" -> deliver + confirmación', () => {
      assert.strictEqual(capturedErp[1].url, '/api/orders/267912107524268@lid/deliver');
      assert.ok(capturedDash[1].message.includes('Pedido entregado y registrado'), capturedDash[1].message);
    });

    // Caso 4: variantes con mayúsculas/sufijos
    await handleDeliveryTrigger(msg('PEDIDO EN CAMINO 🚚 salimos'));
    await sleep(150);
    await check('Caso 4: insensible a mayúsculas y sufijos', () => {
      assert.strictEqual(capturedErp.length, 3);
    });

    // Caso 5: "entregado" suelto NO dispara
    await check('Caso 5: "entregado" suelto no dispara', async () => {
      const handled = await handleDeliveryTrigger(msg('ya esta entregado'));
      assert.strictEqual(handled, false);
    });

    // Caso 6: error del ERP (ej. pedido ya entregado) -> SOLO nota privada; nada al cliente
    const dashBefore = capturedDash.length;
    await sleep(200); // drenar mirrors pendientes
    const cwBefore = capturedCw.length;
    await handleDeliveryTrigger(msg('Pedido entregado', true, 'fail@lid'));
    await sleep(250);
    await check('Caso 6: error del ERP -> nota privada al admin y silencio en el WhatsApp del cliente', () => {
      assert.strictEqual(capturedDash.length, dashBefore, 'no debía salir ningún mensaje al WhatsApp del cliente');
      const nota = capturedCw.slice(cwBefore).find((m) => m.private === true);
      assert.ok(nota, 'debía publicarse la nota privada en Chatwoot');
      assert.ok(nota.content.includes('no tiene pedidos activos'), nota.content);
    });

    if (failed) { process.exitCode = 1; }
    else { console.log('\nTODOS LOS CASOS PASARON'); }
  } finally {
    server.close();
  }
});
