// tests/wanderer-live-simulation.test.js
import { validateAndAlignRow, formatTacticalData, KNOWN_EVE_SYSTEMS } from '../lib/ai.js';

// Exact nodes from the user's Wanderer map screenshot including the bottom nodes
const testClusters = [
  'J101020 | LWT | C1 | D1.1 | H',
  'J142923 | IYR | C4 | D1.2 | C4 | C6',
  'J150635 | TNT | C4 | D1.3 | C4 | C5',
  'J101408 | ORX | C1 | D1.4 | L',
  'J144732 | BMW | C4 | D1.5 | C2 | C4',
  'J203952 | SKV | C4 | D | C1 | C4 | 1',
  'Loguttur | NWZ | 1.0 | D2.2',
  'Orduin | XXQ | 0.8 | D2.3',
  'Mercomesier | WVR | 0.1 | A1.1 | 3',
  'J125049 | BRN | C3 | A | L | 2',
  'J215758 | SGE | C4 | PG | C3 | C5 | 5',
  'J113907 | C5 | B | C6 | [HOME ACTIVE]',
  'J204635 | LTF | C4 | E | C1 | C2',
  'J142327 | RWB | C1 | E1.1 | H',
  'J122524 | XHY | C2 | E1.2 | C5 | N',
  'J111447 | VDX | C6 | E1.3 | C5',
  'J104136 | EEJ | C6 | E1.4 | C5',
  'Apanake | 0.5 | Genesis',
  'Pakhshi | 0.8 | Genesis',
  'Kassigainen | 0.9 | The Citadel'
];

console.log('--- RUNNING LIVE WANDERER MAP SCREENSHOT SIMULATION TEST ---');
const records = testClusters.map(c => validateAndAlignRow(c));
const tsv = formatTacticalData(records, 'tsv');

console.log('Generated Clean TSV Output:\n---------------------------\n' + tsv);

// Verify Home System J113907
const home = records.find(r => r.system === 'J113907');
if (!home || home.signature !== '-' || home.class !== 'C5') {
  throw new Error(`Home system J113907 incorrect: ${JSON.stringify(home)}`);
}

// Verify Selected System J215758 (SGE, C4, 5 pilots)
const j215758 = records.find(r => r.system === 'J215758');
if (!j215758 || j215758.signature !== 'SGE' || j215758.class !== 'C4' || j215758.pilots !== '5') {
  throw new Error(`J215758 incorrect: ${JSON.stringify(j215758)}`);
}

// Verify Mercomesier (WVR, Lowsec, 3 pilots)
const mercom = records.find(r => r.system === 'Mercomesier');
if (!mercom || mercom.signature !== 'WVR' || mercom.class !== 'Lowsec' || mercom.pilots !== '3') {
  throw new Error(`Mercomesier incorrect: ${JSON.stringify(mercom)}`);
}

// Verify Apanake (0.5 security -> Highsec)
const apanake = records.find(r => r.system === 'Apanake');
if (!apanake || apanake.signature !== '-' || apanake.class !== 'Highsec') {
  throw new Error(`Apanake incorrect: ${JSON.stringify(apanake)}`);
}

// Verify Pakhshi and Kassigainen (0.8 and 0.9 security -> Highsec)
const pakhshi = records.find(r => r.system === 'Pakhshi');
if (!pakhshi || pakhshi.class !== 'Highsec') {
  throw new Error(`Pakhshi incorrect: ${JSON.stringify(pakhshi)}`);
}

const kass = records.find(r => r.system === 'Kassigainen');
if (!kass || kass.class !== 'Highsec') {
  throw new Error(`Kassigainen incorrect: ${JSON.stringify(kass)}`);
}

// Verify all J-systems have valid signatures (or '-' for home)
for (const r of records) {
  if (r.system.startsWith('J') && r.system !== 'J113907' && r.signature === '-') {
    throw new Error(`System ${r.system} is missing signature!`);
  }
}

console.log('✅ All Wanderer Live Screenshot validations PASSED completely!');
