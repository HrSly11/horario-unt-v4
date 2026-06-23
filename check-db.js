import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });

async function main() {
  const result = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'cursos'
    ORDER BY ordinal_position;
  `);
  console.log('Columns in cursos table:', result.rows);
  
  // Also check the migrations table
  const migrations = await pool.query(`
    SELECT migration_name, applied_at 
    FROM _prisma_migrations 
    ORDER BY applied_at;
  `);
  console.log('Applied migrations:', migrations.rows);
}

main().then(() => pool.end()).catch(console.error);