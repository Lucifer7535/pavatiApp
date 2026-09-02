#!/usr/bin/env node
const fs = require('fs');
const input = JSON.parse(fs.readFileSync('/home/dedsec/Projects/pavatiApp/.ua/tmp/ua-tour-input.json', 'utf8'));
const { nodes, edges, layers } = input;

// Build adjacency
const inEdges = {}, outEdges = {};
nodes.forEach(n => { inEdges[n.id] = []; outEdges[n.id] = []; });
edges.forEach(e => {
  if (inEdges[e.target]) inEdges[e.target].push(e);
  if (outEdges[e.source]) outEdges[e.source].push(e);
});

// Fan-in (in-degree)
const fanIn = nodes.map(n => ({ id: n.id, count: inEdges[n.id].length }))
  .sort((a, b) => b.count - a.count);

// Fan-out (out-degree)
const fanOut = nodes.map(n => ({ id: n.id, count: outEdges[n.id].length }))
  .sort((a, b) => b.count - a.count);

// PageRank (simplified)
const N = nodes.length;
const pr = {};
nodes.forEach(n => pr[n.id] = 1 / N);
for (let iter = 0; iter < 30; iter++) {
  const next = {};
  nodes.forEach(n => next[n.id] = (1 - 0.85) / N);
  nodes.forEach(n => {
    const targets = outEdges[n.id].map(e => e.target).filter(t => pr[t] !== undefined);
    if (targets.length > 0) {
      targets.forEach(t => { next[t] += 0.85 * pr[n.id] / targets.length; });
    } else {
      nodes.forEach(t => { next[t] += 0.85 * pr[n.id] / N; });
    }
  });
  Object.assign(pr, next);
}
const prRanking = Object.entries(pr).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, score]) => ({ id, score: Math.round(score * 10000) / 10000 }));

// Longest paths (DAG - topological BFS)
const adj = {};
nodes.forEach(n => adj[n.id] = []);
edges.forEach(e => { if (adj[e.source]) adj[e.source].push(e.target); });
const depth = {};
nodes.forEach(n => depth[n.id] = 0);
const visited = new Set();
function dfs(id, path) {
  if (visited.has(id)) return;
  visited.add(id);
  for (const next of (adj[id] || [])) {
    depth[next] = Math.max(depth[next], depth[id] + 1);
    dfs(next, path);
  }
}
nodes.forEach(n => dfs(n.id, []));
const longestPaths = Object.entries(depth).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, d]) => ({ id, depth: d }));

const results = { fanIn, fanOut, prRanking, longestPaths, layerMap: {} };
layers.forEach(l => { results.layerMap[l.id] = l; });

fs.writeFileSync('/home/dedsec/Projects/pavatiApp/.ua/tmp/ua-tour-results.json', JSON.stringify(results, null, 2));
console.log('Top fan-in:', fanIn.slice(0, 10).map(f => f.id + ':' + f.count).join(', '));
console.log('Top fan-out:', fanOut.slice(0, 10).map(f => f.id + ':' + f.count).join(', '));
console.log('PageRank top 10:', prRanking.slice(0, 10).map(p => p.id + ':' + p.score).join(', '));
console.log('Longest paths:', longestPaths.slice(0, 5).map(p => p.id + ':' + p.depth).join(', '));
