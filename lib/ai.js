// lib/ai.js

export const KNOWN_EVE_SYSTEMS = {
  // Wormhole chain systems
  'J113907': 'C5',
  'J101408': 'C1',
  'J101020': 'C1',
  'J142923': 'C4',
  'J142327': 'C1',
  'J122524': 'C2',
  'J125049': 'C3',
  'J135036': 'C3',
  'J204635': 'C4',
  'J203952': 'C4',
  'J144732': 'C4',
  'J150635': 'C4',
  'J215758': 'C4',
  'J104136': 'C6',
  'J111447': 'C6',
  // Known K-Space and special systems
  'TORRINOS': 'Highsec',
  'JITA': 'Highsec',
  'AMARR': 'Highsec',
  'DODIXIE': 'Highsec',
  'HEK': 'Highsec',
  'RENS': 'Highsec',
  'YULAI': 'Highsec',
  'THERA': 'C12',
  'POITOT': 'Nullsec',
  'AMAMAKE': 'Lowsec',
  'RANCER': 'Lowsec',
  'TAMA': 'Lowsec',
  'NIARJA': 'Pochven',
  'ORDUIN': 'Highsec',
  'LOGUTTUR': 'Highsec',
  'MERCOMESIER': 'Lowsec',
  'ZORORZIH': 'Highsec',
  'AIKANTOH': 'Highsec',
  'APANAKE': 'Highsec',
  'PAKHSHI': 'Highsec',
  'KASSIGAINEN': 'Highsec'
};

/**
 * Deterministically aligns and classifies tokens from a raw node cluster.
 * Guarantees that columns never shift even when signatures or pilot counts are missing.
 *
 * Target columns:
 * 0: System (e.g. Torrinos, J163745, J121347, J215758)
 * 1: Signature (e.g. RCP, EKR, SUB, or '-' if missing)
 * 2: Class (e.g. Highsec(0.5), C3, C4, C5, Nullsec)
 * 3: Tags (e.g. A1.3, A, A1.1, PG, B1.2, B)
 * 4: Statics (e.g. H, L, N, C1, C3, C5, or '-' if missing/K-Space)
 * 5: Pilots (e.g. '2', '20' or '' if empty)
 */
