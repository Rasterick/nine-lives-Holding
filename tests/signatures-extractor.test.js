// tests/signatures-extractor.test.js
import { extractWandererSignaturesFromHtml } from '../content/signatures-extractor.js';

const mockHtml = `
  <div class="signatures-panel">
    <div class="panel-header">
      <span class="count">[6]</span>
      <span class="title">Signatures in</span>
      <span class="badge badge-c4">C4</span>
      <span class="system-name">J215758</span>
    </div>
    <table class="signatures-table">
      <thead>
        <tr><th>Id</th><th>Group</th><th>Info</th><th>Description</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><svg class="wh-icon"></svg> <a href="#">BSG-714</a></td>
          <td><span class="group-wh">Wormhole</span></td>
          <td>A C247 <span class="badge-c3">C3</span> J172701</td>
          <td></td>
        </tr>
        <tr>
          <td>RIS-443</td>
          <td>Wormhole</td>
          <td>D X877 <span class="badge-c4">C4</span> J120409</td>
          <td></td>
        </tr>
        <tr>
          <td>SVG-364</td>
          <td>Combat Site</td>
          <td>Frontier Command Post</td>
          <td></td>
        </tr>
        <tr>
          <td>ZCD-829</td>
          <td>Ore Site</td>
          <td>Average Frontier Deposit</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>
`;

console.log('--- Testing extractWandererSignaturesFromHtml ---');
const result = extractWandererSignaturesFromHtml(mockHtml);

if (!result.success) {
  throw new Error(`Extraction failed: ${result.error}`);
}
if (result.system !== 'J215758') {
  throw new Error(`Expected system J215758, got ${result.system}`);
}
if (result.class !== 'C4') {
  throw new Error(`Expected class C4, got ${result.class}`);
}
if (result.signatures.length !== 4) {
  throw new Error(`Expected 4 signatures, got ${result.signatures.length}`);
}
if (result.signatures[0].id !== 'BSG-714') {
  throw new Error(`Expected first ID BSG-714, got ${result.signatures[0].id}`);
}
if (result.signatures[0].info !== 'A C247 C3 J172701') {
  throw new Error(`Expected badge normalization "A C247 C3 J172701", got "${result.signatures[0].info}"`);
}

console.log('✅ Signatures extraction tests passed!');
