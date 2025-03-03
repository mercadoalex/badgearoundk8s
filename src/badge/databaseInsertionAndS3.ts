import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { generateBadgeFiles } from './badgeGenerator';
import { Badge } from '../types';
import fs from 'fs';
import path from 'path';

// Load the KeyCode Catalog
const keyCodeCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/keyCodeCatalog.json'), 'utf-8'));
const s3 = new S3Client({ region: 'us-west-2' });
const secretsManager = new SecretsManagerClient({ region: 'us-west-2' });
// Fetch the database credentials and RDS endpoint from AWS Secrets Manager
async function getDbCredentials() {
    const secretName = "rds_endpoint_secret";
    const command = new GetSecretValueCommand({ SecretId: secretName });
    console.log(`Fetching secret: ${secretName}`);
    try {
        const response = await secretsManager.send(command);
        if (!response.SecretString) {
            throw new Error('SecretString is empty');
        }
        console.log('Secret fetched successfully');
        const secret = JSON.parse(response.SecretString);
        const dbCredentials = {
            username: "your_db_username", // Replace with your actual DB username
            password: "your_db_password", // Replace with your actual DB password
            host: secret.rds_endpoint,
            port: 5432 // Replace with your actual DB port if different
        };
        return dbCredentials;
    } catch (error) {
        console.error('Error fetching secret:', error);
        throw error;
    }
}

// Connect to the PostgreSQL database with retry logic
async function connectWithRetry(dbCredentials: any, retries = 5, delay = 2000): Promise<Client> {
    for (let i = 0; i < retries; i++) {
        const client = new Client({
            user: dbCredentials.username,
            host: dbCredentials.host,
            database: 'badge_db',
            password: dbCredentials.password,
            port: dbCredentials.port,
        });
        try {
            await client.connect();
            console.log('Connected to PostgreSQL database successfully');
            return client;
        } catch (error) {
            if (i < retries - 1) {
                console.log(`Retrying database connection (${i + 1}/${retries})...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
    throw new Error('Failed to connect to PostgreSQL database after multiple attempts');
}

// Ensure the badges table exists in the PostgreSQL database
async function ensureBadgesTableExists(client: Client) {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS badges (
            id SERIAL PRIMARY KEY,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NOT NULL,
            issuer VARCHAR(255) NOT NULL,
            key_code VARCHAR(255) NOT NULL,
            key_description TEXT NOT NULL,
            badge_url TEXT NOT NULL,
            student_id INT NOT NULL,
            hidden_field VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            issued BOOLEAN DEFAULT FALSE
        )
    `;
    await client.query(createTableQuery);
    console.log('Ensured badges table exists');
}

// Generate a badge and return the URLs of the badge
export async function generateBadge(badgeDetails: Badge): Promise<{ badgeUrl: string, badgePngUrl: string }> {
    const { firstName, lastName, uniqueKey, email, studentId, hiddenField, issuer } = badgeDetails;

    if (!firstName || !lastName || !studentId || !hiddenField || !email || !issuer) {
        throw new Error('Missing required badge details');
    }

    try {
        console.log('Fetching database credentials');
        const dbCredentials = await getDbCredentials();
        console.log('Database credentials fetched successfully');
        console.log('Connecting to PostgreSQL database');
        const client = await connectWithRetry(dbCredentials);

        // Ensure the badges table exists
        await ensureBadgesTableExists(client);

        // Pre-validation: Check if a badge has already been issued for the given studentId
        const checkQuery = 'SELECT issued FROM badges WHERE student_id = $1';
        const checkResult = await client.query(checkQuery, [studentId]);
        if (checkResult.rows.length > 0 && checkResult.rows[0].issued) {
            await client.end();
            throw new Error(`Badge for StudentID ${studentId} was already issued`);
        }

        // Generate badge files
        const { pngFilePath, pdfFilePath } = await generateBadgeFiles(badgeDetails);

        // Upload the PNG to S3
        const uploadPngParams = {
            Bucket: 'digital-badge-bucket',
            Key: `${uniqueKey}.png`,
            Body: fs.readFileSync(pngFilePath),
            ContentType: 'image/png'
        };
        console.log('Uploading badge PNG to S3');
        await s3.send(new PutObjectCommand(uploadPngParams));
        console.log('Badge PNG uploaded to S3 successfully');

        const badgePngUrl = `https://digital-badge-bucket.s3.amazonaws.com/${uniqueKey}.png`;

        // Upload the PDF to S3
        const uploadPdfParams = {
            Bucket: 'digital-badge-bucket',
            Key: `${uniqueKey}.pdf`,
            Body: fs.readFileSync(pdfFilePath),
            ContentType: 'application/pdf'
        };
        console.log('Uploading badge PDF to S3');
        await s3.send(new PutObjectCommand(uploadPdfParams));
        console.log('Badge PDF uploaded to S3 successfully');

        const badgeUrl = `https://digital-badge-bucket.s3.amazonaws.com/${uniqueKey}.pdf`;

        // Insert the badge details into the PostgreSQL database
        const insertQuery = `
            INSERT INTO badges (first_name, last_name, issuer, key_code, key_description, badge_url, student_id, hidden_field, email, issued)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;
        const values = [firstName, lastName, issuer, uniqueKey, keyCodeCatalog[uniqueKey] || uniqueKey, badgeUrl, studentId, hiddenField, email, true];
        await client.query(insertQuery, values);
        console.log('Badge details inserted into PostgreSQL database successfully');

        // Close the database connection
        await client.end();

        return { badgeUrl, badgePngUrl };
    } catch (error) {
        console.error('Error generating badge:', error);
        throw error;
    }
}

// Test the database connection
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