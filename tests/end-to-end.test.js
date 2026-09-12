// tests/end-to-end.test.js
import fs from 'fs';
import path from 'path';
import { validateAndAlignRow, formatTacticalData } from '../lib/ai.js';

// Load the actual sandbox/test-map.html
const htmlPath = path.resolve('sandbox/test-map.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Regex to extract <g class="node..."> content from the HTML
const gNodeRegex = /<g\s+class="node[^"]*"[^>]*>([\s\S]*?)<\/g>/gi;
let match;
const clusters = [];

while ((match = gNodeRegex.exec(html)) !== null) {
  const gContent = match[1];
  const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/gi;
  let textMatch;
  const tokens = [];
  while ((textMatch = textRegex.exec(gContent)) !== null) {
    const txt = textMatch[1].trim();
    if (txt && !txt.startsWith('[')) { // Skip [HOME ACTIVE] annotation
      tokens.push(txt);
    }
  }
  if (tokens.length > 0) {
    clusters.push(tokens.join(' | '));
  }
}

console.log(`Extracted ${clusters.length} clusters from sandbox/test-map.html:`);
for (const c of clusters) console.log(' •', c);

if (clusters.length < 6) {
  throw new Error(`Expected at least 6 clusters in test map, found ${clusters.length}`);
}

// Pass each cluster through the semantic validator
const records = clusters.map(c => validateAndAlignRow(c));

// Generate TSV
const tsv = formatTacticalData(records, 'tsv');
console.log('\nGenerated TSV Output:\n---------------------\n' + tsv);

// Validate key systems
const home = records.find(r => r.system === 'J113907');
if (!home || home.signature !== '-' || home.class !== 'C5' || home.pilots !== '4') {
  throw new Error(`Home system J113907 misaligned: ${JSON.stringify(home)}`);
}

const nullsec1 = records.find(r => r.system === '38G6-L');
if (!nullsec1 || nullsec1.signature !== 'ORX') {
  throw new Error(`Nullsec system 38G6-L misaligned: ${JSON.stringify(nullsec1)}`);
}

const nullsec2 = records.find(r => r.system === 'N-K4Q0');
if (!nullsec2 || nullsec2.signature !== 'EEJ') {
  throw new Error(`Nullsec system N-K4Q0 misaligned: ${JSON.stringify(nullsec2)}`);
}

const jita = records.find(r => r.system === 'Jita');
if (!jita || jita.signature !== 'BMW' || jita.class !== 'Highsec') {
  throw new Error(`Jita misaligned: ${JSON.stringify(jita)}`);
}

console.log('✅ End-to-End Extraction & Alignment test against real test-map.html passed completely!');
