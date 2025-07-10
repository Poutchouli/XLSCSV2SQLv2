import { createSignal, onMount, For, Show } from 'solid-js';
import { createStore, unwrap } from "solid-js/store";
import { NodeComponent } from './Node';
import { Modal } from './Modal'; // Import the new Modal component
import { XlsOptionsModal, type SheetInfo } from './XlsOptionsModal';
import * as XLSX from 'xlsx';
import Papa from 'papaparse'; // We need PapaParse here now

export interface Node {
  id: string; // Will be the table name
  title: string;
  x: number;
  y: number;
  schema: { name: string, type: string }[];
  rowCount: number;
  data: Record<string, any>[]; // First 5 rows of data
  isUploadedToSQLite?: boolean; // Track if this table has been uploaded to SQLite
}

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

function App() {
  const [nodes, setNodes] = createStore<Node[]>([]);
  const [isReady, setIsReady] = createSignal(false);
  const [showDropOverlay, setShowDropOverlay] = createSignal(false);
  const [toasts, setToasts] = createStore<ToastMessage[]>([]);
  const [mousePosition, setMousePosition] = createSignal({ x: 100, y: 100 });
  const [uploadedTablesCount, setUploadedTablesCount] = createSignal(0);
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [tableList, setTableList] = createSignal<string[]>([]);
  const [isXlsModalOpen, setIsXlsModalOpen] = createSignal(false);
  const [xlsSheets, setXlsSheets] = createSignal<SheetInfo[]>([]);
  const [dropPosition, setDropPosition] = createSignal({ x: 0, y: 0 });
  let worker: Worker;

const handleDeleteTable = (tableName: string) => {
    // Ask the user for confirmation before deleting
    if (confirm(`Are you sure you want to permanently delete the table "${tableName}"?`)) {
      worker.postMessage({
        type: 'DROP_TABLE',
        payload: { tableName }
      });
    }
  };

  // Helper function to recalculate uploaded tables count
  const recalculateUploadedCount = () => {
    const count = nodes.filter(node => node.isUploadedToSQLite).length;
    setUploadedTablesCount(count);
  };

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
        
        // Update uploaded counter if the new node is already uploaded
        if (payload.node.isUploadedToSQLite) {
          setUploadedTablesCount(prev => prev + 1);
        }
      } else if (type === 'UPLOAD_STATUS') {
        addToast(payload.message, payload.success ? 'success' : 'error');
        
        // If successful, mark the node as uploaded and increment counter
        if (payload.success && payload.tableName) {
          setNodes(
            (node) => node.id === payload.tableName,
            "isUploadedToSQLite",
            true
          );
          setUploadedTablesCount(prev => prev + 1);
        }
      } else if (type === 'TABLE_LIST') {
        setTableList(payload.tables || []);
        // Also update the count, as this is the most accurate source
        setUploadedTablesCount(payload.tables.length);

      } else if (type === 'DATABASE_EXPORTED') {
        downloadFile(payload.dbBytes, `database-backup.sqlite`, 'application/x-sqlite3');
      }
    };

    worker.onerror = (error) => {
      console.error("Worker error:", error);
    };

    // Create AbortController for cleanup
    const abortController = new AbortController();

    // Add event listeners with anonymous functions
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'n' || e.key === 'N') {
        handleCreateTestTable();
      }
    }, { signal: abortController.signal });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    }, { signal: abortController.signal });
    
    // Cleanup event listeners with single abort call
    return () => {
      abortController.abort();
    };
  });

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts(t => t.filter(toast => toast.id !== id));
    }, 5000); // Remove toast after 5 seconds
  };


  const handlePositionChange = (id: string, x: number, y: number) => {
    // Use Solid's store modifier syntax for a more performant update.
    // This finds the node with the matching id and updates its x and y properties
    // without recreating the entire array.
    setNodes((node) => node.id === id, { x, y });
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

  const handleViewTables = () => {
    worker.postMessage({ type: 'LIST_TABLES' });
    setIsModalOpen(true);
  };

  const handleUploadToSQLite = (nodeToUpload: Node) => {
    if (!isReady()) return;

    // To pass a reactive store object to a Web Worker, it must be converted
    // to a plain JavaScript object. The `unwrap` utility from "solid-js/store"
    // is the recommended and safest way to do this.
    const plainNodeData = unwrap(nodeToUpload);

    worker.postMessage({
      type: 'UPLOAD_TO_SQLITE',
      payload: plainNodeData,
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

    if (!file) return;

    // Store drop position
    setDropPosition({ x: e.clientX, y: e.clientY });

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
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
    } else if (fileExtension === 'xls' || fileExtension === 'xlsx') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheets: SheetInfo[] = workbook.SheetNames.map(name => {
        const sheet = workbook.Sheets[name];
        const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        return { name, data };
      });

      setXlsSheets(sheets);
      setIsXlsModalOpen(true);
    } else {
      addToast("Please drop a valid .csv or .xls/.xlsx file.", 'error');
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

    const handleXlsImport = (selectedSheets: SheetInfo[], rowsToIgnore: number, separator: string) => {
    const pos = dropPosition();

    for (const sheet of selectedSheets) {
      // Skip the specified number of rows
      const dataToProcess = sheet.data.slice(rowsToIgnore);
      if (dataToProcess.length === 0) continue;

      // Use the first row as headers and the rest as data
      const headers = dataToProcess[0];
      const dataRows = dataToProcess.slice(1);

      // Convert the array-of-arrays to an array-of-objects, which PapaParse can unparse
      const dataAsObjects = dataRows.map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
      });

      // Use PapaParse to create a CSV string. This is a robust way to handle formatting.
      const csvString = Papa.unparse(dataAsObjects, {
        header: true,
        delimiter: separator,
      });
      
      const fileBuffer = new TextEncoder().encode(csvString).buffer;

      // Send to the worker just like a regular CSV
      worker.postMessage({
        type: 'IMPORT_CSV',
        payload: {
          fileBuffer: fileBuffer,
          tableName: sheet.name, // Use sheet name as table name
          dropPosition: { x: pos.x, y: pos.y }
        }
      });

      // Offset the next node slightly
      pos.x += 30;
      pos.y += 30;
      setDropPosition(pos);
    }
  };


return (
    <div
      class="app-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div class="controls">
        <button onClick={handleSaveDatabase} disabled={!isReady()}>Save DB</button>
        <button onClick={handleViewTables} disabled={!isReady()}>View Tables</button>
        <span>Nodes: {nodes.length}</span>
        <span>Uploaded: {uploadedTablesCount()}</span>
      </div>

      <div class="toast-container">
        <For each={toasts}>
          {(toast) => (
            <div class={`toast ${toast.type}`}>{toast.message}</div>
          )}
        </For>
      </div>

      <For each={nodes}>
        {(node) => {
          return (
            <NodeComponent
              node={node}
              onPositionChange={handlePositionChange}
              onUploadToSQLite={handleUploadToSQLite}
            />
          );
        }}
      </For>

      <Show when={showDropOverlay()}>
        <div class="drop-overlay">Drop CSV File Here</div>
      </Show>

      {/* The Modal component is now correctly self-closed */}
      <Modal
        isOpen={isModalOpen()}
        title="Uploaded SQLite Tables"
        tableNames={tableList()}
        onClose={() => setIsModalOpen(false)}
        // Pass the new handler function as a prop
        onDelete={handleDeleteTable}
      />
      <XlsOptionsModal
        isOpen={isXlsModalOpen()}
        sheets={xlsSheets()}
        onClose={() => setIsXlsModalOpen(false)}
        onImport={handleXlsImport}
      />
    </div>
  );
}

export default App;