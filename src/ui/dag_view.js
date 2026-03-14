/**
 * DAG View — Meant-Graph Visualization
 * SVG-based dependency graph with EO operator glyphs.
 *
 * Nodes: Given-Log sources (blue), steps with operator glyphs
 * Edges: dependency arrows
 * Colors: immutable (blue), completed (green), stale (amber), failed (red)
 * SUP(∥) nodes shown as split parallel paths
 */

import { buildDAG, getProvenanceChain } from '../meant/dag.js';
import { getAllSessions } from '../models/meant_graph.js';
import { OPERATORS } from '../models/operators.js';
import { html, toast } from './components.js';

/**
 * Render the DAG view.
 */
export function renderDAGView(container) {
  container.innerHTML = '';

  const view = html`
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 1.2rem;">
          <span style="color: var(--accent);">${OPERATORS.REC.glyph}</span>
          Meant-Graph DAG
        </h2>
      </div>
    </div>
  `;

  // Session selector
  const sessions = getAllSessions();
  if (sessions.length === 0) {
    view.appendChild(html`
      <div class="empty-state">
        <div class="glyph">↬</div>
        <p>No sessions to visualize.<br>Create a session and add steps first.</p>
      </div>
    `);
    container.appendChild(view);
    return;
  }

  const selector = html`
    <div class="form-group">
      <label class="form-label">Session</label>
      <select class="form-select" id="dag-session-select"></select>
    </div>
  `;
  const select = selector.querySelector('select');
  for (const session of sessions) {
    const opt = document.createElement('option');
    opt.value = session.id;
    opt.textContent = session.name;
    select.appendChild(opt);
  }
  view.appendChild(selector);

  // DAG SVG container
  const svgContainer = document.createElement('div');
  svgContainer.id = 'dag-svg-container';
  svgContainer.style.cssText = 'background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 24px; min-height: 400px; overflow: auto;';
  view.appendChild(svgContainer);

  // Render DAG on selection
  select.addEventListener('change', () => {
    _renderDAGSVG(svgContainer, select.value);
  });

  // Initial render
  if (sessions.length > 0) {
    setTimeout(() => _renderDAGSVG(svgContainer, sessions[0].id), 0);
  }

  container.appendChild(view);
}

