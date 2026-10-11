// tests/topology-extractor.test.js
import { extractWandererTopology } from '../content/topology-extractor.js';

function createMockElement(tagName, attrs = {}, textContent = '', children = []) {
  const el = {
    tagName: tagName.toUpperCase(),
    textContent,
    children: [...children],
    className: attrs.className || '',
    innerHTML: attrs.innerHTML || '',
    classList: {
      contains: (cls) => (attrs.className || '').split(' ').includes(cls)
    },
    getAttribute: (attr) => attrs[attr] || null,
    querySelectorAll: (selector) => {
      const results = [];
      function search(node) {
        for (const child of node.children) {
          const sel = selector.split(',').map(s => s.trim().toUpperCase());
          if (selector === '*' || sel.includes(child.tagName) || sel.includes('*')) {
            results.push(child);
          }
          search(child);
        }
      }
      search(el);
      return results;
    },
    closest: (selector) => null
  };
  return el;
}

// Build mock DOM for Wanderer React-Flow nodes:
// 1. J215758 (Home)
// 2. Reset (K-Space D-system, sig SRE, sec 0.7, tag D)
// 3. Y-MSJN (Nullsec, sig OGI, sec 0.4 / -0.4, tag B1.7)
const homeNode = createMockElement('div', { 'data-id': '31001668', className: 'react-flow__node home' }, '', [
  createMockElement('span', {}, 'J215758'),
  createMockElement('span', {}, 'KJX'),
  createMockElement('span', {}, 'C4'),
  createMockElement('span', {}, 'PG'),
  createMockElement('span', {}, 'C3'),
  createMockElement('span', {}, 'C5'),
  createMockElement('span', {}, '4')
]);

const resetNode = createMockElement('div', { 'data-id': '30003391', className: 'react-flow__node' }, '', [
  createMockElement('span', {}, 'Reset'),
  createMockElement('span', {}, 'SRE'),
  createMockElement('span', {}, '0.7'),
  createMockElement('span', {}, 'D')
]);

const nullsecNode = createMockElement('div', { 'data-id': '30004898', className: 'react-flow__node' }, '', [
  createMockElement('span', {}, 'Y-MSJN - Goonswarm Federation'),
  createMockElement('span', {}, 'OGI'),
  createMockElement('span', {}, '-0.4'),
  createMockElement('span', {}, 'B1.7')
]);

// 4. J123432 with hostile corp name: "J123432 - Blue Loot not Incorporated"
const hostileWormholeNode = createMockElement('div', { 'data-id': '31002270', className: 'react-flow__node' }, '', [
  createMockElement('span', {}, 'J123432 - Blue Loot not Incorporated'),
  createMockElement('span', {}, 'C5'),
  createMockElement('span', {}, 'B1.3'),
  createMockElement('span', {}, 'C5')
]);

// 5. Baratar with hostile corp note: "Baratar - Hard Knocks Staging"
const hostileKSpaceNode = createMockElement('div', { 'data-id': '30003920', className: 'react-flow__node' }, '', [
  createMockElement('span', {}, 'Baratar - Hard Knocks Staging'),
  createMockElement('span', {}, 'EJI'),
  createMockElement('span', {}, '0.2'),
  createMockElement('span', {}, 'E')
]);

globalThis.document = {
  querySelectorAll: (selector) => {
    if (selector.includes('.react-flow__node')) {
      return [homeNode, resetNode, nullsecNode, hostileWormholeNode, hostileKSpaceNode];
    }
    if (selector === 'iframe') return [];
    return [];
  }
};

const result = extractWandererTopology();

console.log('Topology extraction result:');
console.log('Nodes count:', result.nodes.length);
console.log('Nodes:', result.nodes.map(n => ({ id: n.id, name: n.name, custom_name: n.custom_name, tag: n.tag, sig: n.signature })));

if (!result.success) {
  throw new Error('Expected success to be true');
}

const resetExtracted = result.nodes.find(n => n.name === 'Reset');
if (!resetExtracted) {
  throw new Error('FAIL: System "Reset" was not extracted from nodes!');
}

const ymsjnExtracted = result.nodes.find(n => n.name === 'Y-MSJN');
if (!ymsjnExtracted || ymsjnExtracted.custom_name !== 'Goonswarm Federation') {
  throw new Error('FAIL: System "Y-MSJN" with corp name was not extracted properly!');
}

const blueLootExtracted = result.nodes.find(n => n.name === 'J123432');
if (!blueLootExtracted || blueLootExtracted.custom_name !== 'Blue Loot not Incorporated') {
  throw new Error('FAIL: System "J123432" with corp name "Blue Loot not Incorporated" was not extracted!');
}

const baratarExtracted = result.nodes.find(n => n.name === 'Baratar');
if (!baratarExtracted || baratarExtracted.custom_name !== 'Hard Knocks Staging') {
  throw new Error('FAIL: System "Baratar" with corp name was not extracted!');
}

console.log('✅ PASS: All nodes including hostile corp names and custom labels were successfully extracted!');
