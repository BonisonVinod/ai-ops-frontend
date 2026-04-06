import React from "react";
import ReactFlow from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";

const nodeWidth = 180;
const nodeHeight = 60;

// 🎯 Role-based color mapping
const getNodeStyle = (label) => {
  const text = label.toLowerCase();

  if (text.includes("level 1") || text.includes("l1")) {
    return { background: "#d4edda", border: "1px solid #28a745" }; // green
  }
  if (text.includes("level 2") || text.includes("l2")) {
    return { background: "#fff3cd", border: "1px solid #ffc107" }; // yellow
  }
  if (text.includes("engineering")) {
    return { background: "#f8d7da", border: "1px solid #dc3545" }; // red
  }
  if (text.includes("system")) {
    return { background: "#e2e3e5", border: "1px solid #6c757d" }; // grey
  }

  return { background: "#d1ecf1", border: "1px solid #17a2b8" }; // default blue
};

// 🧹 Minimal label cleanup
const formatLabel = (node) => {
  let text = node.label || node.name || "Node";

  return text
    .replace(/activity_\d+\s*-\s*/i, "")
    .replace(/task_\d+\s*-\s*/i, "")
    .slice(0, 60);
};

// 📉 Collapse activities (simple rule)
const isActivity = (node) => {
  const text = (node.label || "").toLowerCase();
  return text.includes("activity");
};

const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: "TB",
    nodesep: 50,
    ranksep: 100,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const pos = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: pos.x - nodeWidth / 2,
          y: pos.y - nodeHeight / 2,
        },
      };
    }),
    edges,
  };
};

const GraphView = ({ data }) => {
  const rawNodes = data?.nodes || [];
  const edges = data?.edges || [];

  // 🎯 Collapse activities
  const filteredNodes = rawNodes.filter((node) => !isActivity(node));

  // Map only edges that connect visible nodes
  const validNodeIds = new Set(filteredNodes.map((n) => String(n.id)));

  const filteredEdges = edges.filter(
    (e) =>
      validNodeIds.has(String(e.source)) &&
      validNodeIds.has(String(e.target))
  );

  const flowNodes = filteredNodes.map((node, index) => {
    const label = formatLabel(node);

    return {
      id: String(node.id || index),
      data: { label },
      style: getNodeStyle(label),
      position: { x: 0, y: 0 },
    };
  });

  const flowEdges = filteredEdges.map((edge, index) => ({
    id: String(index),
    source: String(edge.source),
    target: String(edge.target),
  }));

  const { nodes: layoutedNodes, edges: layoutedEdges } =
    getLayoutedElements(flowNodes, flowEdges);

  return (
    <div
      style={{
        height: "700px",
        border: "1px solid #ccc",
        marginTop: "10px",
      }}
    >
      <ReactFlow
  nodes={layoutedNodes}
  edges={layoutedEdges}
  fitView
  fitViewOptions={{ padding: 0.2 }}
  minZoom={0.5}
  maxZoom={1.5}
/>
    </div>
  );
};

export default GraphView;
