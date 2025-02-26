import { createCanvas, loadImage, CanvasRenderingContext2D as CanvasContext } from 'canvas';
import { Badge } from '../types';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Load the KeyCode Catalog
const keyCodeCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/keyCodeCatalog.json'), 'utf-8'));

const s3 = new S3Client({ region: 'us-west-2' });
const secretsManager = new SecretsManagerClient({ region: 'us-west-2' });

async function getDbCredentials() {
    const secretName = "dev/postgresql";
    const command = new GetSecretValueCommand({ SecretId: secretName });
    console.log(`Fetching secret: ${secretName}`);
    try {
        const response = await secretsManager.send(command);
        if (!response.SecretString) {
            throw new Error('SecretString is empty');
        }
        console.log('Secret fetched successfully');
        return JSON.parse(response.SecretString);
    } catch (error) {
        console.error('Error fetching secret:', error);
        throw error;
    }
}

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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await client.query(createTableQuery);
    console.log('Ensured badges table exists');
}

export async function generateBadge(badgeDetails: Badge): Promise<string> {
    const { firstName, lastName, uniqueKey, email, studentId, hiddenField, issuer } = badgeDetails;

    if (!firstName || !lastName || !studentId || !hiddenField || !email || !issuer) {
        throw new Error('Missing required badge details');
    }

    const width = 300; // Reduced width by half
    const height = 200; // Reduced height by half
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d') as CanvasContext;

    try {
        console.log('Loading base image');
        // Load the base image
        const baseImage = await loadImage(path.join(__dirname, '../../assets/badge.png'));

        // Calculate the aspect ratio of the base image
        const aspectRatio = baseImage.width / baseImage.height;
        const imageWidth = width;
        const imageHeight = width / aspectRatio;

        // Draw the base image on the canvas
        context.drawImage(baseImage, 0, 0, imageWidth, imageHeight); // Draw the base image with calculated dimensions

        // Personalize the badge
        context.fillStyle = '#333';
        context.font = 'bold 12px Arial'; // Reduced font size by half
        context.fillText(`${firstName} ${lastName}`, 25, imageHeight + 25); // Draw the name below the image

        context.font = '9px Arial'; // Reduced font size by half
        context.fillText(`Issued by: ${issuer}`, 25, imageHeight + 50); // Draw the issuer below the name
        context.fillText(`Key: ${uniqueKey}`, 25, imageHeight + 75); // Draw the unique key below the issuer

        // Function to split text into multiple lines based on the width of the canvas
        function wrapText(context: CanvasContext, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
            const words = text.split(' ');
            let line = '';
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = context.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    context.fillText(line, x, y);
                    line = words[n] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            context.fillText(line, x, y);
        }

        // Draw the text above the base image
        context.font = '6px Arial, OpenSans'; // Reduced font size by half
        wrapText(context, `${firstName} ${lastName}`, 5, 15, width - 10, 7.5); // Add first name and last name
        wrapText(context, 'Successfully completed the training:', 5, 25, width - 10, 7.5);
        wrapText(context, keyCodeCatalog[uniqueKey] || uniqueKey, 5, 32.5, width - 10, 7.5);

        // Ensure the output directory exists
        const outputDir = path.join(__dirname, '../../output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save the badge as a PNG file
        const buffer = canvas.toBuffer('image/png');
        const filePath = path.join(outputDir, `${uniqueKey}.png`);
        fs.writeFileSync(filePath, buffer);

        // Upload the badge to S3
        const uploadParams = {
            Bucket: 'digital-badge-bucket',
            Key: `${uniqueKey}.png`,
            Body: buffer,
            ContentType: 'image/png'
        };
        console.log('Uploading badge to S3');
        await s3.send(new PutObjectCommand(uploadParams));
        console.log('Badge uploaded to S3 successfully');

        const badgeUrl = `https://digital-badge-bucket.s3.amazonaws.com/${uniqueKey}.png`;

        // Insert the badge details into the PostgreSQL database
        console.log('Fetching database credentials');
        const dbCredentials = await getDbCredentials();
        console.log('Database credentials fetched successfully');
        console.log('Connecting to PostgreSQL database');
        const client = await connectWithRetry(dbCredentials);

        // Ensure the badges table exists
        await ensureBadgesTableExists(client);

        const insertQuery = `
            INSERT INTO badges (first_name, last_name, issuer, key_code, key_description, badge_url, student_id, hidden_field, email)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        const values = [firstName, lastName, issuer, uniqueKey, keyCodeCatalog[uniqueKey] || uniqueKey, badgeUrl, studentId, hiddenField, email];
        await client.query(insertQuery, values);
        console.log('Badge details inserted into PostgreSQL database successfully');

        // Close the database connection
        await client.end();

        return badgeUrl;
    } catch (error) {
        console.error('Error generating badge:', error);
        throw error;
    }
}