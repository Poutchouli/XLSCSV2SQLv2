/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import Papa from 'papaparse';

let db: any = null;
let sqlite3: any = null;

async function init() {
  try {
    console.log("Initializing SQLite3 module...");
    
    // Use the default initialization - let the module handle WASM loading
    sqlite3 = await sqlite3InitModule();
    console.log("SQLite3 module loaded:", sqlite3);

    db = new sqlite3.oo1.DB(':memory:', 'c');
    console.log("In-memory database created.");
    
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
    case 'EXPORT_TABLE_CSV':
      handleExportCsv(payload);
      break;
    case 'EXPORT_DATABASE':
      handleExportDatabase();
      break;
  }
};

function handleImportCsv(payload: any) {
  const { fileBuffer, tableName, dropPosition } = payload;
  const fileText = new TextDecoder().decode(fileBuffer);
  
  const parseResult = Papa.parse(fileText, {
      header: true,
      skipEmptyLines: true,
  });

  const headers = parseResult.meta.fields!;
  const data = parseResult.data as Record<string, any>[];
  
  db.exec(`DROP TABLE IF EXISTS "${tableName}";`);
  const createTableSql = `CREATE TABLE "${tableName}" (${headers.map(h => `"${h}" TEXT`).join(', ')});`;
  db.exec(createTableSql);

  // Insert data using exec instead of prepared statements
  data.forEach(row => {
    const values = headers.map(h => `'${(row[h] || '').toString().replace(/'/g, "''")}'`).join(', ');
    const insertSql = `INSERT INTO "${tableName}" VALUES (${values});`;
    db.exec(insertSql);
  });

  const schemaRes = db.exec(`PRAGMA table_info("${tableName}");`, { rowMode: 'object' });
  const rowCountRes = db.exec(`SELECT COUNT(*) as count FROM "${tableName}";`, { rowMode: 'object' });
  
  self.postMessage({
    type: 'NODE_CREATED',
    payload: {
      node: {
        id: tableName,
        title: tableName,
        x: dropPosition.x,
        y: dropPosition.y,
        schema: schemaRes.map(col => ({ name: col.name, type: col.type })),
        rowCount: rowCountRes[0].count,
      }
    }
  });
}

function handleExportCsv(payload: any) {
    const { tableName } = payload;
    const rows = db.exec(`SELECT * FROM "${tableName}";`, { rowMode: 'object' });
    const csvString = Papa.unparse(rows);
    self.postMessage({ type: 'CSV_EXPORTED', payload: { csvString, tableName } });
}

function handleExportDatabase() {
    const dbBytes = sqlite3.capi.sqlite3_js_db_export(db.pointer);
    self.postMessage({ type: 'DATABASE_EXPORTED', payload: { dbBytes } });
}

function handleCreateTestTable(payload: any) {
  const { position = { x: 100, y: 100 } } = payload;
  const tableName = `test_table_${Date.now()}`;
  
  // Create table with X, Y, Z fields
  db.exec(`DROP TABLE IF EXISTS "${tableName}";`);
  const createTableSql = `CREATE TABLE "${tableName}" (
    "X" TEXT,
    "Y" TEXT,
    "Z" TEXT
  );`;
  db.exec(createTableSql);

  // Insert random data using exec instead of prepared statements
  for (let i = 0; i < 5; i++) {
    const xValue = (Math.random() * 100).toFixed(2);
    const yValue = (Math.random() * 100).toFixed(2);
    const zValue = (Math.random() * 100).toFixed(2);
    
    const insertSql = `INSERT INTO "${tableName}" VALUES ('${xValue}', '${yValue}', '${zValue}');`;
    db.exec(insertSql);
  }

  const schemaRes = db.exec(`PRAGMA table_info("${tableName}");`, { rowMode: 'object' });
  const rowCountRes = db.exec(`SELECT COUNT(*) as count FROM "${tableName}";`, { rowMode: 'object' });
  
  self.postMessage({
    type: 'NODE_CREATED',
    payload: {
      node: {
        id: tableName,
        title: tableName,
        x: position.x,
        y: position.y,
        schema: schemaRes.map(col => ({ name: col.name, type: col.type })),
        rowCount: rowCountRes[0].count,
      }
    }
  });
}