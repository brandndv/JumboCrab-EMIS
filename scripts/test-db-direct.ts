import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();
  
  try {
    console.log('Testing database connection...');
    
    // Test connection
    const res = await client.query('SELECT version()');
    console.log('Database version:', res.rows[0].version);
    
    // Check if employees table exists
    const tableCheck = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Employee')"
    );
    
    console.log('Employee table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Count employees
      const countResult = await client.query('SELECT COUNT(*) FROM "Employee"');
      console.log(`Found ${countResult.rows[0].count} employees`);
      
      // Get sample data
      const sample = await client.query('SELECT * FROM "Employee" LIMIT 1');
      if (sample.rows.length > 0) {
        console.log('Sample employee:', sample.rows[0]);
      }
    }
    
  } catch (error) {
    console.error('Error testing database connection:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testConnection().catch(console.error);
