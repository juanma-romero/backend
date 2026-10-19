import assert from 'assert';
import { classifyClientResponse } from '../services/pending_orders.service.js';
import http from 'http';

// Servidor mock para simular ia-service /classify-order-intent
let lastRequestBody = null;
const mockServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    lastRequestBody = JSON.parse(body);
    const prompt = lastRequestBody.prompt.toLowerCase();

    let intent = 'OTRO';
    let confianza = 0.9;
    let motivo = 'Simulado';

    if (prompt.includes('dale') || prompt.includes('metele') || prompt.includes('sí') || prompt.includes('si')) {
      intent = 'CONFIRMAR';
    } else if (prompt.includes('cambiame') || prompt.includes('mejor') || prompt.includes('modificar')) {
      intent = 'MODIFICAR';
    } else if (prompt.includes('bancame') || prompt.includes('espera') || prompt.includes('te aviso')) {
      intent = 'PEDIR_TIEMPO';
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ intent, confianza, motivo }));
  });
});

mockServer.listen(8098, async () => {
  process.env.IA_SERVICE_URL = 'http://localhost:8098';

  try {
    console.log('Probando clasificación de intenciones con mock...');
    
    // Caso 1: Confirmar
    let res = await classifyClientResponse('Dale capo, agendame nomas');
    assert.strictEqual(res.intent, 'CONFIRMAR');
    console.log('✓ Confirmar reconocido:', res);

    // Caso 2: Modificar
    res = await classifyClientResponse('Mejor cambiame por empanaditas');
    assert.strictEqual(res.intent, 'MODIFICAR');
    console.log('✓ Modificar reconocido:', res);

    // Caso 3: Pedir tiempo
    res = await classifyClientResponse('Bancame un toque que consulto');
    assert.strictEqual(res.intent, 'PEDIR_TIEMPO');
    console.log('✓ Pedir tiempo reconocido:', res);

    console.log('¡Todos los tests de intención pasaron correctamente!');
  } catch (err) {
    console.error('Error en tests:', err);
    process.exitCode = 1;
  } finally {
    mockServer.close();
  }
});
