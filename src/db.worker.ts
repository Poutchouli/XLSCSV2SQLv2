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
    case 'UPLOAD_TO_SQLITE':
      handleUploadToSQLite(payload);
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

function handleUploadToSQLite(payload: any) {
  const { id, schema, data, rowCount } = payload; // Use 'id' from payload
  
  if (!db || !sqlite3) {
    // If SQLite is not initialized, show a message
    self.postMessage({
      type: 'UPLOAD_STATUS',
      payload: {
        success: false,
        message: `SQLite database not initialized. Currently using dummy data mode.`
      }
    });
    return;
  }

  try {
    // Check if table already exists
    const tableExistsResult = db.exec({
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?", 
      bind: [id]
    });
    const tableExists = tableExistsResult.length > 0;
    
    if (tableExists) {
      // If table exists, show a message offering to replace it
      self.postMessage({
        type: 'UPLOAD_STATUS',
        payload: {
          success: false,
          message: `Table "${id}" already exists in SQLite database`
        }
      });
      return; 
    }

    // Create table with proper schema
    const columns = schema.map((col: any) => `"${col.name}" ${col.type}`).join(', ');
    const createTableSql = `CREATE TABLE "${id}" (${columns})`;
    
    db.exec(createTableSql);

    // Use a transaction for atomic and performant inserts.
    if (data && data.length > 0) {
      db.exec('BEGIN TRANSACTION');
      let stmt;
      try {
        const columnNames = schema.map((col: any) => `"${col.name}"`).join(', ');
        const placeholders = schema.map(() => '?').join(', ');
        const insertSql = `INSERT INTO "${id}" (${columnNames}) VALUES (${placeholders})`;
        stmt = db.prepare(insertSql);
        for (const row of data) {
          const values = schema.map((col: any) => row[col.name] || null);
          // The sqlite-wasm oo1 API uses a bind/step/reset sequence for prepared statements.
          stmt.bind(values);
          stmt.step();
          stmt.reset();
        }
        db.exec('COMMIT');
      } catch(e) {
        db.exec('ROLLBACK');
        throw e; // Re-throw the error to be caught by the outer try-catch
      } finally {
        stmt?.finalize();
      }
    }

    // Get the actual row count from SQLite
    const countResult = db.exec(`SELECT COUNT(*) as count FROM "${id}";`, { rowMode: 'object' });
    const actualRowCount = countResult[0]?.count || 0;

    // Send success message
    self.postMessage({
      type: 'UPLOAD_STATUS',
      payload: {
        success: true,
        message: `Successfully uploaded "${id}" to SQLite database with ${actualRowCount} rows`,
        tableName: id,
        actualRowCount: actualRowCount
      }
    });

  } catch (error) {
    console.error("Error uploading to SQLite:", error);
    self.postMessage({
      type: 'UPLOAD_STATUS',
      payload: {
        success: false,
        message: `Error uploading "${id}": ${error.message}`
      }
    });
  }
}

function handleExportDatabase() {
    const dbBytes = sqlite3.capi.sqlite3_js_db_export(db.pointer);
    self.postMessage({ type: 'DATABASE_EXPORTED', payload: { dbBytes } });
}