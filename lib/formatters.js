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
  const cls = data.class ? `(${data.class})` : '';
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
