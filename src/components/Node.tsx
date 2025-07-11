import type { Node } from '../App';
import './Node.css';
import { createSignal, Show, createMemo } from 'solid-js';

type NodeProps = {
  node: Node;
  onPositionChange: (id: string, x: number, y: number) => void;
  onUploadToSQLite: (node: Node) => void;
};

export function NodeComponent(props: NodeProps) {
  // Destructure for cleaner access in the JSX
  const { node } = props;
  let noteRef: HTMLDivElement | undefined;
  const [showData, setShowData] = createSignal(false);
  
  // Memoize computed values to improve performance
  const visibleSchemaFields = createMemo(() => node.schema.slice(0, 5));
  const additionalFieldsCount = createMemo(() => Math.max(0, node.schema.length - 5));
  
  const handleMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return; // Don't drag when clicking buttons
    e.preventDefault();
    e.stopPropagation();

    const startMousePos = { x: e.clientX, y: e.clientY };
    const startNodePos = { x: node.x, y: node.y };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMousePos.x;
      const deltaY = moveEvent.clientY - startMousePos.y;
      props.onPositionChange(node.id, startNodePos.x + deltaX, startNodePos.y + deltaY);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toggleDataView = () => {
    setShowData(!showData());
  };

  const handleUploadToSQLite = () => {
    props.onUploadToSQLite(node);
  };

  return (
    <div
      ref={noteRef}
      class="node-card"
      style={{
        position: 'absolute',
        left: `${node.x}px`,
        top: `${node.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div class="node-header">
        <h4>{node.title}</h4>
        <button 
          onClick={handleUploadToSQLite} 
          class="upload-btn" 
          title={node.isUploadedToSQLite ? "Already uploaded to SQLite" : "Upload to SQLite"}
          disabled={node.isUploadedToSQLite}
        >
          {node.isUploadedToSQLite ? '✓' : '↑'}
        </button>
      </div>
      <div class="node-content">
        <div class="schema-display">
          <h5>Fields ({node.schema.length}):</h5>
          <ul class="schema-list">
            {visibleSchemaFields().map(col => <li>{col.name} ({col.type})</li>)}
            {additionalFieldsCount() > 0 && <li class="schema-more">... and {additionalFieldsCount()} more</li>}
          </ul>
        </div>
        <Show when={showData()}>
          <div class="data-preview">
            <h5>First 5 rows:</h5>
            <div class="data-table">
              <table>
                <thead>
                  <tr>
                    {node.schema.map(col => <th>{col.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {node.data.map((row, index) => (
                    <tr>
                      {node.schema.map(col => <td>{row[col.name] || ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Show>
      </div>
      <button onClick={toggleDataView} class="data-toggle-btn-small">
        {showData() ? '▼' : '▶'}
      </button>
      <div class="row-count">
        {node.rowCount || 0} rows
      </div>
    </div>
  );
}