/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import Papa from 'papaparse';

let db: any = null;
let sqlite3: any = null;

async function init() {
  console.log("Worker script loaded, starting init...");
  try {
    console.log("Initializing SQLite3 module...");
    
    // Use the default initialization - let the module handle WASM loading
    sqlite3 = await sqlite3InitModule();
    console.log("SQLite3 module loaded:", sqlite3);

    db = new sqlite3.oo1.DB(':memory:', 'c');
    console.log("In-memory database created.");
    
    console.log("Posting DB_READY message to main thread...");
    self.postMessage({ type: 'DB_READY' });
    console.log("DB_READY message posted.");
  } catch (error) {
    console.error('Error initializing SQLite:', error);
    self.postMessage({ type: 'DB_ERROR', payload: { error: error.message } });
  }
}

console.log("Worker script executing, calling init()...");
init();

self.onmessage = async (e: MessageEvent) => {
  console.log("Worker received message:", e.data);
  const { type, payload } = e.data;

  switch (type) {
    case 'IMPORT_CSV':
      console.log("Handling CSV import...");
      handleImportCsv(payload);
      break;
    case 'CREATE_TEST_TABLE':
      console.log("Handling test table creation...");
      handleCreateTestTable(payload);
      break;
    case 'UPDATE_POSITION':
      console.log("Handling position update...");
      // For simplicity, we don't persist position in this clean start.
      // In a real app, you would save it to a metadata table.
      break;
    case 'EXPORT_DATABASE':
      console.log("Handling database export...");
      handleExportDatabase();
      break;
    default:
      console.log("Unknown message type:", type);
  }
};

function getUniqueTableName(baseName: string): string {
  let tableName = baseName;
  let counter = 1;
  
  // Check if table exists and increment counter until we find a unique name
  while (true) {
    try {
      // Use bound parameters to prevent SQL injection vulnerabilities.
      const result = db.exec({
        sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        bind: [tableName]
      });
      if (result.length === 0) {
        // Table doesn't exist, we can use this name
        return tableName;
      }
      // Table exists, try with suffix
      tableName = `${baseName}_${counter}`;
      counter++;
    } catch (error) {
      // If there's an error during the check, log it and assume the name is usable to avoid an infinite loop.
      console.error("Error checking for table existence:", error);
      return tableName;
    }
  }
}

function handleImportCsv(payload: any) {
  console.log("handleImportCsv called with payload:", payload);
  
  const { fileBuffer, tableName: originalTableName, dropPosition } = payload;
  const fileText = new TextDecoder().decode(fileBuffer);
  
  console.log("Parsing CSV file...");
  const parseResult = Papa.parse(fileText, {
      header: true,
      skipEmptyLines: true,
  });

  const headers = parseResult.meta.fields!;
  const data = parseResult.data as Record<string, any>[];
  
  console.log("CSV parsed successfully, headers:", headers, "rows:", data.length);
  
  // Create a test node with CSV data (without SQLite for now)
  const tableName = `${originalTableName}_${Date.now()}`;
  
  const nodeData = {
    id: tableName,
    title: tableName,
    x: dropPosition.x,
    y: dropPosition.y,
    schema: headers.map(h => ({ name: h, type: 'TEXT' })),
    rowCount: data.length,
    data: data.slice(0, 5), // First 5 rows
  };
  
  console.log("Posting NODE_CREATED message with CSV data:", nodeData);
  
  self.postMessage({
    type: 'NODE_CREATED',
    payload: {
      node: nodeData
    }
  });
  
  console.log("NODE_CREATED message posted successfully");
}

function handleCreateTestTable(payload: any) {
  console.log("handleCreateTestTable called with payload:", payload);
  
  // First, let's test if we can create a node without SQLite
  const { position = { x: 100, y: 100 } } = payload;
  const tableName = `test_table_${Date.now()}`;
  
  console.log("Creating test node without SQLite...");
  
  // Generate sample data
  const sampleData: Record<string, any>[] = [];
  for (let i = 0; i < 5; i++) {
    sampleData.push({
      X: (Math.random() * 100).toFixed(2),
      Y: (Math.random() * 100).toFixed(2),
      Z: (Math.random() * 100).toFixed(2)
    });
  }
  
  // Create a test node with dummy data
  const nodeData = {
    id: tableName,
    title: tableName,
    x: position.x,
    y: position.y,
    schema: [
      { name: 'X', type: 'TEXT' },
      { name: 'Y', type: 'TEXT' },
      { name: 'Z', type: 'TEXT' }
    ],
    rowCount: 5,
    data: sampleData,
  };
  
  console.log("Posting NODE_CREATED message with test data:", nodeData);
  
  self.postMessage({
    type: 'NODE_CREATED',
    payload: {
      node: nodeData
    }
  });
  
  console.log("NODE_CREATED message posted successfully");
}

function handleExportDatabase() {
    const dbBytes = sqlite3.capi.sqlite3_js_db_export(db.pointer);
    self.postMessage({ type: 'DATABASE_EXPORTED', payload: { dbBytes } });
}

/**
 * Queries a table's metadata and posts a NODE_CREATED message to the main thread.
 */
function createAndPostNode(tableName: string, position: { x: number, y: number }) {
  console.log("createAndPostNode called with:", { tableName, position });
  
  if (!db) {
    console.error("Database not initialized in createAndPostNode");
    return;
  }

  try {
    console.log("Querying table schema...");
    const schemaRes = db.exec(`PRAGMA table_info("${tableName}");`, { rowMode: 'object' });
    console.log("Schema result:", schemaRes);
    
    console.log("Querying row count...");
    const rowCountRes = db.exec(`SELECT COUNT(*) as count FROM "${tableName}";`, { rowMode: 'object' });
    console.log("Row count result:", rowCountRes);

    const nodeData = {
      id: tableName,
      title: tableName,
      x: position.x,
      y: position.y,
      schema: schemaRes.map((col: any) => ({ name: col.name, type: col.type })),
      rowCount: rowCountRes[0].count,
    };
    
    console.log("Posting NODE_CREATED message with data:", nodeData);
    
    self.postMessage({
      type: 'NODE_CREATED',
      payload: {
        node: nodeData
      }
    });
    
    console.log("NODE_CREATED message posted successfully");
  } catch (error) {
    console.error("Error in createAndPostNode:", error);
  }
}