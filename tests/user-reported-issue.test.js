// tests/user-reported-issue.test.js
import { validateAndAlignRow, formatTacticalData } from '../lib/ai.js';

// Exact input clusters representing the systems reported by the user
const rawClusters = [
  'Torrinos | RCP | Highsec | 0.5 | A1.3',
  'J163745 | EKR | C3 | A | H',
  'J121347 | SUB | C4 | A1.1 | C1 | C3',
  'J215758 | FEH | C4 | PG | C3 | C5 | 2',
  'J114403 | C5',
  'J155040 | SGA | C5 | A1.2 | C3',
  'J204350 | WUQ | C5 | B1.2 | C3,',
  'J232741 | C5 | B | 20'
];

const rows = rawClusters.map(c => validateAndAlignRow(c));
const tsv = formatTacticalData(rows, 'tsv');
const lines = tsv.trim().split('\n');

console.log('Generated TSV:\n' + tsv);

// Verify headers
if (lines[0] !== 'System\tSignature\tClass\tTags\tStatics\tPilots') {
  throw new Error(`Expected header "System\\tSignature\\tClass\\tTags\\tStatics\\tPilots", got: "${lines[0]}"`);
}

// 1. Torrinos
if (!lines[1].startsWith('Torrinos\tRCP\tHighsec(0.5)\tA1.3\t-\t')) {
  throw new Error(`Torrinos row failed: "${lines[1]}"`);
}

// 2. J163745
if (!lines[2].startsWith('J163745\tEKR\tC3\tA\tH\t')) {
  throw new Error(`J163745 row failed: "${lines[2]}"`);
}

// 3. J121347
if (!lines[3].startsWith('J121347\tSUB\tC4\tA1.1\tC1, C3\t')) {
  throw new Error(`J121347 row failed: "${lines[3]}"`);
}

// 4. J215758
if (lines[4] !== 'J215758\tFEH\tC4\tPG\tC3, C5\t2') {
  throw new Error(`J215758 row failed: "${lines[4]}"`);
}

// 5. J114403
if (!lines[5].startsWith('J114403\t-\tC5\t-\t-\t')) {
  throw new Error(`J114403 row failed: "${lines[5]}"`);
}

// 6. J155040
if (!lines[6].startsWith('J155040\tSGA\tC5\tA1.2\tC3\t')) {
  throw new Error(`J155040 row failed: "${lines[6]}"`);
}

// 7. J204350
if (!lines[7].startsWith('J204350\tWUQ\tC5\tB1.2\tC3\t')) {
  throw new Error(`J204350 row failed: "${lines[7]}"`);
}

// 8. J232741 (C5, Tag B, Statics - or empty, Pilots 20)
if (lines[8] !== 'J232741\t-\tC5\tB\t-\t20' && lines[8] !== 'J232741\t-\tC5\tB\t\t20') {
  throw new Error(`J232741 row failed: "${lines[8]}"`);
}

// 9. J232741 with C5 static (as shown in the live screenshot)
const rowWithStatic = validateAndAlignRow('J232741 | C5 | B | C5 | 20');
if (rowWithStatic.statics !== 'C5' || rowWithStatic.tags !== 'B' || rowWithStatic.pilots !== '20') {
  throw new Error(`J232741 with C5 static failed: ${JSON.stringify(rowWithStatic)}`);
}
const tsvWithStatic = formatTacticalData([rowWithStatic], 'tsv');
if (!tsvWithStatic.includes('J232741\t-\tC5\tB\tC5\t20')) {
  throw new Error(`TSV formatting with C5 static failed: ${tsvWithStatic}`);
}

console.log('✅ User reported issue test passed!');
