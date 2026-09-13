// tests/signatures-simulation.test.js
import { extractWandererSignaturesFromHtml } from '../content/signatures-extractor.js';
import { formatSignaturesData } from '../lib/formatters.js';

// Exact HTML table reproducing the user's Wanderer screenshot
const mockScreenshotHtml = `
<div class="signatures-panel">
  <div class="signatures-header">
    <span class="count">[6]</span>
    <span class="title">Signatures in</span>
    <span class="badge badge-c4" style="color: #f59e0b;">C4</span>
    <span class="sys-name">J215758</span>
    <span class="lazy-del">Lazy delete [x]</span>
  </div>
  <table class="wanderer-sigs-table">
    <thead>
      <tr>
        <th>Id <span>↑=</span></th>
        <th>Group <span>↑↓</span></th>
        <th>Info <span>↑↓</span></th>
        <th>Description <span>↑↓</span></th>
        <th>Added <span>↑↓</span></th>
        <th>Updated <span>↑↓</span></th>
        <th>Character</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><svg class="icon"></svg> <a href="#">BSG-714</a></td>
        <td><span class="group-wh" style="color: #38bdf8;">Wormhole</span></td>
        <td>A C247 <span class="badge badge-c3" style="background:#f59e0b;">C3</span> J172701</td>
        <td></td>
        <td>0 10:23:53</td>
        <td>0 01:15:10</td>
        <td>Dentin</td>
      </tr>
      <tr>
        <td><svg class="icon"></svg> <a href="#">RIS-443</a></td>
        <td><span class="group-wh" style="color: #38bdf8;">Wormhole</span></td>
        <td>D X877 <span class="badge badge-c4" style="background:#eab308;">C4</span> J120409</td>
        <td></td>
        <td>0 06:49:33</td>
        <td>0 01:15:10</td>
        <td>Didier</td>
      </tr>
      <tr>
        <td><svg class="icon"></svg> <a href="#">SHX-448</a></td>
        <td><span class="group-wh" style="color: #38bdf8;">Wormhole</span></td>
        <td>E U574 <span class="badge badge-c6" style="background:#ea580c;">C6</span> J120512</td>
        <td></td>
        <td>0 06:18:31</td>
        <td>0 01:15:10</td>
        <td>Daedru</td>
      </tr>
      <tr>
        <td><svg class="icon"></svg> <a href="#">SVG-364</a></td>
        <td><span class="group-combat" style="color: #84cc16;">Combat Site</span></td>
        <td><span style="color: #84cc16;">Frontier Command Post</span></td>
        <td></td>
        <td>0 06:49:33</td>
        <td>0 01:15:10</td>
        <td>Didier</td>
      </tr>
      <tr>
        <td><svg class="icon"></svg> <a href="#">ZCD-829</a></td>
        <td><span class="group-ore" style="color: #a3e635;">Ore Site</span></td>
        <td>Average Frontier Deposit</td>
        <td></td>
        <td>0 16:01:28</td>
        <td>0 01:15:10</td>
        <td>Vox For</td>
      </tr>
      <tr>
        <td><svg class="icon"></svg> <a href="#">ZCG-448</a></td>
        <td><span class="group-wh" style="color: #38bdf8;">Wormhole</span></td>
        <td>B H900 <span class="badge badge-c5" style="background:#d946ef;">C5</span> J141204</td>
        <td></td>
        <td>0 06:46:56</td>
        <td>0 01:15:10</td>
        <td>Didier</td>
      </tr>
    </tbody>
  </table>
</div>
`;

console.log('--- RUNNING LIVE WANDERER SIGNATURES SCREENSHOT SIMULATION TEST ---');

const extracted = extractWandererSignaturesFromHtml(mockScreenshotHtml);

if (!extracted.success) {
  throw new Error(`Extraction failed: ${extracted.error}`);
}

if (extracted.system !== 'J215758') {
  throw new Error(`Expected system J215758, got ${extracted.system}`);
}

if (extracted.class !== 'C4') {
  throw new Error(`Expected class C4, got ${extracted.class}`);
}

if (extracted.signatures.length !== 6) {
  throw new Error(`Expected 6 signatures, got ${extracted.signatures.length}`);
}

// Check row contents
const sig1 = extracted.signatures[0];
if (sig1.id !== 'BSG-714' || sig1.group !== 'Wormhole' || sig1.info !== 'A C247 C3 J172701') {
  throw new Error(`Row 1 incorrect: ${JSON.stringify(sig1)}`);
}

const sig4 = extracted.signatures[3];
if (sig4.id !== 'SVG-364' || sig4.group !== 'Combat Site' || sig4.info !== 'Frontier Command Post') {
  throw new Error(`Row 4 incorrect: ${JSON.stringify(sig4)}`);
}

const sig5 = extracted.signatures[4];
if (sig5.id !== 'ZCD-829' || sig5.group !== 'Ore Site' || sig5.info !== 'Average Frontier Deposit') {
  throw new Error(`Row 5 incorrect: ${JSON.stringify(sig5)}`);
}

const sig6 = extracted.signatures[5];
if (sig6.id !== 'ZCG-448' || sig6.group !== 'Wormhole' || sig6.info !== 'B H900 C5 J141204') {
  throw new Error(`Row 6 incorrect: ${JSON.stringify(sig6)}`);
}

// Generate TSV
const tsv = formatSignaturesData(extracted, 'tsv');
console.log('Generated TSV Output:\n---------------------\n' + tsv);

const expectedTsv = 
`J215758 (C4)
BSG-714\tWormhole\tA C247 C3 J172701
RIS-443\tWormhole\tD X877 C4 J120409
SHX-448\tWormhole\tE U574 C6 J120512
SVG-364\tCombat Site\tFrontier Command Post
ZCD-829\tOre Site\tAverage Frontier Deposit
ZCG-448\tWormhole\tB H900 C5 J141204
`;

if (tsv !== expectedTsv) {
  throw new Error(`TSV output does not match expected!\nExpected:\n${expectedTsv}\nGot:\n${tsv}`);
}

// Verify JSON format
const json = JSON.parse(formatSignaturesData(extracted, 'json'));
if (json.system !== 'J215758' || json.class !== 'C4' || json.signatures.length !== 6) {
  throw new Error(`JSON format invalid: ${JSON.stringify(json)}`);
}

// Verify Markdown format
const md = formatSignaturesData(extracted, 'markdown');
if (!md.includes('### J215758 (C4)') || !md.includes('| BSG-714 | Wormhole | A C247 C3 J172701 |')) {
  throw new Error(`Markdown format invalid:\n${md}`);
}

console.log('✅ ALL Wanderer Signatures Screenshot Simulation Validations PASSED completely!');
