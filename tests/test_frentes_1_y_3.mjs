import assert from 'assert';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOCK_PORT = 13007;
process.env.CHATWOOT_URL = `http://127.0.0.1:${MOCK_PORT}`;
process.env.CHATWOOT_ACCOUNT_ID = '1';
process.env.CHATWOOT_INBOX_ID = '4';
process.env.CHATWOOT_API_TOKEN = 'test-token';

const { forwardIncomingToChatwoot } = await import('../services/chatwoot.service.js');

// Lanzamos el mock
const mockPath = path.resolve(__dirname, '../../../tools/mock-chatwoot/mock_chatwoot.py');
const mockProc = spawn('python3', [mockPath], {
  env: { ...process.env, PORT: String(MOCK_PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});

mockProc.stdout.on('data', (d) => console.log('[mock-out]', d.toString().trim()));
mockProc.stderr.on('data', (d) => console.error('[mock-err]', d.toString().trim()));

await new Promise((resolve) => setTimeout(resolve, 600));

try {
  console.log('=== TEST FRENTE 1: Prevención de fragmentación de conversaciones ===');
  const jid = '595981999888@s.whatsapp.net';

  // 1. Mensaje 1
  await forwardIncomingToChatwoot({
    jid,
    name: 'Cliente Reabierto',
    text: 'Hola Voraz!',
    fromMe: false,
    messageId: 'M-1'
  });

  // 2. Simular que la conversación se resolvió (status = resolved)
  const resDump1 = await fetch(`http://127.0.0.1:${MOCK_PORT}/_mock/dump`);
  const dump1 = await resDump1.json();
  const firstConvId = Object.keys(dump1.conversations)[0];
  
  await fetch(`http://127.0.0.1:${MOCK_PORT}/api/v1/accounts/1/conversations/${firstConvId}/toggle_status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'resolved' })
  });
  console.log(`Conversación #${firstConvId} marcada como resolved`);

  // 3. Llega mensaje 2 del cliente. Debe REABRIR la conversación, NO crear una nueva (fragmentación = 0)
  await forwardIncomingToChatwoot({
    jid,
    name: 'Cliente Reabierto',
    text: 'Quiero hacer un pedido para mañana',
    fromMe: false,
    messageId: 'M-2'
  });

  const resDump2 = await fetch(`http://127.0.0.1:${MOCK_PORT}/_mock/dump`);
  const dump2 = await resDump2.json();
  const convs = Object.values(dump2.conversations);

  console.log(`Total conversaciones para el contacto: ${convs.length} (esperado: 1)`);
  console.log(`Estado de conversación #${firstConvId}: ${convs[0].status} (esperado: open)`);

  assert.strictEqual(convs.length, 1, 'NO debe haber fragmentación: debe reutilizar/reabrir la conversación');
  assert.strictEqual(convs[0].status, 'open', 'La conversación debe estar en open');
  assert.strictEqual(dump2.messages.length, 2, 'Los 2 mensajes deben estar en la misma conversación');

  console.log('✓ FRENTE 1 VERIFICADO CON ÉXITO.\n');
} finally {
  mockProc.kill();
}
