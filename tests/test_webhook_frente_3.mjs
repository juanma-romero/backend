import assert from 'assert';
import express from 'express';
import router from '../routes/chatwoot.routes.js';

// Test directo de la ruta del webhook saliente de Chatwoot
const app = express();
app.use(express.json());
app.use('/api/chatwoot', router);

const server = app.listen(13008, '127.0.0.1');

try {
  console.log('=== TEST FRENTE 3: Webhook saliente de Chatwoot ===');

  // 1. Mensaje de eco generado por la integración (debe ser ignorado silenciosamente sin bucles)
  const echoRes = await fetch('http://127.0.0.1:13008/api/chatwoot/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'message_created',
      message_type: 'outgoing',
      content: 'Mensaje de eco emitido por dashwhat2',
      content_attributes: { source: 'dashwhat2' },
      conversation: { contact_inbox: { source_id: '595981111111@s.whatsapp.net' } },
      sender: { name: 'Admin', type: 'user' }
    })
  });
  const echoJson = await echoRes.json();
  assert.strictEqual(echoJson.status, 'ignored_echo', 'El mensaje con source=dashwhat2 debe ser ignorado');
  console.log('✓ Anti-bucle verificado: source=dashwhat2 es ignorado.');

  // 2. Mensaje escrito por el operador en el panel con gatillo 'Entonces te agendo: ...'
  // (Verificamos que la ruta responde 200 y despacha)
  const operatorRes = await fetch('http://127.0.0.1:13008/api/chatwoot/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'message_created',
      message_type: 'outgoing',
      content: 'Entonces te agendo: 100 combos para el 20/10 a nombre de Juan',
      content_attributes: {},
      conversation: { contact_inbox: { source_id: '595981111111@s.whatsapp.net' } },
      sender: { name: 'Zulma Mareco', type: 'user' }
    })
  });
  const operatorJson = await operatorRes.json();
  assert.strictEqual(operatorJson.status, 'ok', 'Debe despachar el mensaje a WhatsApp y al procesador de eventos');
  console.log('✓ Despacho y ejecución de eventos desde panel verificado.');

  console.log('\n✓ TEST FRENTE 3 COMPLETADO CON ÉXITO.');
} finally {
  server.close();
}
