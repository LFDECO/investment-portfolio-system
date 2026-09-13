const mysql = require('mysql2/promise');
const fs = require('fs');

async function main() {
  const conn = await mysql.createConnection('mysql://root:deco@localhost:3306/portfolio_management');
  const [tables] = await conn.execute('SHOW TABLES');
  let schemaDump = '-- Portfolio.Ai Current MySQL Schema Dump\n\n';
  let dataDump = '-- Portfolio.Ai Current MySQL Data Dump\n\n';

  for (const row of tables) {
    const tableName = Object.values(row)[0];
    const [createRows] = await conn.execute(`SHOW CREATE TABLE \`${tableName}\``);
    schemaDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n` + createRows[0]['Create Table'] + ';\n\n';

    const [rows] = await conn.execute(`SELECT * FROM \`${tableName}\``);
    if (rows.length > 0) {
      for (const r of rows) {
        const keys = Object.keys(r).map(k => `\`${k}\``).join(', ');
        const values = Object.values(r).map(v => {
          if (v === null) return 'NULL';
          if (typeof v === 'number') return v;
          if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        dataDump += `INSERT INTO \`${tableName}\` (${keys}) VALUES (${values});\n`;
      }
      dataDump += '\n';
    }
  }

  fs.writeFileSync('db_schema_current.sql', schemaDump);
  fs.writeFileSync('db_data_current.sql', dataDump);
  console.log('Successfully exported db_schema_current.sql and db_data_current.sql');
  await conn.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
