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
    case 'EXPORT_TABLE_CSV':
      console.log("Handling CSV export...");
      handleExportCsv(payload);
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
  const { fileBuffer, tableName: originalTableName, dropPosition } = payload;
  const fileText = new TextDecoder().decode(fileBuffer);
  
  const parseResult = Papa.parse(fileText, {
      header: true,
      skipEmptyLines: true,
  });

  const headers = parseResult.meta.fields!;
  const data = parseResult.data as Record<string, any>[];
  
  // Get unique table name
  const tableName = getUniqueTableName(originalTableName);
  
  db.exec(`DROP TABLE IF EXISTS "${tableName}";`);
  const createTableSql = `CREATE TABLE "${tableName}" (${headers.map(h => `"${h}" TEXT`).join(', ')});`;
  db.exec(createTableSql);

  // Use a transaction for performance and prepared statements for security.
  try {
    db.exec('BEGIN TRANSACTION;');
    const placeholders = headers.map(() => '?').join(',');
    const insertSql = `INSERT INTO "${tableName}" (${headers.map(h => `"${h}"`).join(',')}) VALUES (${placeholders});`;
    
    data.forEach(row => {
        const values = headers.map(h => row[h] || null); // Use null for missing values
        db.exec({ sql: insertSql, bind: values });
    });

    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    console.error('Error during bulk insert, transaction rolled back:', error);
    // Optionally, post an error message back to the main thread
    return;
  }

  // Create and post the node object back to the main thread
  createAndPostNode(tableName, dropPosition);
}

function handleExportCsv(payload: any) {
    const { tableName } = payload;
    const rows = db.exec(`SELECT * FROM "${tableName}";`, { rowMode: 'object' });
    const csvString = Papa.unparse(rows);
    self.postMessage({ type: 'CSV_EXPORTED', payload: { csvString, tableName } });
}

function handleCreateTestTable(payload: any) {
  console.log("handleCreateTestTable called with payload:", payload);
  
  // First, let's test if we can create a node without SQLite
  const { position = { x: 100, y: 100 } } = payload;
  const tableName = `test_table_${Date.now()}`;
  
  console.log("Creating test node without SQLite...");
  
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