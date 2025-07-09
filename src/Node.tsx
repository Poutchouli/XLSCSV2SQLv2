import type { Node } from './App';
import './Node.css';
import { createSignal, Show } from 'solid-js';

type NodeProps = {
  node: Node;
  onPositionChange: (id: string, x: number, y: number) => void;
};

export function NodeComponent(props: NodeProps) {
  let noteRef: HTMLDivElement | undefined;
  const [showData, setShowData] = createSignal(false);
  
  const handleMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return; // Don't drag when clicking buttons
    e.preventDefault();
    e.stopPropagation();

    const startMousePos = { x: e.clientX, y: e.clientY };
    const startNodePos = { x: props.node.x, y: props.node.y };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMousePos.x;
      const deltaY = moveEvent.clientY - startMousePos.y;
      props.onPositionChange(props.node.id, startNodePos.x + deltaX, startNodePos.y + deltaY);
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

  return (
    <div
      ref={noteRef}
      class="node-card"
      style={{
        position: 'absolute',
        left: `${props.node.x}px`,
        top: `${props.node.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div class="node-header">
        <h4>{props.node.title}</h4>
      </div>
      <div class="node-content">
        <div class="schema-display">
          <h5>Fields ({props.node.schema.length}):</h5>
          <ul class="schema-list">
            {props.node.schema.slice(0, 5).map(col => <li>{col.name} ({col.type})</li>)}
            {props.node.schema.length > 5 && <li class="schema-more">... and {props.node.schema.length - 5} more</li>}
          </ul>
        </div>
        <Show when={showData()}>
          <div class="data-preview">
            <h5>First 5 rows:</h5>
            <div class="data-table">
              <table>
                <thead>
                  <tr>
                    {props.node.schema.map(col => <th>{col.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {props.node.data.map((row, index) => (
                    <tr>
                      {props.node.schema.map(col => <td>{row[col.name] || ''}</td>)}
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
        {props.node.rowCount || 0} rows
      </div>
    </div>
  );
}