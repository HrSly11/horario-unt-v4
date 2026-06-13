const { Client } = require('pg');

const connectionString = process.argv[2];
const targetDatabase = process.argv[3] || 'sistema_horarios';

async function run() {
  const adminClient = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    await adminClient.connect();

    const databaseResult = await adminClient.query({
      text: 'SELECT datname FROM pg_database WHERE datname = $1',
      values: [targetDatabase],
    });

    console.log('postgres auth=ok');
    console.log(`${targetDatabase}=${databaseResult.rowCount ? 'yes' : 'no'}`);

    if (databaseResult.rowCount === 0) {
      const databases = await adminClient.query(`
        SELECT datname
        FROM pg_database
        WHERE datistemplate = false
        ORDER BY datname
      `);
      console.log(`databases=${databases.rows.map((row) => row.datname).join(', ')}`);
      return;
    }

    const targetUrl = new URL(connectionString);
    targetUrl.pathname = `/${targetDatabase}`;
    const targetClient = new Client({
      connectionString: targetUrl.toString(),
      connectionTimeoutMillis: 5000,
    });

    try {
      await targetClient.connect();
      const tables = await targetClient.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      console.log(`tables=${tables.rows.map((row) => row.table_name).join(', ')}`);
    } finally {
      await targetClient.end().catch(() => {});
    }
  } finally {
    await adminClient.end().catch(() => {});
  }
}

run().catch((error) => {
  console.log(`error=${error.code ?? 'UNKNOWN'} ${String(error.message).split('\n')[0]}`);
  process.exitCode = 1;
});
