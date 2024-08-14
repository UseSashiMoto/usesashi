import { Client } from 'pg';

interface SashiConfig {
  key: string;
  value: string;
  accountid: string;
}

const seedData: SashiConfig[] = [
  { key: 'config1', value: 'value1', accountid: 'account1' },
  { key: 'config2', value: 'value2', accountid: 'account2' },
  { key: 'config3', value: 'value3', accountid: 'account3' },
  {key: 'config4', value: 'value4', accountid: 'test_account_id_header'},
  {key: 'config5', value: 'value5', accountid: 'test_account_id_header'},
  {key: 'config5', value: 'value5', accountid: 'test_account_id_header'}

];


const client = new Client({
  connectionString: process.env.DATABASE_URL,
});


async function dropTableIfExists() {
    const dropTableQuery = `
      DROP TABLE IF EXISTS sashi_configs;
    `;
    await client.query(dropTableQuery);
  }

async function createTableIfNotExists() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS sashi_configs (
      key VARCHAR(255) NOT NULL,
      value TEXT NOT NULL,
      accountid VARCHAR(255) NOT NULL,
      PRIMARY KEY (key, accountid),
      UNIQUE (key, accountid)
    );
  `;
  await client.query(createTableQuery);
}

async function seedDatabase() {
  try {
    await client.connect();
    console.log('Connected to the database');

    // Drop the table if it exists
    //await dropTableIfExists();
    //console.log('Dropped table if it existed');

    await createTableIfNotExists();
    console.log('Checked for table existence and created if not exists');

    for (const config of seedData) {
      const { key, value, accountid } = config;
      const query = `
        INSERT INTO sashi_configs (key, value, accountid)
        VALUES ($1, $2, $3)
        ON CONFLICT (key, accountid) DO NOTHING;
      `;
      await client.query(query, [key, value, accountid]);
      console.log(`Inserted config: ${key}`);
    }

    console.log('Seeding completed');
  } catch (err) {
    console.error('Error seeding the database', err);
  } finally {
    await client.end();
    console.log('Disconnected from the database');
  }
}

seedDatabase();