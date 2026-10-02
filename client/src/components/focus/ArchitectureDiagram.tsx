import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface ArchitectureDiagramProps {
  focusProject: string;
}

const nodeStyleBase = {
  background: 'rgba(15, 23, 42, 0.85)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  color: '#f8fafc',
  borderRadius: '10px',
  padding: '12px 16px',
  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  fontSize: '0.85rem',
  fontWeight: 500,
};

const arrowMarker = {
  type: MarkerType.ArrowClosed,
  width: 14,
  height: 14,
  color: '#818cf8',
};

// Multi-directional Connection Handles
const NodeHandles = () => (
  <>
    <Handle type="target" position={Position.Top} id="t-top" />
    <Handle type="source" position={Position.Bottom} id="s-bottom" />
    <Handle type="target" position={Position.Left} id="t-left" />
    <Handle type="source" position={Position.Right} id="s-right" />
  </>
);

// --- Inline Editable Label ---
const EditableNodeLabel = ({ label, onChangeLabel }: { label: string; onChangeLabel?: (val: string) => void }) => {
  const [isEditing, setIsEditing] = useState(!label || label.trim() === '');
  const [text, setText] = useState(label || '');

  useEffect(() => {
    setText(label || '');
  }, [label]);

  const handleFinish = () => {
    setIsEditing(false);
    if (onChangeLabel && text !== label) {
      onChangeLabel(text);
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleFinish}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleFinish();
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        placeholder="Name component…"
        style={{
          background: '#020617',
          border: '1px solid #818cf8',
          borderRadius: '4px',
          color: '#f8fafc',
          padding: '2px 6px',
          fontSize: '0.78rem',
          width: '90%',
          textAlign: 'center',
          outline: 'none',
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      style={{
        cursor: 'pointer',
        textAlign: 'center',
        userSelect: 'none',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
        width: '100%',
      }}
      title="Double click to edit component name"
    >
      {label && label.trim() ? (
        label
      ) : (
        <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.75rem' }}>Double-click to name</span>
      )}
    </div>
  );
};// --- Custom Node Components ---
const SquareNode = ({ data, selected }: any) => (
  <div style={{
    ...nodeStyleBase,
    border: `1px solid ${selected ? '#818cf8' : 'rgba(99, 102, 241, 0.6)'}`,
    boxShadow: selected ? '0 0 0 2px rgba(99, 102, 241, 0.4)' : nodeStyleBase.boxShadow,
    minWidth: 120,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  }}>
    <NodeHandles />
    <EditableNodeLabel label={data.label} onChangeLabel={data.onChangeLabel} />
  </div>
);

const CircleNode = ({ data, selected }: any) => (
  <div style={{
    ...nodeStyleBase,
    border: `1px solid ${selected ? '#818cf8' : 'rgba(16, 185, 129, 0.6)'}`,
    boxShadow: selected ? '0 0 0 2px rgba(99, 102, 241, 0.4)' : nodeStyleBase.boxShadow,
    borderRadius: '50%',
    width: 110,
    height: 110,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '10px',
    position: 'relative',
  }}>
    <NodeHandles />
    <EditableNodeLabel label={data.label} onChangeLabel={data.onChangeLabel} />
  </div>
);

const RhombusNode = ({ data, selected }: any) => (
  <div style={{
    width: 110,
    height: 110,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <div style={{
      ...nodeStyleBase,
      border: `1px solid ${selected ? '#818cf8' : 'rgba(129, 140, 248, 0.6)'}`,
      boxShadow: selected ? '0 0 0 2px rgba(99, 102, 241, 0.4)' : nodeStyleBase.boxShadow,
      position: 'absolute',
      width: '100%',
      height: '100%',
      transform: 'rotate(45deg)',
      zIndex: 0,
      borderRadius: '12px',
      padding: 0
    }} />
    <NodeHandles />
    <div style={{ 
      textAlign: 'center', 
      zIndex: 1, 
      width: '90%',
      display: 'flex',
      justifyContent: 'center',
    }}>
      <EditableNodeLabel label={data.label} onChangeLabel={data.onChangeLabel} />
    </div>
  </div>
);

const CylinderNode = ({ data, selected }: any) => (
  <div
    style={{
      width: 120,
      height: 110,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 120 110"
      style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}
    >
      <defs>
        <linearGradient id="dbGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <path
        d="M 10,20 L 10,90 A 50,15 0 0,0 110,90 L 110,20 Z"
        fill="url(#dbGrad)"
        stroke={selected ? '#818cf8' : 'rgba(16, 185, 129, 0.8)'}
        strokeWidth="1.5"
      />
      <path
        d="M 10,43 A 50,15 0 0,0 110,43"
        fill="none"
        stroke="rgba(16, 185, 129, 0.4)"
        strokeWidth="1.5"
      />
      <path
        d="M 10,66 A 50,15 0 0,0 110,66"
        fill="none"
        stroke="rgba(16, 185, 129, 0.4)"
        strokeWidth="1.5"
      />
      <ellipse
        cx="60"
        cy="20"
        rx="50"
        ry="15"
        fill="#1e293b"
        stroke={selected ? '#818cf8' : '#10b981'}
        strokeWidth="2"
      />
    </svg>
    <NodeHandles />
    <div
      style={{
        zIndex: 1,
        width: '85%',
        marginTop: 10,
        display: 'flex',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <EditableNodeLabel label={data.label} onChangeLabel={data.onChangeLabel} />
    </div>
  </div>
);

const CapsuleNode = ({ data, selected }: any) => (
  <div style={{
    ...nodeStyleBase,
    border: `1px solid ${selected ? '#818cf8' : 'rgba(236, 72, 153, 0.6)'}`,
    boxShadow: selected ? '0 0 0 2px rgba(236, 72, 153, 0.4)' : nodeStyleBase.boxShadow,
    borderRadius: '24px',
    padding: '8px 18px',
    minWidth: 120,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  }}>
    <NodeHandles />
    <EditableNodeLabel label={data.label} onChangeLabel={data.onChangeLabel} />
  </div>
);

const nodeTypes = {
  default: SquareNode,
  square: SquareNode,
  circle: CircleNode,
  rhombus: RhombusNode,
  database: CylinderNode,
  capsule: CapsuleNode,
};
// -----------------------------

const initialNodes: Node[] = [
  { id: '1', type: 'square', position: { x: 50, y: 80 }, data: { label: '💻 Client Frontend' } },
  { id: '2', type: 'rhombus', position: { x: 280, y: 80 }, data: { label: '⚡ Backend Router' } },
  { id: '3', type: 'database', position: { x: 520, y: 80 }, data: { label: '🗄️ Database / Store' } },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', label: 'HTTP / API', animated: true, style: { stroke: '#818cf8', strokeWidth: 2 }, markerEnd: arrowMarker },
  { id: 'e2-3', source: '2', target: '3', label: 'Queries', style: { stroke: '#34d399', strokeWidth: 2 }, markerEnd: { ...arrowMarker, color: '#34d399' } },
];

export default function ArchitectureDiagram({ focusProject }: ArchitectureDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedElements, setSelectedElements] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const isLoaded = useRef(false);

  // Load per project
  useEffect(() => {
    if (!focusProject) return;
    isLoaded.current = false;
    const saved = localStorage.getItem(`stitch_architecture_${focusProject}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.edges) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
        }
      } catch (e) {
        setNodes(initialNodes);
        setEdges(initialEdges);
      }
    } else {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
    setTimeout(() => {
      isLoaded.current = true;
    }, 100);
  }, [focusProject, setNodes, setEdges]);

  // Save changes automatically on node/edge updates
  useEffect(() => {
    if (!focusProject || !isLoaded.current) return;
    localStorage.setItem(
      `stitch_architecture_${focusProject}`,
      JSON.stringify({ nodes, edges })
    );
  }, [nodes, edges, focusProject]);

  const updateNodeLabel = useCallback((id: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              label: newLabel,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const nodesWithHandlers = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onChangeLabel: (newLabel: string) => updateNodeLabel(n.id, newLabel),
      },
    }));
  }, [nodes, updateNodeLabel]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#818cf8', strokeWidth: 2 }, markerEnd: arrowMarker }, eds));
    },
    [setEdges]
  );

  const handleAddNode = (type: string) => {
    const newNode: Node = {
      id: Date.now().toString(),
      type,
      position: { x: Math.random() * 250 + 50, y: Math.random() * 150 + 50 },
      data: { label: '' },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  const handleDeleteSelected = useCallback(() => {
    const selectedNodeIds = new Set(selectedElements.nodes.map((n) => n.id));
    const selectedEdgeIds = new Set(selectedElements.edges.map((e) => e.id));

    setNodes((nds) => nds.filter((n) => !selectedNodeIds.has(n.id)));
    setEdges((eds) =>
      eds.filter(
        (e) =>
          !selectedEdgeIds.has(e.id) &&
          !selectedNodeIds.has(e.source) &&
          !selectedNodeIds.has(e.target)
      )
    );
    setSelectedElements({ nodes: [], edges: [] });
  }, [selectedElements, setNodes, setEdges]);

  const handleResetDiagram = () => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  };

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
    setSelectedElements({ nodes: selNodes, edges: selEdges });
  }, []);

  return (
    <div className="focus-card" style={{ padding: '1.25rem' }}>
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📐 System Architecture Diagram</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(selectedElements.nodes.length > 0 || selectedElements.edges.length > 0) && (
            <button
              className="btn btn-secondary"
              style={{
                padding: '3px 8px',
                fontSize: '0.75rem',
                color: '#f87171',
                borderColor: 'rgba(248, 113, 113, 0.4)',
                background: 'rgba(239, 68, 68, 0.1)',
              }}
              onClick={handleDeleteSelected}
            >
              🗑️ Delete Selected ({selectedElements.nodes.length + selectedElements.edges.length})
            </button>
          )}
          <button
            className="btn btn-secondary"
            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '📉 Compact View' : '🔍 Expand Canvas'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
            onClick={handleResetDiagram}
            title="Reset Diagram"
          >
            Reset
          </button>
        </div>
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, marginRight: 2 }}>+ Add Shape:</span>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          onClick={() => handleAddNode('square')}
        >
          Square
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          onClick={() => handleAddNode('circle')}
        >
          Circle
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          onClick={() => handleAddNode('rhombus')}
        >
          Rhombus
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          onClick={() => handleAddNode('database')}
        >
          Database
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          onClick={() => handleAddNode('capsule')}
        >
          Capsule
        </button>
      </div>

      <div
        style={{
          width: '100%',
          height: isExpanded ? '500px' : '260px',
          background: '#020617',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          overflow: 'hidden',
          transition: 'height 0.3s ease',
        }}
      >
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          fitView
        >
          <Background color="#334155" gap={16} size={1} />
          <Controls />
          {isExpanded && <MiniMap style={{ background: '#0f172a' }} zoomable pannable />}
        </ReactFlow>
      </div>

      <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
        <span>💡 Click shape to add • Double-click node on canvas to edit name • Select & press Backspace to delete</span>
        <span style={{ color: '#818cf8' }}>Auto-saved per project</span>
      </div>
    </div>
  );
}


