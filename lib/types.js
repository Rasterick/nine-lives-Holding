// lib/types.js
/**
 * @typedef {Object} ChainNode
 * @property {string} id - Unique identifier (e.g., 'node-J215758' or 'node-1')
 * @property {string} name - System name / J-code (e.g., 'J215758', 'Mastakomon')
 * @property {string} signature - 3-letter signature prefix (e.g., 'DQR', 'JZG')
 * @property {string} class - Wormhole class or Sec status (e.g., 'C4', 'C1', '0.5')
 * @property {string} tag - Tactical chain tag (e.g., 'PG', 'A1.1', 'B')
 * @property {string[]} statics - Known statics (e.g., ['C3', 'C5'])
 * @property {number} pilots - Count of active pilots in system
 * @property {boolean} is_home - True if home system (J215758 / PG)
 * @property {string} [effect] - Wormhole environmental effect if any
 * @property {boolean} [locked] - True if node is locked on map
 * @property {number} [x] - Raw canvas X coordinate
 * @property {number} [y] - Raw canvas Y coordinate
 */

/**
 * @typedef {Object} ChainEdge
 * @property {string} id - Unique edge identifier (e.g., 'edge-J215758-J135852')
 * @property {string} source - Source node identifier or system name
 * @property {string} target - Target node identifier or system name
 * @property {string} [mass] - Wormhole mass category ('S', 'M', 'L', 'XL')
 * @property {string} [time_status] - 'stable' | 'eol'
 * @property {string} [mass_status] - 'stable' | 'destab' | 'critical'
 * @property {string} [color] - Stroke / connection color
 */

/**
 * @typedef {Object} ChainTopology
 * @property {string} timestamp - ISO timestamp of extraction
 * @property {string} source_app - 'Wanderer'
 * @property {ChainNode[]} nodes
 * @property {ChainEdge[]} edges
 */
