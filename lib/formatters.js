// lib/formatters.js

/**
 * Formats cosmic signatures data into TSV, JSON, or Markdown.
 *
 * TSV Schema:
 * Line 1: <System> (<Class>)
 * Rows: <Id>\t<Group>\t<Info>  (no header row)
 */
export function formatSignaturesData(data, format = 'tsv') {
  if (!data || !data.signatures || !Array.isArray(data.signatures)) {
    return '';
  }

  const sys = data.system || 'Unknown';
  const cls = (data.class && data.class !== 'Unknown') ? `(${data.class})` : '';
  const headerLine = cls ? `${sys} ${cls}` : sys;

  if (format === 'json') {
    return JSON.stringify({
      system: data.system || 'Unknown',
      class: data.class || 'Unknown',
      count: data.signatures.length,
      signatures: data.signatures
    }, null, 2);
  }

  if (format === 'markdown') {
    let md = `### ${headerLine}\n\n`;
    md += '| Id | Group | Info |\n';
    md += '| --- | --- | --- |\n';
    for (const sig of data.signatures) {
      md += `| ${sig.id || '-'} | ${sig.group || '-'} | ${sig.info || '-'} |\n`;
    }
    return md;
  }

  // Default: TSV
  let tsv = `${headerLine}\n`;
  for (const sig of data.signatures) {
    tsv += `${sig.id || '-'}\t${sig.group || '-'}\t${sig.info || '-'}\n`;
  }
  return tsv;
}

/**
 * Formats local system pilots data into TSV, JSON, or Markdown.
 *
 * TSV Schema:
 * Line 1: <System> (<Class>)
 * Rows: <Pilot>\t<Corp>\t<ShipName>\t<ShipType>\t<PortraitUrl>  (no column headers)
 */
export function formatPilotsData(data, format = 'tsv') {
  if (!data || !data.pilots || !Array.isArray(data.pilots)) {
    return '';
  }

  const sys = data.system || 'Unknown';
  const cls = (data.class && data.class !== 'Unknown') ? `(${data.class})` : '';
  const headerLine = cls ? `${sys} ${cls}` : sys;

  if (format === 'json') {
    return JSON.stringify({
      system: data.system || 'Unknown',
      class: data.class || 'Unknown',
      count: data.pilots.length,
      pilots: data.pilots
    }, null, 2);
  }

  if (format === 'markdown') {
    let md = `### ${headerLine} — Local [${data.pilots.length}]\n\n`;
    md += '| Portrait | Pilot | Corp | Ship Name | Ship Type |\n';
    md += '| --- | --- | --- | --- | --- |\n';
    for (const p of data.pilots) {
      const portraitMd = p.portraitUrl ? `![](${p.portraitUrl})` : '';
      md += `| ${portraitMd} | ${p.pilot || '-'} | ${p.corp || '-'} | ${p.shipName || '-'} | ${p.shipType || '-'} |\n`;
    }
    return md;
  }

  // Default: TSV (Line 1: System (Class), then tab-separated rows without header)
  // Column order: Portrait URL\tPilot Name\tCorp\tShip Name\tShip Type
  let tsv = `${headerLine}\n`;
  for (const p of data.pilots) {
    tsv += [
      p.portraitUrl || '',
      p.pilot || '',
      p.corp || '',
      p.shipName || '',
      p.shipType || ''
    ].join('\t') + '\n';
  }
  return tsv;
}

