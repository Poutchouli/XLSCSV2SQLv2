import { createSignal, onMount, For, Show } from 'solid-js';
import { createStore } from "solid-js/store";
import { NodeComponent } from './Node';

export interface Node {
  id: string; // Will be the table name
  title: string;
  x: number;
  y: number;
  schema: { name: string, type: string }[];
  rowCount: number;
  data: Record<string, any>[]; // First 5 rows of data
}

function App() {
  const [nodes, setNodes] = createStore<Node[]>([]);
  const [isReady, setIsReady] = createSignal(false);
  const [showDropOverlay, setShowDropOverlay] = createSignal(false);
  const [mousePosition, setMousePosition] = createSignal({ x: 100, y: 100 });
  let worker: Worker;

  onMount(() => {
    worker = new Worker(new URL('./db.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'DB_READY') {
        setIsReady(true);
      } else if (type === 'DB_ERROR') {
        console.error('Database initialization error:', payload);
        alert('Failed to initialize database: ' + payload.error);
      } else if (type === 'NODE_CREATED') {
        // Use the functional form of setNodes to ensure we're updating the latest state.
        // This prevents issues with stale closures in the onmessage callback.
        setNodes(prevNodes => {
          const newNodes = [...prevNodes, payload.node];
          return newNodes;
        });
      } else if (type === 'DATABASE_EXPORTED') {
        downloadFile(payload.dbBytes, `database-backup.sqlite`, 'application/x-sqlite3');
      }
    };

    worker.onerror = (error) => {
      console.error("Worker error:", error);
    };

    // Add keyboard event listener
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'n' || e.key === 'N') {
        handleCreateTestTable();
      }
    };

    // Add mouse move event listener to track mouse position
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('mousemove', handleMouseMove);
    
    // Cleanup event listeners
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  });

  const handlePositionChange = (id: string, x: number, y: number) => {
    setNodes(node => node.id === id, { x, y });
    worker.postMessage({ type: 'UPDATE_POSITION', payload: { id, x, y } });
  };
  
  const handleSaveDatabase = () => {
    worker.postMessage({ type: 'EXPORT_DATABASE' });
  };

  const handleCreateTestTable = () => {
    if (!isReady()) return;
    
    // Use current mouse position
    const position = mousePosition();
    
    worker.postMessage({ 
      type: 'CREATE_TEST_TABLE', 
      payload: { position } 
    });
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setShowDropOverlay(true);
  };
  
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setShowDropOverlay(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setShowDropOverlay(false);
    const file = e.dataTransfer?.files?.[0];

    if (file && file.name.endsWith('.csv')) {
      const buffer = await file.arrayBuffer();
      const tableName = file.name.replace('.csv', '');
      worker.postMessage({
        type: 'IMPORT_CSV',
        payload: {
          fileBuffer: buffer,
          tableName: tableName,
          dropPosition: { x: e.clientX, y: e.clientY }
        }
      });
    } else {
      alert("Please drop a valid .csv file.");
    }
  };
  
  const downloadFile = (content: any, fileName: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  return (
    <div 
      class="app-container" 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div class="controls">
        <button onClick={handleSaveDatabase} disabled={!isReady()}>Save Database</button>
        <span>Nodes: {nodes.length}</span>
      </div>
      <For each={nodes}>
        {(node) => {
          return (
            <NodeComponent 
              node={node}
              onPositionChange={handlePositionChange}
            />
          );
        }}
      </For>
      <Show when={showDropOverlay()}>
        <div class="drop-overlay">Drop CSV File Here</div>
      </Show>
    </div>
  );
}

export default App;