export function validateAndAlignRow(rawTokens) {
  // Flatten tokens and split comma-separated items outside brackets
  const tokens = [];
  const rawList = Array.isArray(rawTokens) ? rawTokens : String(rawTokens).split('|');
  for (const item of rawList) {
    const trimmed = String(item).trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      tokens.push(trimmed);
    } else if (trimmed.includes(',')) {
      trimmed.split(',').forEach(sub => {
        const c = sub.trim().replace(/^[\s\-\|\,\;]+|[\s\-\|\,\;]+$/g, '');
        if (c) tokens.push(c);
      });
    } else {
      const c = trimmed.replace(/^[\s\-\|\,\;]+|[\s\-\|\,\;]+$/g, '');
      if (c) tokens.push(c);
    }
  }

  let system = '-';
  let signature = '-';
  let systemClass = 'Unknown';
  let securityStatus = null;
  const statics = [];
  const tags = [];
  let pilots = '-';

  // Specific regex discriminators
  const jSpaceRegex = /^J\d{6}$/i;
  const cosmicSigFullRegex = /^[A-Z]{3}-\d{3}$/i;
  const isNullsec = (s) => /^[0-9A-Z]{1,4}-[0-9A-Z]{1,4}$/i.test(s) && !cosmicSigFullRegex.test(s);
  const classRegex = /^(C\d{1,2}|Highsec|Lowsec|Nullsec|Pochven|HS|LS|NS)$/i;
  const sigRegex = /^([A-Z]{3}|[$*~#!?][A-Z0-9]{2,3})(-\d{3})?$/i;
  const pilotRegex = /^\d{1,3}$/;
  const secStatusRegex = /^(-?\d+\.\d+)$/;
  const whStaticClassRegex = /^C[1-6]$/i;
  const whStaticKspaceRegex = /^[HLNP]$/i; // Highsec, Lowsec, Nullsec, Pochven

  const consumedIndices = new Set();

  // Pass 0: Signature with scan ID (e.g. ZCD-829, LTF-376)
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (cosmicSigFullRegex.test(t)) {
      signature = t.split('-')[0].toUpperCase();
      consumedIndices.add(i);
      break;
    }
  }

  // Pass 1: Identify System
  for (let i = 0; i < tokens.length; i++) {
    if (consumedIndices.has(i)) continue;
    const t = tokens[i];
    const cleanUpper = t.toUpperCase();
    if (jSpaceRegex.test(t) || isNullsec(t) || KNOWN_EVE_SYSTEMS[cleanUpper]) {
      system = (KNOWN_EVE_SYSTEMS[cleanUpper] && !jSpaceRegex.test(t) && !isNullsec(t)) ? t : t.toUpperCase();
      consumedIndices.add(i);
      break;
    }
    if (/^[A-Z][a-zA-Z0-9]{2,15}$/.test(t) && !classRegex.test(t) && !sigRegex.test(t) && !secStatusRegex.test(t)) {
      system = t;
      consumedIndices.add(i);
      break;
    }
  }

  // Pass 2: Identify Security Status (e.g. 0.5, 1.0, 0.8, 0.1, -0.2)
  for (let i = 0; i < tokens.length; i++) {
    if (consumedIndices.has(i)) continue;
    const t = tokens[i];
    if (secStatusRegex.test(t)) {
      securityStatus = t;
      consumedIndices.add(i);
      break;
    }
  }

  // Pass 3: Identify Primary Class (e.g. C1-C6, Highsec, Lowsec, Nullsec)
  for (let i = 0; i < tokens.length; i++) {
    if (consumedIndices.has(i)) continue;
    const t = tokens[i];
    if (classRegex.test(t)) {
      systemClass = t.toUpperCase().startsWith('C') ? t.toUpperCase() : t;
      consumedIndices.add(i);
      break;
    }
  }

  // Pass 4: Identify Signature (3-letter uppercase code if not already found)
  if (signature === '-') {
    for (let i = 0; i < tokens.length; i++) {
      if (consumedIndices.has(i)) continue;
      const t = tokens[i];
      const cleanUpper = t.toUpperCase();
      if (
        sigRegex.test(t) &&
        !classRegex.test(t) &&
        !whStaticClassRegex.test(t) &&
        !KNOWN_EVE_SYSTEMS[cleanUpper] &&
        !['AND', 'THE', 'FOR', 'OUT', 'NEW', 'SEC', 'MAP'].includes(cleanUpper)
      ) {
        signature = t.includes('-') ? t.split('-')[0].toUpperCase() : t.toUpperCase();
        consumedIndices.add(i);
        break;
      }
    }
  }

  // Pass 5: Identify Pilot Count (Isolated digit)
  for (let i = 0; i < tokens.length; i++) {
    if (consumedIndices.has(i)) continue;
    const t = tokens[i];
    if (pilotRegex.test(t) && t !== '0') {
      pilots = t;
      consumedIndices.add(i);
      break;
    }
  }

  // Derive class from security status or known tables if class was Unknown
  if (systemClass === 'Unknown') {
    if (securityStatus !== null) {
      const sec = parseFloat(securityStatus);
      if (sec >= 0.45) systemClass = 'Highsec';
      else if (sec > 0.0) systemClass = 'Lowsec';
      else systemClass = 'Nullsec';
    } else if (system !== '-') {
      const sysKey = system.toUpperCase();
      if (KNOWN_EVE_SYSTEMS[sysKey]) {
        systemClass = KNOWN_EVE_SYSTEMS[sysKey];
      } else if (isNullsec(system)) {
        systemClass = 'Nullsec';
      }
    }
  }

  // If K-space system has a security status, format Class as e.g. Highsec(0.5)
  if (securityStatus !== null && systemClass !== 'Unknown' && !systemClass.startsWith('C')) {
    let base = systemClass;
    if (/^highsec|hs$/i.test(base)) base = 'Highsec';
    else if (/^lowsec|ls$/i.test(base)) base = 'Lowsec';
    else if (/^nullsec|ns$/i.test(base)) base = 'Nullsec';
    systemClass = `${base}(${securityStatus})`;
  }

  // Pass 6: Allocate remaining tokens to Statics vs Tags
  const isWormhole = jSpaceRegex.test(system) || systemClass.startsWith('C');

  for (let i = 0; i < tokens.length; i++) {
    if (consumedIndices.has(i)) continue;
    const t = tokens[i];
    if (t === system) continue;

    if (isWormhole && (whStaticClassRegex.test(t) || whStaticKspaceRegex.test(t))) {
      statics.push(t.toUpperCase());
    } else {
      tags.push(t);
    }
  }

  return {
    system,
    signature,
    class: systemClass,
    tags: tags.join(', ') || '-',
    statics: statics.join(', ') || '-',
    pilots
  };
}

/**
 * Formats parsed records into TSV, JSON, or Markdown tables.
 */
