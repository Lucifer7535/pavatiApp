#!/usr/bin/env node
/**
 * Architectural layer analysis for pavati-pustak monorepo.
 * Reads ua-arch-input.json, computes directory grouping and dependency metrics,
 * writes results to ua-arch-results.json.
 */
const { readFileSync, writeFileSync } = require('fs');

const input = JSON.parse(readFileSync('/home/dedsec/Projects/pavatiApp/.ua/tmp/ua-arch-input.json', 'utf8'));
const { fileNodes, importEdges, allEdges } = input;

// Directory grouping: normalize filePath or id to a top-level directory group
function getGroup(node) {
  const id = node.id;
  // Root files (no apps/ or packages/ prefix)
  if (id.startsWith('file::')) {
    const name = node.name || '';
    if (name === 'Procfile' || name === 'package.json' || name === 'tsconfig.base.json') return 'config-root';
    if (name === 'opencode-session.json') return 'config-root';
    if (id.includes('.opencode/')) return 'config-root';
    if (id.includes('.ua/')) return 'config-root';
    if (id.includes('apps/web/')) return 'web-core';
    return 'config-root';
  }
  if (id.includes('.opencode/') || id.includes('.ua/')) return 'config-root';
  if (id.startsWith('file:apps/api/prisma/')) return 'api-data';
  if (id.startsWith('file:apps/api/src/__tests__/')) return 'test';
  if (id.startsWith('file:apps/api/src/config/')) return 'api-config';
  if (id.startsWith('file:apps/api/')) {
    // Check if it's a package.json or tsconfig
    if (node.name === 'package.json' || node.name === 'tsconfig.json') return 'api-config';
    return 'api';
  }
  if (id.startsWith('file:apps/web/src/features/')) return 'web-ui';
  if (id.startsWith('file:apps/web/src/components/')) return 'web-ui';
  if (id.startsWith('file:apps/web/src/')) return 'web-core';
  if (id.startsWith('file:apps/web/')) return 'web-core';
  if (id.startsWith('file:packages/shared/')) return 'shared';
  if (id.startsWith('file:packages/receipt-engine/src/')) {
    if (node.name && node.name.endsWith('.test.ts')) return 'test';
    return 'receipt-engine';
  }
  if (id.startsWith('file:packages/receipt-engine/')) return 'receipt-engine';
  return 'other';
}

// Assign groups
for (const node of fileNodes) {
  node._group = getGroup(node);
}

// Build group map
const groups = {};
for (const node of fileNodes) {
  const g = node._group;
  if (!groups[g]) groups[g] = [];
  groups[g].push(node.id);
}

// Intra-group density
const groupEdges = {};
let intraCount = 0;
let interCount = 0;
const interGroupFlows = {};

for (const edge of importEdges) {
  const srcGroup = fileNodes.find(n => n.id === edge.source)?._group;
  const tgtGroup = fileNodes.find(n => n.id === edge.target)?._group;
  if (!srcGroup || !tgtGroup) continue;
  if (srcGroup === tgtGroup) {
    intraCount++;
    groupEdges[srcGroup] = (groupEdges[srcGroup] || 0) + 1;
  } else {
    interCount++;
    const key = `${srcGroup}->${tgtGroup}`;
    interGroupFlows[key] = (interGroupFlows[key] || 0) + 1;
  }
}

// Node type distribution per group
const typeGroups = {};
for (const node of fileNodes) {
  const g = node._group;
  if (!typeGroups[g]) typeGroups[g] = {};
  const t = node.type || 'unknown';
  typeGroups[g][t] = (typeGroups[g][t] || 0) + 1;
}

// Dependency direction analysis
const depDirections = {};
for (const edge of importEdges) {
  const srcGroup = fileNodes.find(n => n.id === edge.source)?._group;
  const tgtGroup = fileNodes.find(n => n.id === edge.target)?._group;
  if (!srcGroup || !tgtGroup || srcGroup === tgtGroup) continue;
  const key = `${srcGroup}->${tgtGroup}`;
  depDirections[key] = (depDirections[key] || 0) + 1;
}

const results = {
  totalNodes: fileNodes.length,
  totalImportEdges: importEdges.length,
  totalAllEdges: allEdges.length,
  groups,
  intraGroupEdgeCounts: groupEdges,
  intraGroupDensity: intraCount,
  interGroupEdgeCount: interCount,
  interGroupFlows,
  depDirections,
  typeGroups,
  summary: {
    groupsCount: Object.keys(groups).length,
    groupSizes: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
    sortedBySize: Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([k, v]) => ({ group: k, count: v.length }))
  }
};

writeFileSync('/home/dedsec/Projects/pavatiApp/.ua/tmp/ua-arch-results.json', JSON.stringify(results, null, 2));
console.log('Analysis complete. Results written to ua-arch-results.json');
console.log(`Total nodes: ${results.totalNodes}, Groups: ${results.summary.groupsCount}`);
for (const item of results.summary.sortedBySize) {
  console.log(`  ${item.group}: ${item.count} nodes`);
}