function _renderDAGSVG(container, sessionId) {
  try {
    const { nodes, edges } = buildDAG(sessionId);

    if (nodes.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding: 40px;"><p>No steps in this session yet.</p></div>';
      return;
    }

    // Layout: simple layered layout
    const layers = _layoutDAG(nodes, edges);
    const NODE_W = 160;
    const NODE_H = 60;
    const LAYER_GAP = 100;
    const NODE_GAP = 20;

    const maxNodesInLayer = Math.max(...layers.map(l => l.length));
    const svgWidth = Math.max(600, maxNodesInLayer * (NODE_W + NODE_GAP) + 100);
    const svgHeight = layers.length * (NODE_H + LAYER_GAP) + 100;

    // Build SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

    // Defs for arrow marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#64748b"/>
      </marker>
    `;
    svg.appendChild(defs);

    // Calculate node positions
    const nodePositions = {};
    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      const layerWidth = layer.length * (NODE_W + NODE_GAP) - NODE_GAP;
      const startX = (svgWidth - layerWidth) / 2;

      for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
        const node = layer[nodeIdx];
        nodePositions[node.id] = {
          x: startX + nodeIdx * (NODE_W + NODE_GAP),
          y: 40 + layerIdx * (NODE_H + LAYER_GAP)
        };
      }
    }

    // Draw edges
    for (const edge of edges) {
      const from = nodePositions[edge.from];
      const to = nodePositions[edge.to];
      if (!from || !to) continue;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x + NODE_W / 2);
      line.setAttribute('y1', from.y + NODE_H);
      line.setAttribute('x2', to.x + NODE_W / 2);
      line.setAttribute('y2', to.y);
      line.setAttribute('stroke', '#475569');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('marker-end', 'url(#arrowhead)');
      svg.appendChild(line);
    }

    // Draw nodes
    for (const node of nodes) {
      const pos = nodePositions[node.id];
      if (!pos) continue;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      g.style.cursor = 'pointer';

      // Node rectangle
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', NODE_W);
      rect.setAttribute('height', NODE_H);
      rect.setAttribute('rx', '8');

      const colors = _getNodeColors(node);
      rect.setAttribute('fill', colors.fill);
      rect.setAttribute('stroke', colors.stroke);
      rect.setAttribute('stroke-width', '2');

      g.appendChild(rect);

      // Glyph
      const glyph = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      glyph.setAttribute('x', '16');
      glyph.setAttribute('y', '28');
      glyph.setAttribute('font-size', '20');
      glyph.setAttribute('fill', colors.glyphColor);
      glyph.textContent = node.type === 'given' ? OPERATORS.INS.glyph : (OPERATORS[node.operatorType]?.glyph || '?');
      g.appendChild(glyph);

      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '44');
      label.setAttribute('y', '24');
      label.setAttribute('font-size', '12');
      label.setAttribute('fill', '#f1f5f9');
      label.setAttribute('font-family', 'monospace');
      label.textContent = node.label.length > 14 ? node.label.substring(0, 14) + '…' : node.label;
      g.appendChild(label);

      // Status
      const status = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      status.setAttribute('x', '44');
      status.setAttribute('y', '44');
      status.setAttribute('font-size', '10');
      status.setAttribute('fill', colors.statusColor);
      status.setAttribute('font-family', 'monospace');
      status.textContent = node.status || '';
      g.appendChild(status);

      // Click handler — highlight provenance chain
      g.addEventListener('click', () => {
        _highlightProvenance(svg, node.id, nodes, edges, nodePositions);
      });

      svg.appendChild(g);
    }

    container.innerHTML = '';
    container.appendChild(svg);

  } catch (err) {
    container.innerHTML = `<div style="color: var(--failed-border); padding: 20px;">${err.message}</div>`;
  }
}

function _getNodeColors(node) {
  if (node.type === 'given') {
    return { fill: 'rgba(8, 145, 178, 0.15)', stroke: '#0891b2', glyphColor: '#0891b2', statusColor: '#0891b2' };
  }
  switch (node.status) {
    case 'completed': return { fill: 'rgba(22, 163, 74, 0.1)', stroke: '#16a34a', glyphColor: '#16a34a', statusColor: '#16a34a' };
    case 'stale': return { fill: 'rgba(234, 179, 8, 0.1)', stroke: '#eab308', glyphColor: '#eab308', statusColor: '#eab308' };
    case 'failed': return { fill: 'rgba(220, 38, 38, 0.1)', stroke: '#dc2626', glyphColor: '#dc2626', statusColor: '#dc2626' };
    case 'running': return { fill: 'rgba(56, 189, 248, 0.1)', stroke: '#38bdf8', glyphColor: '#38bdf8', statusColor: '#38bdf8' };
    default: return { fill: 'rgba(100, 116, 139, 0.1)', stroke: '#64748b', glyphColor: '#94a3b8', statusColor: '#64748b' };
  }
}

function _layoutDAG(nodes, edges) {
  // Simple layered layout using topological-ish ordering
  const inDegree = {};
  const adjList = {};
  const nodeMap = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjList[node.id] = [];
    nodeMap[node.id] = node;
  }

  for (const edge of edges) {
    if (adjList[edge.from]) adjList[edge.from].push(edge.to);
    inDegree[edge.to] = (inDegree[edge.to] || 0) + 1;
  }

  const layers = [];
  const remaining = new Set(nodes.map(n => n.id));

  while (remaining.size > 0) {
    const layer = [];
    for (const id of remaining) {
      if ((inDegree[id] || 0) === 0) {
        layer.push(nodeMap[id]);
      }
    }

    if (layer.length === 0) {
      // Break cycles by picking one
      const first = remaining.values().next().value;
      layer.push(nodeMap[first]);
    }

    for (const node of layer) {
      remaining.delete(node.id);
      for (const dep of (adjList[node.id] || [])) {
        inDegree[dep]--;
      }
    }

    layers.push(layer);
  }

  return layers;
}

function _highlightProvenance(svg, nodeId, nodes, edges, positions) {
  // Reset all edges
  svg.querySelectorAll('line').forEach(l => {
    l.setAttribute('stroke', '#475569');
    l.setAttribute('stroke-width', '2');
  });

  // Find upstream chain
  const upstream = new Set();
  function findUpstream(id) {
    upstream.add(id);
    for (const edge of edges) {
      if (edge.to === id && !upstream.has(edge.from)) {
        findUpstream(edge.from);
      }
    }
  }
  findUpstream(nodeId);

  // Highlight edges in the chain
  svg.querySelectorAll('line').forEach(l => {
    const x1 = parseFloat(l.getAttribute('x1'));
    const y1 = parseFloat(l.getAttribute('y1'));

    for (const edge of edges) {
      const from = positions[edge.from];
      const to = positions[edge.to];
      if (!from || !to) continue;

      if (upstream.has(edge.from) && upstream.has(edge.to)) {
        if (Math.abs(x1 - (from.x + 80)) < 5) {
          l.setAttribute('stroke', '#38bdf8');
          l.setAttribute('stroke-width', '3');
        }
      }
    }
  });

  toast(`π provenance: ${upstream.size} nodes in chain`, 'info');
}