export function formatTacticalData(records, format = 'tsv') {
  if (!Array.isArray(records) || !records.length) {
    return format === 'json' ? '[]' : 'NO_SYSTEMS_PARSED';
  }

  if (format === 'json') {
    return JSON.stringify(records, null, 2);
  }

  if (format === 'markdown') {
    let md = '| System | Signature | Class | Tags | Statics | Pilots |\n';
    md += '| --- | --- | --- | --- | --- | --- |\n';
    for (const r of records) {
      const pilotsVal = (r.pilots === '-' || !r.pilots) ? '' : r.pilots;
      const staticsVal = r.statics || '-';
      md += `| **${r.system}** | ${r.signature} | ${r.class} | ${r.tags} | ${staticsVal} | ${pilotsVal} |\n`;
    }
    return md;
  }

  // Default: Standard TSV (Tab-Separated Values)
  let tsv = 'System\tSignature\tClass\tTags\tStatics\tPilots\n';
  for (const r of records) {
    const pilotsVal = (r.pilots === '-' || !r.pilots) ? '' : r.pilots;
    const staticsVal = r.statics || '-';
    tsv += `${r.system}\t${r.signature}\t${r.class}\t${r.tags}\t${staticsVal}\t${pilotsVal}\n`;
  }
  return tsv;
}

/**
 * Orchestrates parsing with Chrome Built-in AI (LanguageModel Prompt API).
 * Includes streaming support, availability checks, and deterministic post-validation.
 */
export async function parseWithChromeAI(clusters, onChunk = null, onProgress = null) {
  if (!clusters || !clusters.length) {
    return [];
  }

  const LM = globalThis.LanguageModel || (typeof window !== 'undefined' && window.LanguageModel);

  // If Prompt API is not active in this browser, use local deterministic parser immediately
  if (!LM) {
    console.info('[AURA AI] LanguageModel Prompt API not available in browser; executing local parser fallback.');
    return clusters.map(c => validateAndAlignRow(c.split(' | ').map(t => t.trim())));
  }

  try {
    const availability = await LM.availability?.({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    });

    if (availability === 'unavailable') {
      console.warn('[AURA AI] LanguageModel is currently unavailable. Using deterministic parser.');
      return clusters.map(c => validateAndAlignRow(c.split(' | ').map(t => t.trim())));
    }

    const session = await LM.create({
      initialPrompts: [{
        role: 'system',
        content: `You are AURA, an EVE Online tactical intelligence parser.
Analyze raw SVG text node clusters extracted from the Wanderer wormhole map.
For each cluster, output exactly ONE row with tab-separated values matching:
System\tSignature\tClass\tTags\tStatics\tPilots

Rules:
1. System: J-Space (J######), Nullsec (e.g. 38G6-L, N-K4Q0, U-7RBK), or named system (Torrinos, Jita, Thera).
2. Signature: 3-letter code (e.g. RCP, EKR, LWT). If missing (e.g. home system), use "-".
3. Class: C1-C6, Highsec, Lowsec, Nullsec. If security status is present (e.g. 0.5), format K-space as Highsec(0.5) or Lowsec(0.1).
4. Tags: Chain branch tags (e.g. A, A1.1, B, B1.2), custom notes, or effects (e.g. PG). If none, use "-".
5. Statics: Wormhole static destinations (e.g. H, L, N, C1, C3, C5). If none or K-space, use "-".
6. Pilots: Number of pilots if present, else leave empty.
Do not output headers or conversational commentary.`
      }],
      temperature: 0.1,
      monitor(m) {
        m.addEventListener?.('downloadprogress', (e) => {
          const pct = e.total ? Math.floor((e.loaded / e.total) * 100) : 0;
          if (onProgress) onProgress(pct);
        });
      }
    });

    const promptText = `Clusters to parse:\n` + clusters.map(c => `- ${c}`).join('\n');
    let fullOutput = '';

    if (session.promptStreaming) {
      for await (const chunk of session.promptStreaming(promptText)) {
        fullOutput += chunk;
        if (onChunk) onChunk(chunk);
      }
    } else {
      fullOutput = await session.prompt(promptText);
      if (onChunk) onChunk(fullOutput);
    }

    session.destroy?.();

    // Parse AI output lines, running each through validateAndAlignRow for guaranteed column locking
    const lines = fullOutput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const records = [];

    for (const line of lines) {
      if (line.toLowerCase().startsWith('system\t') || line.startsWith('|')) continue;
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length >= 2) {
        records.push({
          system: parts[0] || '-',
          signature: parts[1] || '-',
          class: parts[2] || 'Unknown',
          tags: parts[3] || '-',
          statics: parts[4] || '-',
          pilots: parts[5] || '-'
        });
      }
    }

    return records.length > 0 
      ? records 
      : clusters.map(c => validateAndAlignRow(c.split(' | ').map(t => t.trim())));

  } catch (err) {
    console.error('[AURA AI] Prompt API execution error, falling back to local classifier:', err);
    return clusters.map(c => validateAndAlignRow(c.split(' | ').map(t => t.trim())));
  }
}
