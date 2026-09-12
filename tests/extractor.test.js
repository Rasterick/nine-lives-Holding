// tests/extractor.test.js
import { extractWandererSvgData } from '../content/extractor.js';

// Minimal mock DOM for Node testing
function createMockElement(tagName, attrs = {}, textContent = '', children = []) {
  const el = {
    tagName: tagName.toUpperCase(),
    textContent,
    children: [...children],
    getBoundingClientRect: () => ({ width: attrs.width || 800, height: attrs.height || 600 }),
    querySelectorAll: (selector) => {
      const results = [];
      function search(node) {
        for (const child of node.children) {
          const tags = selector.split(',').map(s => s.trim().toUpperCase());
          if (tags.includes(child.tagName)) {
            results.push(child);
          }
          search(child);
        }
      }
      search(el);
      return results;
    }
  };
  return el;
}

// Build mock SVG with 3 system nodes:
// 1. J101020 (Wormhole with sig)
// 2. J113907 (Home system, no sig, pilots: 4)
// 3. 38G6-L (Nullsec exit)
const node1 = createMockElement('g', {}, '', [
  createMockElement('text', {}, 'J101020'),
  createMockElement('text', {}, 'LWT'),
  createMockElement('text', {}, 'C1'),
  createMockElement('text', {}, 'D1.1'),
  createMockElement('text', {}, 'H')
]);

const node2 = createMockElement('g', {}, '', [
  createMockElement('text', {}, 'J113907'),
  createMockElement('text', {}, 'C5'),
  createMockElement('text', {}, 'B'),
  createMockElement('text', {}, 'C6'),
  createMockElement('text', {}, '4')
]);

const node3 = createMockElement('g', {}, '', [
  createMockElement('text', {}, '38G6-L'),
  createMockElement('text', {}, 'ORX'),
  createMockElement('text', {}, 'Nullsec'),
  createMockElement('text', {}, 'D1.4'),
  createMockElement('text', {}, 'L')
]);

const mockSvg = createMockElement('svg', { width: 1200, height: 800 }, '', [node1, node2, node3]);

globalThis.document = {
  querySelectorAll: (selector) => {
    if (selector === 'svg') return [mockSvg];
    return [];
  }
};

const result = extractWandererSvgData();

if (!result.success) {
  throw new Error(`Extraction marked unsuccessful: ${result.error}`);
}

if (result.clusters.length !== 3) {
  throw new Error(`Expected 3 clusters, got ${result.clusters.length}: ${JSON.stringify(result.clusters)}`);
}

// Verify clusters content
if (!result.clusters[0].includes('J101020') || !result.clusters[0].includes('LWT')) {
  throw new Error(`Cluster 1 incorrect: ${result.clusters[0]}`);
}
if (!result.clusters[1].includes('J113907') || !result.clusters[1].includes('C5')) {
  throw new Error(`Cluster 2 incorrect: ${result.clusters[1]}`);
}
if (!result.clusters[2].includes('38G6-L') || !result.clusters[2].includes('ORX')) {
  throw new Error(`Cluster 3 incorrect: ${result.clusters[2]}`);
}

console.log('✅ Extractor test passed successfully with clusters:\n', result.clusters);
