import assert from 'assert';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuramos variables de entorno para que chatwoot.service.js use el mock
const MOCK_PORT = 13006;
process.env.CHATWOOT_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.CHATWOOT_ACCOUNT_ID = '1';
process.env.CHATWOOT_INBOX_ID = '4';
process.env.CHATWOOT_API_TOKEN = 'test-token';

// Importamos el servicio dinámicamente luego de configurar env
const { forwardIncomingToChatwoot, getOrCreateContact, getOrCreateConversation } = await import('../services/chatwoot.service.js');

// Lanzamos el mock de Chatwoot
const mockPath = path.resolve(__dirname, '../../../tools/mock-chatwoot/mock_chatwoot.py');
const mockProc = spawn('python3', [mockPath], {
  env: { ...process.env, PORT: String(MOCK_PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});

mockProc.stdout.on('data', (d) => console.log('[mock-out]', d.toString().trim()));
mockProc.stderr.on('data', (d) => console.error('[mock-err]', d.toString().trim()));

// Esperar que el mock arranque
await new Promise((resolve) => setTimeout(resolve, 600));

try {
  console.log('=== Test 1: Primer mensaje entrante del cliente ===');
  await forwardIncomingToChatwoot({
    jid: '595982333444@s.whatsapp.net',
    name: 'Carlos Gomez',
    text: 'Hola, tienen empanadas para hoy?',
    fromMe: false,
    messageId: 'MSG-001'
  });

  console.log('=== Test 2: Segundo mensaje del mismo cliente (mismo hilo) ===');
  await forwardIncomingToChatwoot({
    jid: '595982333444@s.whatsapp.net',
    name: 'Carlos Gomez',
    text: 'Y a que hora entregan?',
    fromMe: false,
    messageId: 'MSG-002'
  });

  console.log('=== Test 3: Respuesta del admin desde WhatsApp (fromMe = true) ===');
  await forwardIncomingToChatwoot({
    jid: '595982333444@s.whatsapp.net',
    name: 'Carlos Gomez',
    text: 'Hola Carlos! Si, entregamos a partir de las 18hs.',
    fromMe: true,
    messageId: 'MSG-003'
  });

  // Consultar estado final del mock
  const res = await fetch(`http://127.0.0.1:${MOCK_PORT}/_mock/dump`);
  const dump = await res.json();

  console.log('\n=== Verificación de resultados ===');
  const contacts = Object.values(dump.contacts);
  const conversations = Object.values(dump.conversations);
  const messages = dump.messages;

  console.log(`Contactos: ${contacts.length} (esperado: 1)`);
  console.log(`Conversaciones: ${conversations.length} (esperado: 1)`);
  console.log(`Mensajes: ${messages.length} (esperado: 3)`);

  assert.strictEqual(contacts.length, 1, 'Debe haber exactamente 1 contacto');
  assert.strictEqual(conversations.length, 1, 'Debe haber EXACTAMENTE 1 conversación (NO fragmentada)');
  assert.strictEqual(messages.length, 3, 'Debe haber 3 mensajes');

  // Verificar dirección y atributos
  assert.strictEqual(messages[0].message_type, 'incoming', 'Msg 1 debe ser incoming');
  assert.strictEqual(messages[0].content_attributes.by, 'client');

  assert.strictEqual(messages[1].message_type, 'incoming', 'Msg 2 debe ser incoming');
  assert.strictEqual(messages[1].content_attributes.by, 'client');

  assert.strictEqual(messages[2].message_type, 'outgoing', 'Msg 3 debe ser outgoing (admin respondiendo)');
  assert.strictEqual(messages[2].content_attributes.by, 'admin');

  console.log('\n✓ TEST COMPLETADO CON ÉXITO: 0 fragmentación, dirección correcta y marcado de origen verificado.');
} finally {
  mockProc.kill();
}
