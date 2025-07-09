/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import Papa from 'papaparse';

let db: any = null;
let sqlite3: any = null;

async function init() {
  try {
    // Use the default initialization - let the module handle WASM loading
    sqlite3 = await sqlite3InitModule();

    db = new sqlite3.oo1.DB(':memory:', 'c');
    
    self.postMessage({ type: 'DB_READY' });
  } catch (error) {
    console.error('Error initializing SQLite:', error);
    self.postMessage({ type: 'DB_ERROR', payload: { error: error.message } });
  }
}

init();

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'IMPORT_CSV':
      handleImportCsv(payload);
      break;
    case 'CREATE_TEST_TABLE':
      handleCreateTestTable(payload);
      break;
    case 'UPDATE_POSITION':
      // For simplicity, we don't persist position in this clean start.
      // In a real app, you would save it to a metadata table.
      break;
    case 'EXPORT_DATABASE':
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
  const { fileBuffer, tableName: originalTableName, dropPosition } = payload;
  const fileText = new TextDecoder().decode(fileBuffer);
  
  const parseResult = Papa.parse(fileText, {
      header: true,
      skipEmptyLines: true,
  });

  const headers = parseResult.meta.fields!;
  const data = parseResult.data as Record<string, any>[];
  
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
  
  self.postMessage({
    type: 'NODE_CREATED',
    payload: {
      node: nodeData
    }
  });
}

function handleCreateTestTable(payload: any) {
  // First, let's test if we can create a node without SQLite
  const { position = { x: 100, y: 100 } } = payload;
  const tableName = `test_table_${Date.now()}`;
  
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
  
  self.postMessage({
    type: 'NODE_CREATED',
    payload: {
      node: nodeData
    }
  });
}

function handleExportDatabase() {
    const dbBytes = sqlite3.capi.sqlite3_js_db_export(db.pointer);
    self.postMessage({ type: 'DATABASE_EXPORTED', payload: { dbBytes } });
}

/**
 * Queries a table's metadata and posts a NODE_CREATED message to the main thread.
 */
function createAndPostNode(tableName: string, position: { x: number, y: number }) {
  if (!db) {
    console.error("Database not initialized in createAndPostNode");
    return;
  }

  try {
    const schemaRes = db.exec(`PRAGMA table_info("${tableName}");`, { rowMode: 'object' });
    const rowCountRes = db.exec(`SELECT COUNT(*) as count FROM "${tableName}";`, { rowMode: 'object' });

    const nodeData = {
      id: tableName,
      title: tableName,
      x: position.x,
      y: position.y,
      schema: schemaRes.map((col: any) => ({ name: col.name, type: col.type })),
      rowCount: rowCountRes[0].count,
    };
    
    self.postMessage({
      type: 'NODE_CREATED',
      payload: {
        node: nodeData
      }
    });
  } catch (error) {
    console.error("Error in createAndPostNode:", error);
  }
}