// tests/ai-parser.test.js
import { formatTacticalData, validateAndAlignRow, parseWithChromeAI } from '../lib/ai.js';

// Test Edge Case 1: J113907 has NO 3-letter signature ID!
// Tokens: ['J113907', 'C5', 'B', 'C6', '4']
const row1 = validateAndAlignRow(['J113907', 'C5', 'B', 'C6', '4']);
if (row1.system !== 'J113907') {
  throw new Error(`Expected system J113907, got ${row1.system}`);
}
if (row1.signature !== '-') {
  throw new Error(`Expected signature '-', got ${row1.signature}`);
}
if (row1.class !== 'C5') {
  throw new Error(`Expected class 'C5', got ${row1.class}`);
}
if (row1.pilots !== '4') {
  throw new Error(`Expected pilots '4', got ${row1.pilots}`);
}

// Test Edge Case 2: Nullsec system 38G6-L with signature ORX and statics
const row2 = validateAndAlignRow(['38G6-L', 'ORX', 'Nullsec', 'D1.4', 'L']);
if (row2.system !== '38G6-L' || row2.signature !== 'ORX' || row2.class !== 'Nullsec') {
  throw new Error(`Nullsec alignment failed: ${JSON.stringify(row2)}`);
}

// Test Edge Case 3: K-space named system (Jita) with sig BMW
const row3 = validateAndAlignRow(['Jita', 'BMW', 'Highsec', 'Trade Hub']);
if (row3.system !== 'Jita' || row3.signature !== 'BMW' || row3.class !== 'Highsec') {
  throw new Error(`Named system alignment failed: ${JSON.stringify(row3)}`);
}

// Test TSV Output Format (Strict Column Alignment Guarantee)
const tsv = formatTacticalData([row1, row2, row3], 'tsv');
const lines = tsv.trim().split('\n');

if (lines[0] !== 'System\tSignature\tClass\tTags\tStatics\tPilots') {
  throw new Error(`TSV header malformed: ${lines[0]}`);
}

// Verify row 1 line: J113907\t-\tC5\tB\tC6\t4
if (lines[1] !== 'J113907\t-\tC5\tB\tC6\t4') {
  throw new Error(`Row 1 TSV line incorrect: ${lines[1]}`);
}

// Verify row 2 line: 38G6-L\tORX\tNullsec\tD1.4, L\t-\t
if (lines[2] !== '38G6-L\tORX\tNullsec\tD1.4, L\t-\t') {
  throw new Error(`Row 2 TSV line incorrect: ${lines[2]}`);
}

// Test JSON Output Format
const json = formatTacticalData([row1, row2, row3], 'json');
const parsedJson = JSON.parse(json);
if (!Array.isArray(parsedJson) || parsedJson.length !== 3) {
  throw new Error('JSON format invalid');
}
if (parsedJson[0].statics !== 'C6' || parsedJson[0].tags !== 'B') {
  throw new Error(`JSON Statics/Tags separation failed: ${JSON.stringify(parsedJson[0])}`);
}

// Test Markdown Table Output
const md = formatTacticalData([row1, row2], 'markdown');
if (!md.includes('| **J113907** | - | C5 | B | C6 | 4 |')) {
  throw new Error('Markdown table format invalid');
}

console.log('✅ AI Parser, Column Alignment & Formatter validation passed!');
