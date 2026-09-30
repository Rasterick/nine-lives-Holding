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
 * Rows: <PortraitUrl>\t<Pilot>\t<Corp>\t<ShipType>\t<ShipName>  (no column headers)
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
    md += '| Portrait | Pilot | Corp | Ship Type | Ship Name |\n';
    md += '| --- | --- | --- | --- | --- |\n';
    for (const p of data.pilots) {
      const portraitMd = p.portraitUrl ? `![](${p.portraitUrl})` : '';
      md += `| ${portraitMd} | ${p.pilot || '-'} | ${p.corp || '-'} | ${p.shipType || '-'} | ${p.shipName || '-'} |\n`;
    }
    return md;
  }

  // Default: TSV (Line 1: System (Class), then tab-separated rows without header)
  // Column order: Portrait URL\tPilot Name\tCorp\tShip Type\tShip Name
  let tsv = `${headerLine}\n`;
  for (const p of data.pilots) {
    tsv += [
      p.portraitUrl || '',
      p.pilot || '',
      p.corp || '',
      p.shipType || '',
      p.shipName || ''
    ].join('\t') + '\n';
  }
  return tsv;
}

/**
 * Formats tactical zKillboard intelligence into Discord-compatible markdown.
 */
export function formatDiscordFlashReport(zkillData, synthesis, crossRef) {
  if (!zkillData) return '';

  const entityName = zkillData.entityName || (zkillData.victim ? `${zkillData.victim.name}'s loss` : 'Target Entity');
  const corpStr = zkillData.entityCorp ? ` [${zkillData.entityCorp}]` : '';
  const threatIdx = synthesis?.threatIndex || 5;
  const threatEmoji = threatIdx >= 8 ? '🚨' : (threatIdx >= 5 ? '⚠️' : 'ℹ️');
  const doctrine = synthesis?.doctrine || 'Unclassified Skirmish';
  const gangDesc = synthesis?.gangSizeDesc || `${zkillData.sampleCount || 1} event(s)`;

  let report = `${threatEmoji} **AURA TACTICAL FLASH // NINE LIVES INTEL**\n`;
  report += `**Target**: \`${entityName}\`${corpStr} | **Threat Index**: \`${threatIdx}/10\`\n`;
  report += `**Doctrine**: ${doctrine} (${gangDesc})\n`;

  if (zkillData.shipsObserved?.length) {
    report += `**Ships Observed**: \`${zkillData.shipsObserved.slice(0, 6).join(', ')}\`\n`;
  }

  if (zkillData.latestSystem) {
    report += `**Latest Kill Activity**: **${zkillData.latestSystem}** (${zkillData.latestTimeAgo})\n`;
  }

  // Chain Proximity & Threat Alert
  if (crossRef?.hasIntersection) {
    if (crossRef.highestThreatLevel === 'CRITICAL_HOME') {
      report += `🔥 **CRITICAL RED ALERT**: Target is operating inside **HOME SYSTEM**!\n`;
    } else if (crossRef.highestThreatLevel === 'CRITICAL') {
      report += `🚨 **CHAIN WARNING**: Activity confirmed **1 HOP FROM HOME** (${crossRef.hotSystems.map(h => h.system).join(', ')})!\n`;
    } else if (crossRef.highestThreatLevel === 'ELEVATED') {
      report += `⚠️ **CHAIN ADVISORY**: Target active **2 hops from Home** (${crossRef.hotSystems.map(h => h.system).join(', ')}).\n`;
    } else {
      report += `📡 **CHAIN TELEMETRY**: Activity intersects active chain: ${crossRef.hotSystems.map(h => h.system).join(', ')}.\n`;
    }
  }

  if (crossRef?.isStale && crossRef?.chainAgeMinutes) {
    report += `*(Note: Wanderer chain data is ${crossRef.chainAgeMinutes}m old)*\n`;
  }

  if (synthesis?.precautions?.length) {
    report += `🛡️ **Order**: *${synthesis.precautions[0]}*\n`;
  }

  return report.trim();
}

/**
 * Formats zKillboard telemetry for Astrum Intel ingestion (JSON, Markdown, TSV).
 */
export function formatZkillData(zkillData, synthesis = null, crossRef = null, format = 'json') {
  if (!zkillData) return '';

  const fullPayload = {
    source: 'zkillboard',
    version: '1.1.0',
    extractedAt: zkillData.extractedAt || new Date().toISOString(),
    entity: {
      type: zkillData.entityType || 'unknown',
      id: zkillData.entityId || null,
      name: zkillData.entityName || '',
      corp: zkillData.entityCorp || '',
      corpId: zkillData.entityCorpId || null,
      alliance: zkillData.entityAlliance || '',
      allianceId: zkillData.entityAllianceId || null
    },
    threatSynthesis: synthesis || {},
    chainProximity: crossRef || {},
    summary: {
      totalOnPage: zkillData.totalOnPage || 0,
      sampleCount: zkillData.sampleCount || 0,
      filterReason: zkillData.filterReason || '',
      killsCount: zkillData.killsCount || 0,
      lossesCount: zkillData.lossesCount || 0,
      uniqueSystems: zkillData.uniqueSystems || [],
      shipsObserved: zkillData.shipsObserved || []
    },
    victim: zkillData.victim || null,
    attackers: zkillData.attackers || [],
    recentEvents: zkillData.recentEvents || []
  };

  if (format === 'json') {
    return JSON.stringify(fullPayload, null, 2);
  }

  if (format === 'markdown') {
    return formatDiscordFlashReport(zkillData, synthesis, crossRef);
  }

  // TSV fallback: Line 1: Header, subsequent lines: System\tShip\tTimestamp\tTarget
  let tsv = `System\tShip\tTimestamp\tTarget\n`;
  const events = zkillData.recentEvents || [];
  for (const ev of events) {
    tsv += [
      ev.solarSystem || '-',
      ev.shipName || '-',
      ev.timestamp?.timeAgo || '-',
      ev.targetPilot || '-'
    ].join('\t') + '\n';
  }
  return tsv;
}


