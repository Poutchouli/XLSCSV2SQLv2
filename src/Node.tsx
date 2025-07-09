import type { Node } from './App';
import './Node.css';

type NodeProps = {
  node: Node;
  onPositionChange: (id: string, x: number, y: number) => void;
  onSaveAsCsv: (tableName: string) => void;
};

export function NodeComponent(props: NodeProps) {
  let noteRef: HTMLDivElement | undefined;
  
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
        <button onClick={() => props.onSaveAsCsv(props.node.id)}>Save</button>
      </div>
      <div class="node-content">
        <p>{props.node.rowCount} rows</p>
        <ul class="schema-list">
          {props.node.schema.map(col => <li>{col.name} ({col.type})</li>)}
        </ul>
      </div>
    </div>
  );
}