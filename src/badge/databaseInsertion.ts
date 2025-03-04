import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({ region: 'us-west-2' });

async function getDbCredentials() {
  const client = new SecretsManagerClient({ region: "us-west-2" });
  let command = new GetSecretValueCommand({ SecretId: "rds_endpoint_secret" });

  try {
    const response: any = await client.send(command);
    console.log('Fetched rds_endpoint_secret successfully');
    const credentials = JSON.parse(response.SecretString);
    if (!credentials.username || !credentials.host || !credentials.password || !credentials.port) {
      throw new Error('Missing required database credentials');
    }
    return credentials;
  } catch (error) {
    console.error('Error fetching rds_endpoint_secret:', error);
    console.log('Falling back to dev/postgresql secret');
    command = new GetSecretValueCommand({ SecretId: "dev/postgresql" });
    const response: any = await client.send(command);
    console.log('Fetched dev/postgresql successfully');
    const credentials = JSON.parse(response.SecretString);
    if (!credentials.username || !credentials.host || !credentials.password || !credentials.port) {
      throw new Error('Missing required database credentials');
    }
    return credentials;
  }
}

async function connectWithRetry(dbCredentials: any, retries = 5, delay = 2000): Promise<Client> {
  const client = new Client({
    user: dbCredentials.username,
    host: dbCredentials.host,
    database: 'badge_db',
    password: dbCredentials.password,
    port: dbCredentials.port,
  });

  for (let i = 0; i < retries; i++) {
    try {
      await client.connect();
      console.log('Database connection successful');
      return client;
    } catch (error) {
      console.error(`Database connection attempt ${i + 1} failed:`, error);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw new Error('Failed to connect to the database after multiple attempts');
      }
    }
  }
  throw new Error('Failed to connect to the database');
}

export async function insertBadgeData(badge: any) {
  const dbCredentials = await getDbCredentials();
  const client = await connectWithRetry(dbCredentials);

  try {
    const query = `
      INSERT INTO badges (first_name, last_name, issuer, key_code, key_description, badge_url, student_id, hidden_field, email, issued)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    const values = [
      badge.firstName ?? '',
      badge.lastName ?? '',
      badge.issuer ?? '',
      badge.keyCode ?? '',
      badge.keyDescription ?? '',
      badge.badgeUrl ?? '',
      badge.studentId ?? '',
      badge.hiddenField ?? '',
      badge.email ?? '',
      badge.issued ?? false,
    ];

    await client.query(query, values);
    console.log('Badge data inserted successfully');
  } catch (error) {
    console.error('Error inserting badge data:', error);
    throw error;
  } finally {
    await client.end();
  }
}