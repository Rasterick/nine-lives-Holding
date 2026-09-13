// tests/formatters.test.js
import { formatSignaturesData } from '../lib/formatters.js';

const mockData = {
  system: 'J215758',
  class: 'C4',
  signatures: [
    { id: 'BSG-714', group: 'Wormhole', info: 'A C247 C3 J172701' },
    { id: 'RIS-443', group: 'Wormhole', info: 'D X877 C4 J120409' },
    { id: 'SVG-364', group: 'Combat Site', info: 'Frontier Command Post' }
  ]
};

console.log('--- Testing formatSignaturesData ---');

// 1. TSV Test
const tsv = formatSignaturesData(mockData, 'tsv');
const tsvLines = tsv.trim().split('\n');
if (tsvLines[0] !== 'J215758 (C4)') {
  throw new Error(`Expected first line to be "J215758 (C4)", got "${tsvLines[0]}"`);
}
if (tsvLines[1] !== 'BSG-714\tWormhole\tA C247 C3 J172701') {
  throw new Error(`Expected row 1 tab-delimited, got "${tsvLines[1]}"`);
}
if (tsvLines.length !== 4) {
  throw new Error(`Expected 4 lines total (header + 3 rows), got ${tsvLines.length}`);
}

// 2. JSON Test
const jsonStr = formatSignaturesData(mockData, 'json');
const parsed = JSON.parse(jsonStr);
if (parsed.system !== 'J215758' || parsed.signatures.length !== 3) {
  throw new Error(`JSON output invalid: ${jsonStr}`);
}

// 3. Markdown Test
const md = formatSignaturesData(mockData, 'markdown');
if (!md.includes('### J215758 (C4)') || !md.includes('| BSG-714 | Wormhole | A C247 C3 J172701 |')) {
  throw new Error(`Markdown output invalid: ${md}`);
}

console.log('✅ Formatter tests passed!');
