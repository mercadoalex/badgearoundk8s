import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Client } from 'pg';
import fs from 'fs';
import { Badge } from '../types';
import { generateBadgeFiles } from './badgeGenerator';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Initialize the Secrets Manager client
const secretsManager = new SecretsManagerClient({ region: 'us-west-2' });

// Function to get database credentials from AWS Secrets Manager
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

// Function to connect to the database with retry logic
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

// Function to insert badge data into the database
export async function insertBadgeData(badge: Badge) {
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

// Function to upload badge files to S3
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
      console.log(`Uploaded ${file.key} to S3 successfully`);
    } catch (error) {
      console.error(`Error uploading ${file.key} to S3:`, error);
      throw error;
    }
  }
}

// Function to generate a badge and return the URLs of the badge
export async function generateBadge(badgeDetails: Badge): Promise<{ badgeUrl: string, badgePngUrl: string }> {
  const { firstName, lastName, keyCode, email, studentId, hiddenField, issuer } = badgeDetails;

  if (!firstName || !lastName || !studentId || !hiddenField || !email || !issuer) {
    throw new Error('Missing required badge details');
  }

  try {
    // Generate badge files and upload them to S3
    await uploadBadgeFiles(badgeDetails);

    const badgePngUrl = `https://digital-badge-bucket.s3.amazonaws.com/${keyCode}.png`;
    const badgeUrl = `https://digital-badge-bucket.s3.amazonaws.com/${keyCode}.pdf`;

    console.log('Badge generated successfully');
    return { badgeUrl, badgePngUrl };
  } catch (error) {
    console.error('Error generating badge:', error);
    throw error;
  }
}

// Function to test the database connection
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

// Call the test function
testDbConnection();