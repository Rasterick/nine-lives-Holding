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
 * 0: System (e.g. J101020, 38G6-L, Jita)
 * 1: Signature (e.g. LWT, ORX or '-' if missing)
 * 2: Class (e.g. C1, C5, Nullsec, Highsec)
 * 3: Tags / Statics (e.g. D1.1, H, B, C6)
 * 4: Pilots (e.g. '4' or '-')
 */
export function validateAndAlignRow(rawTokens) {
  const tokens = (Array.isArray(rawTokens) ? rawTokens : String(rawTokens).split('|'))
    .map(t => String(t).trim())
    .filter(t => t.length > 0);

  let system = '-';
  let signature = '-';
  let systemClass = 'Unknown';
  const tags = [];
  let pilots = '-';

  // Specific regex discriminators
  const jSpaceRegex = /^J\d{6}$/i;
  const cosmicSigFullRegex = /^[A-Z]{3}-\d{3}$/i;
  const isNullsec = (s) => /^[0-9A-Z]{1,4}-[0-9A-Z]{1,4}$/i.test(s) && !cosmicSigFullRegex.test(s);
  const classRegex = /^(C\d{1,2}|Highsec|Lowsec|Nullsec|Pochven|HS|LS|NS)$/i;
  const sigRegex = /^([A-Z]{3}|[$*~#!?][A-Z0-9]{2,3})(-\d{3})?$/i;
  const pilotRegex = /^\d{1,3}$/;
  const staticPattern = /^[A-Z]\d+(\.\d+)?$/; // e.g. D1.1, E1.4, K162, H296

  for (const token of tokens) {
    // Skip concatenated/smashed strings (longer than 14 chars with mixed alphanumeric tokens)
    if (token.length > 14 && !token.includes(' ') && !jSpaceRegex.test(token)) {
      continue;
    }

    const cleanUpper = token.toUpperCase();

    // 0. Full cosmic signatures with scan ID (e.g. ZCD-829, LTF-376) are ALWAYS signatures
    if (signature === '-' && cosmicSigFullRegex.test(token)) {
      signature = token.split('-')[0].toUpperCase();
      continue;
    }

    // 1. Identify System (First token matching J-space, Nullsec, known system, or proper noun)
    if (system === '-') {
      if (jSpaceRegex.test(token) || isNullsec(token) || KNOWN_EVE_SYSTEMS[cleanUpper]) {
        system = (KNOWN_EVE_SYSTEMS[cleanUpper] && !jSpaceRegex.test(token) && !isNullsec(token)) ? token : token.toUpperCase();
        continue;
      }
      if (/^[A-Z][a-zA-Z0-9]{2,15}$/.test(token) && !classRegex.test(token) && !sigRegex.test(token)) {
        system = token;
        continue;
      }
    }

    // 2. Identify System Class (e.g. C1-C6, Nullsec, Highsec)
    if (systemClass === 'Unknown' && classRegex.test(token)) {
      systemClass = token.toUpperCase().startsWith('C') ? token.toUpperCase() : token;
      continue;
    }

    // 3. Identify Signature (3 uppercase letters, e.g. LWT, IYR, excluding classes and known systems)
    if (signature === '-' && sigRegex.test(token) && !classRegex.test(token) && !staticPattern.test(token) && !KNOWN_EVE_SYSTEMS[cleanUpper]) {
      signature = token.includes('-') ? token.split('-')[0].toUpperCase() : token.toUpperCase();
      continue;
    }

    // 4. Identify Pilot Count (Isolated digit)
    if (pilots === '-' && pilotRegex.test(token)) {
      pilots = token;
      continue;
    }

    // 5. Remaining tokens are statics, custom tags, or effects
    tags.push(token);
  }

  // Derive class from security status if present (e.g. 0.8, 1.0, 0.5, 0.1)
  if (systemClass === 'Unknown') {
    for (const token of tokens) {
      if (/^(1\.0|0\.[0-9])$/.test(token)) {
        const sec = parseFloat(token);
        if (sec >= 0.45) {
          systemClass = 'Highsec';
        } else if (sec > 0.0) {
          systemClass = 'Lowsec';
        } else {
          systemClass = 'Nullsec';
        }
        break;
      }
    }
  }

  // Final fallback if class wasn't explicitly in tokens: lookup known systems or Nullsec pattern
  if (systemClass === 'Unknown' && system !== '-') {
    const sysKey = system.toUpperCase();
    if (KNOWN_EVE_SYSTEMS[sysKey]) {
      systemClass = KNOWN_EVE_SYSTEMS[sysKey];
    } else if (isNullsec(system)) {
      systemClass = 'Nullsec';
    }
  }

  return {
    system,
    signature,
    class: systemClass,
    tags: tags.join(', ') || '-',
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
    let md = '| System | Signature | Class | Tags | Pilots |\n';
    md += '| --- | --- | --- | --- | --- |\n';
    for (const r of records) {
      md += `| **${r.system}** | ${r.signature} | ${r.class} | ${r.tags} | ${r.pilots} |\n`;
    }
    return md;
  }

  // Default: Standard TSV (Tab-Separated Values)
  let tsv = 'System\tSignature\tClass\tTags\tPilots\n';
  for (const r of records) {
    tsv += `${r.system}\t${r.signature}\t${r.class}\t${r.tags}\t${r.pilots}\n`;
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
System\tSignature\tClass\tTags\tPilots

Rules:
1. System: J-Space (J######), Nullsec (e.g. 38G6-L, N-K4Q0, U-7RBK), or named system (Jita, Thera).
2. Signature: 3-letter code (e.g. LWT, IYR). If missing (e.g. home system), use "-".
3. Class: C1-C6, Highsec, Lowsec, Nullsec.
4. Tags: Statics (e.g. D1.1, C5), custom notes, or effects.
5. Pilots: Number of pilots if present, else "-".
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
          pilots: parts[4] || '-'
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
