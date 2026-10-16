import assert from 'assert';
import { getDateStringInTimezone, getStartOfDayInTimezone, DEFAULT_TIMEZONE } from '../services/date.service.js';

// Test 1: Simulating 21:30 in Asuncion (00:30 UTC next day)
// In UTC, this is 2026-10-17T00:30:00Z. In America/Asuncion (UTC-3), it is 2026-10-16 21:30:00.
const lateNightUtc = new Date('2026-10-17T00:30:00Z');
const dateStrHoy = getDateStringInTimezone(lateNightUtc);
console.log('Test 1 (Hoy at 21:30 local):', dateStrHoy);
assert.strictEqual(dateStrHoy, '2026-10-16', 'Hoy at 21:30 local should be 2026-10-16');

// Test 2: Manana calculation at 21:30 local
const tomorrowUtc = new Date(lateNightUtc.getTime() + 24 * 60 * 60 * 1000);
const dateStrManana = getDateStringInTimezone(tomorrowUtc);
console.log('Test 2 (Mañana at 21:30 local):', dateStrManana);
assert.strictEqual(dateStrManana, '2026-10-17', 'Mañana at 21:30 local should be 2026-10-17');

// Test 3: Early morning in Asuncion (00:15 local = 03:15 UTC)
const earlyMorningUtc = new Date('2026-10-17T03:15:00Z');
const dateStrEarly = getDateStringInTimezone(earlyMorningUtc);
console.log('Test 3 (Early morning at 00:15 local):', dateStrEarly);
assert.strictEqual(dateStrEarly, '2026-10-17', 'Early morning should be 2026-10-17');

console.log('All date tests passed successfully!');
