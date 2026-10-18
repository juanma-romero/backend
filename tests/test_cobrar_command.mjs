import assert from 'assert';
import { execute } from '../services/commands/ingresos/cobrar.js';
import http from 'http';

// Servidor dummy para interceptar los requests de axios a erpServiceUrl
const capturedRequests = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    capturedRequests.push({
      method: req.method,
      url: req.url,
      body: body ? JSON.parse(body) : null
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      order_id: 'SAL-ORD-2026-TEST',
      sales_invoice: 'SINV-TEST-0001',
      payment_entry: 'PAY-TEST-0001'
    }));
  });
});

server.listen(8099, async () => {
  process.env.ERP_SERVICE_URL = 'http://localhost:8099';

  try {
    // Caso 1: Orden de Venta directa
    let res = await execute(['SAL-ORD-2026-00349', 'transferencia']);
    assert.strictEqual(capturedRequests[0].url, '/api/orders/SAL-ORD-2026-00349/pay');
    assert.strictEqual(capturedRequests[0].body.method, 'transferencia');
    console.log('✓ Caso 1 OK: ID de Orden directa');

    // Caso 2: Teléfono con espacios
    res = await execute(['+595', '981', '111111', '50000', 'efectivo']);
    assert.strictEqual(capturedRequests[1].url, '/api/orders/595981111111@s.whatsapp.net/pay');
    assert.strictEqual(capturedRequests[1].body.amount, 50000);
    assert.strictEqual(capturedRequests[1].body.method, 'efectivo');
    console.log('✓ Caso 2 OK: Teléfono con espacios');

    // Caso 3: Nombre simple
    res = await execute(['Ramiro', 'transferencia']);
    assert.strictEqual(capturedRequests[2].url, '/api/orders/Ramiro/pay');
    assert.strictEqual(capturedRequests[2].body.method, 'transferencia');
    console.log('✓ Caso 3 OK: Nombre simple');

    // Caso 4: Nombre compuesto
    res = await execute(['Maria', 'Jose', '198', 'mil', 'transferencia']);
    assert.strictEqual(capturedRequests[3].url, '/api/orders/Maria%20Jose/pay');
    assert.strictEqual(capturedRequests[3].body.amount, 198000);
    assert.strictEqual(capturedRequests[3].body.method, 'transferencia');
    console.log('✓ Caso 4 OK: Nombre compuesto + monto con mil');

    // Caso 5: JID directo
    res = await execute(['595982222222@s.whatsapp.net', 'efectivo']);
    assert.strictEqual(capturedRequests[4].url, '/api/orders/595982222222@s.whatsapp.net/pay');
    console.log('✓ Caso 5 OK: JID directo');

    console.log('¡Todos los tests unitarios de cobrar.js pasaron exitosamente!');
  } catch (err) {
    console.error('Test falló:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
