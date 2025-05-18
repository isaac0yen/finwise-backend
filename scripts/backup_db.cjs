const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const dotenv = require('dotenv'); dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
};

// Helper functions
const getTables = async (connection) => {
  const [tables] = await connection.query('SHOW TABLES');
  return tables.map(table => Object.values(table)[0]);
};

const getTableSchema = async (connection, tableName) => {
  const [columns] = await connection.query(`DESCRIBE ${tableName}`);
  const [foreignKeys] = await connection.query(`
    SELECT 
      COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM 
      INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE 
      TABLE_SCHEMA = ? AND
      TABLE_NAME = ? AND
      REFERENCED_TABLE_NAME IS NOT NULL
  `, [dbConfig.database, tableName]);

  return { columns, foreignKeys };
};

const generateSchemaSQL = (backup) => {
  return Object.entries(backup.schema).map(([table, columns]) => {
    const columnDefs = columns.map(col =>
      `${col.Field} ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}` +
      `${col.Default ? ` DEFAULT '${col.Default}'` : ''} ${col.Extra}`.trim()
    );

    const fkDefs = backup.relationships[table].map(fk =>
      `FOREIGN KEY (${fk.COLUMN_NAME}) REFERENCES ${fk.REFERENCED_TABLE_NAME}(${fk.REFERENCED_COLUMN_NAME})`
    );

    return `CREATE TABLE ${table} (\n  ${[...columnDefs, ...fkDefs].join(',\n  ')}\n);`;
  }).join('\n\n');
};

const generateTablesOnlySQL = (backup) => {
  return Object.entries(backup.schema).map(([table, columns]) => {
    const columnDefs = columns.map(col =>
      `${col.Field} ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}` +
      `${col.Default ? ` DEFAULT '${col.Default}'` : ''} ${col.Extra}`.trim()
    );
    return `CREATE TABLE ${table} (\n  ${columnDefs.join(',\n  ')}\n);`;
  }).join('\n\n');
};

// Main functions

const backupDatabase = async () => {
  const connection = await mysql.createConnection(dbConfig);
  const tables = await getTables(connection);

  const backup = { schema: {}, data: {}, relationships: {} };

  for (const table of tables) {
    const { columns, foreignKeys } = await getTableSchema(connection, table);
    const [rows] = await connection.query(`SELECT * FROM ${table}`);

    backup.schema[table] = columns;
    backup.data[table] = rows;
    backup.relationships[table] = foreignKeys;
  }

  await Promise.all([
    fs.writeFile('backup_full.json', JSON.stringify(backup, null, 2)),
    fs.writeFile('backup_schema.sql', generateSchemaSQL(backup)),
    fs.writeFile('backup_tables.sql', generateTablesOnlySQL(backup))
  ]);

  await connection.end();
};


const restoreDatabase = async (backupFile = 'backup_full.json') => {
  console.log('Starting database restoration...');
  const connection = await mysql.createConnection(dbConfig);
  console.log('Connected to database');

  console.log('Reading backup file...');
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'));
  console.log('Backup file loaded successfully');

  // Define table order based on dependencies
  const tableOrder = [
    'category',
    'newsletter',
    'login_codes',
    'user',
    'ai_account',
    'feed_config',
    'feedback',
    'finished_quiz',
    'followed_by',
    'follows',
    'form',
    'pdf_file',
    'quiz',
    'form_result',
    'quiz_result',
    'cron_feed',
    'subject',
    'topic'
  ];

  for (const table of tableOrder) {
    const rows = backup.data[table];
    if (!rows || rows.length === 0) {
      console.log(`Skipping empty table: ${table}`);
      continue;
    }

    console.log(`Restoring data for table: ${table}`);
    const columns = Object.keys(rows[0]);
    const values = rows.map(row => columns.map(col => row[col]));
    await connection.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ?`, [values]);
    console.log(`Successfully restored ${rows.length} rows to table: ${table}`);
  }

  console.log('Closing database connection...');
  await connection.end();
  console.log('Database restoration completed successfully');
};

restoreDatabase();