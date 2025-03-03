import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { Badge } from '../types';
import { generateBadgeFiles } from './badgeGenerator';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({ region: 'us-west-2' });

const keyCodeCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/keyCodeCatalog.json'), 'utf-8'));

async function getDbCredentials() {
  const secretName = "dev/postgresql";
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await secretsManager.send(command);
  if (!response.SecretString) {
    throw new Error('SecretString is empty');
  }
  return JSON.parse(response.SecretString);
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

export async function insertBadgeData(badge: Badge) {
  const dbCredentials = await getDbCredentials();
  const client = await connectWithRetry(dbCredentials);

  try {
    const query = `
      INSERT INTO badges (first_name, last_name, issuer, key_code, key_description, badge_url, student_id, hidden_field, email, issued)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    const values = [
      badge.firstName,
      badge.lastName,
      badge.issuer,
      badge.keyCode,
      badge.keyDescription,
      badge.badgeUrl,
      badge.studentId,
      badge.hiddenField,
      badge.email,
      badge.issued,
    ];

    await client.query(query, values);
  } catch (error) {
    console.error('Error inserting badge data:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// FUNCTION TO UPLOAD BADGE FILES TO S3
export async function uploadBadgeFiles(badge: Badge) {
  const s3Client = new S3Client({ region: 'us-west-2' });
  const { pngFilePath, pdfFilePath } = await generateBadgeFiles(badge); // Await the Promise before destructuring

  const files = [
    { key: `${badge.keyCode}.png`, body: fs.readFileSync(pngFilePath), contentType: 'image/png' },
    { key: `${badge.keyCode}.pdf`, body: fs.readFileSync(pdfFilePath), contentType: 'application/pdf' }
  ];

  for (const file of files) {
    const command = new PutObjectCommand({
      Bucket: 'digital-badge-bucket',
      Key: file.key,
      Body: file.body,
      ContentType: file.contentType,
    });

    try {
      await s3Client.send(command);
    } catch (error) {
      console.error('Error uploading badge file to S3:', error);
      throw error;
    }
  }
}

// FUNCTION TO GENERATE A BADGE AND RETURN THE URLs OF THE BADGE
export async function generateBadge(badgeDetails: Badge): Promise<{ badgeUrl: string, badgePngUrl: string }> {
  const { firstName, lastName, keyCode, email, studentId, hiddenField, issuer } = badgeDetails;

  if (!firstName || !lastName || !studentId || !hiddenField || !email || !issuer) {
    throw new Error('Missing required badge details');
  }

  try {
    // Generate badge files and upload them to S3
    await uploadBadgeFiles(badgeDetails);

    const badgePngUrl = `https://digital-badge-bucket.s3.amazonaws.com/${uniqueKey}.png`;
    const badgeUrl = `https://digital-badge-bucket.s3.amazonaws.com/${uniqueKey}.pdf`;

    return { badgeUrl, badgePngUrl };
  } catch (error) {
    console.error('Error generating badge:', error);
    throw error;
  }
}

// FUNCTION TO TEST THE DATABASE CONNECTION
async function testDbConnection() {
  try {
    console.log('Starting database connection test');
    const dbCredentials = await getDbCredentials();
    console.log('Database credentials:', dbCredentials);
    const client = await connectWithRetry(dbCredentials);
    const res = await client.query('SELECT NOW()');
    console.log('Database connection test successful:', res.rows[0]);
    await client.end();
  } catch (error) {
    console.error('Error testing database connection:', error);
  }
}

// CALL THE TEST FUNCTION
testDbConnection();