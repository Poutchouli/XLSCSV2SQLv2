/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import Papa from 'papaparse';

let db: any = null;
let sqlite3: any = null;

// Create a cache to store the full data of tables that are not yet in SQLite.
// The key will be the table's ID (string), and the value will be the array of all its rows.
const fullDataCache = new Map<string, Record<string, any>[]>();

async function init() {
  try {
    sqlite3 = await sqlite3InitModule();
    db = new sqlite3.oo1.DB(':memory:', 'c');
    self.postMessage({ type: 'DB_READY' });
  } catch (error) {
    console.error('Error initializing SQLite:', error);
    self.postMessage({ type: 'DB_ERROR', payload: { error: (error as Error).message } });
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
    case 'GET_DB_SCHEMA':
      handleGetDbSchema();
      break;
    case 'LIST_TABLES':
      handleListTables();
      break;
    case 'EXPORT_DATABASE':
      handleExportDatabase();
      break;
      case 'DROP_TABLE':
      handleDropTable(payload);
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
  // This 'fullData' contains ALL rows from the CSV.
  const fullData = parseResult.data as Record<string, any>[];
  
  const tableName = `${originalTableName}_${Date.now()}`;

  // **(FIX) Store the complete dataset in our worker-side cache.**
  fullDataCache.set(tableName, fullData);

  // Create the node object for the UI.
  // It only contains the first 5 rows for the preview.
  const nodeData = {
    id: tableName,
    title: tableName,
    x: dropPosition.x,
    y: dropPosition.y,
    schema: headers.map(h => ({ name: h, type: 'TEXT' })),
    rowCount: fullData.length, // The TRUE row count
    data: fullData.slice(0, 5), // The 5-row preview for the UI
    isUploadedToSQLite: false
  };
  
  self.postMessage({
    type: 'NODE_CREATED',
    payload: {
      node: nodeData
    }
  });
}

function handleCreateTestTable(payload: any) {
  const { position = { x: 100, y: 100 } } = payload;
  const tableName = `test_table_${Date.now()}`;
  
  // Generate sample data
  const sampleData: Record<string, any>[] = [];
  for (let i = 0; i < 20; i++) { // Let's generate 20 rows to test
    sampleData.push({
      ID: i + 1,
      X: (Math.random() * 100).toFixed(2),
      Y: (Math.random() * 100).toFixed(2),
    });
  }

  // **(FIX) Store the complete dataset in our worker-side cache.**
  fullDataCache.set(tableName, sampleData);
  
  const nodeData = {
    id: tableName,
    title: tableName,
    x: position.x,
    y: position.y,
    schema: [
      { name: 'ID', type: 'INTEGER' },
      { name: 'X', type: 'TEXT' },
      { name: 'Y', type: 'TEXT' }
    ],
    rowCount: sampleData.length, // The true row count
    data: sampleData.slice(0, 5), // The 5-row preview
    isUploadedToSQLite: false,
  };
  
  self.postMessage({
    type: 'NODE_CREATED',
    payload: {
      node: nodeData
    }
  });
}

function handleUploadToSQLite(payload: any) {
  const { id, schema } = payload; // We only need the ID and schema from the UI.
  
  // **(FIX) Retrieve the full dataset from our cache.**
  const fullData = fullDataCache.get(id);

  if (!db || !sqlite3) {
    self.postMessage({ type: 'UPLOAD_STATUS', payload: { success: false, message: `SQLite not ready.` }});
    return;
  }
  
  // If the data is not in our cache, something is wrong.
  if (!fullData) {
      self.postMessage({
          type: 'UPLOAD_STATUS',
          payload: {
              success: false,
              message: `Error: Data for table "${id}" not found in worker cache. Cannot upload.`
          }
      });
      return;
  }

  try {
    const tableExistsResult = db.exec({ sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?", bind: [id] });
    if (tableExistsResult.length > 0) {
      self.postMessage({ type: 'UPLOAD_STATUS', payload: { success: false, message: `Table "${id}" already exists.` }});
      return; 
    }

    const columns = schema.map((col: any) => `"${col.name}" ${col.type}`).join(', ');
    db.exec(`CREATE TABLE "${id}" (${columns})`);

    // **(FIX) Use the 'fullData' from the cache, not the limited data from the payload.**
    if (fullData.length > 0) {
      db.exec('BEGIN TRANSACTION');
      let stmt;
      try {
        const columnNames = schema.map((col: any) => `"${col.name}"`).join(', ');
        const placeholders = schema.map(() => '?').join(', ');
        const insertSql = `INSERT INTO "${id}" (${columnNames}) VALUES (${placeholders})`;
        stmt = db.prepare(insertSql);
        
        // Iterate over the complete dataset
        for (const row of fullData) {
          const values = schema.map((col: any) => row[col.name] || null);
          stmt.bind(values);
          stmt.step();
          stmt.reset();
        }
        db.exec('COMMIT');
      } catch(e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        stmt?.finalize();
        // **(FIX) Clean up the cache after successful upload.**
        fullDataCache.delete(id);
      }
    }

    const countResult = db.exec(`SELECT COUNT(*) as count FROM "${id}";`, { rowMode: 'object' });
    const actualRowCount = countResult[0]?.count || 0;

    self.postMessage({
      type: 'UPLOAD_STATUS',
      payload: {
        success: true,
        message: `Successfully uploaded "${id}" (${actualRowCount} rows) to SQLite.`,
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
        message: `Error uploading "${id}": ${(error as Error).message}`
      }
    });
  }
}

function handleExportDatabase() {
    if (!db || !sqlite3) return;
    const dbBytes = sqlite3.capi.sqlite3_js_db_export(db.pointer);
    self.postMessage({ type: 'DATABASE_EXPORTED', payload: { dbBytes } });
}

function handleGetDbSchema() {
  if (!db) {
    console.error("DB not ready for schema export");
    return;
  }
  try {
    // Get all user-created table names
    const tablesResult = db.exec({
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      rowMode: 'array'
    }).flat();

    // For each table, get its column schema
    const schema = tablesResult.map((tableName: string) => {
      const columns = db.exec(`PRAGMA table_info("${tableName}");`, { rowMode: 'object' });
      return {
        name: tableName,
        columns: columns.map((col: any) => ({ name: col.name, type: col.type }))
      };
    });

    // Send the complete schema back to the main thread
    self.postMessage({
      type: 'DB_SCHEMA_DATA',
      payload: { schema }
    });

  } catch (error) {
    console.error("Error fetching DB schema:", error);
  }
}

function handleListTables() {
  if (!db) {
    self.postMessage({ type: 'TABLE_LIST', payload: { tables: [] } });
    return;
  }
  try {
    // Query the master table for all user-created tables (names not starting with 'sqlite_')
    const result = db.exec({
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      rowMode: 'array',
    });

    // Flatten the array of arrays into a simple array of strings
    const tableNames = result.map((row: any[]) => row[0]);

    self.postMessage({
      type: 'TABLE_LIST',
      payload: { tables: tableNames }
    });
  } catch (error) {
    console.error("Error listing tables:", error);
    self.postMessage({
      type: 'UPLOAD_STATUS', // Reuse the toast for errors
      payload: {
        success: false,
        message: `Error fetching table list: ${(error as Error).message}`
      }
    });
  }
}

function handleDropTable(payload: { tableName: string }) {
  const { tableName } = payload;
  if (!db) {
    self.postMessage({ type: 'UPLOAD_STATUS', payload: { success: false, message: 'Database not ready.' } });
    return;
  }
  try {
    db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
    self.postMessage({
      type: 'UPLOAD_STATUS',
      payload: {
        success: true,
        message: `Table "${tableName}" dropped successfully.`
      }
    });
    // After dropping, immediately send the updated list of tables back
    handleListTables();
  } catch (error) {
    console.error(`Error dropping table ${tableName}:`, error);
    self.postMessage({
      type: 'UPLOAD_STATUS',
      payload: {
        success: false,
        message: `Error dropping table "${tableName}": ${(error as Error).message}`
      }
    });
  }
}