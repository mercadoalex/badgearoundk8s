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

export async function generateBadge(badgeDetails: Badge): Promise<string> {
    const { firstName, lastName, keyCode, email, studentId, hiddenField, issuer } = badgeDetails;

    if (!firstName || !lastName || !studentId || !hiddenField || !email || !issuer) {
        throw new Error('Missing required badge details');
    }

    const width = 600;
    const height = 400; // Increased height to accommodate additional text
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d') as CanvasContext;

    try {
        console.log('Loading base image');
        // Load the base image
        const baseImage = await loadImage(path.join(__dirname, '../../assets/badge.png'));
        context.drawImage(baseImage, 0, 0, width, 200); // Draw the base image at the top

        // Personalize the badge
        context.fillStyle = '#333';
        context.font = 'bold 24px Arial';
        context.fillText(`${firstName} ${lastName}`, 50, 250); // Draw the name below the image

        context.font = '18px Arial';
        context.fillText(`Issued by: ${issuer}`, 50, 300); // Draw the issuer below the name
        context.fillText(`Key: ${keyCode}`, 50, 350); // Draw the unique key below the issuer

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
        context.font = '12px Arial, OpenSans'; // Use Arial with fallback to OpenSans
        wrapText(context, 'Successfully completed the training:', 10, 50, width - 20, 15);
        wrapText(context, keyCodeCatalog[keyCode] || keyCode, 10, 65, width - 20, 15);

        // Draw the base image on the canvas
        context.drawImage(baseImage, 0, 80, width, baseImage.height);

        // Ensure the output directory exists
        const outputDir = path.join(__dirname, '../../output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save the badge as a PNG file
        const buffer = canvas.toBuffer('image/png');
        const filePath = path.join(outputDir, `${keyCode}.png`);
        fs.writeFileSync(filePath, buffer);

        // Upload the badge to S3
        const uploadParams = {
            Bucket: 'digital-badge-bucket',
            Key: `${keyCode}.png`,
            Body: buffer,
            ContentType: 'image/png'
        };
        console.log('Uploading badge to S3');
        await s3.send(new PutObjectCommand(uploadParams));
        console.log('Badge uploaded to S3 successfully');

        const badgeUrl = `https://digital-badge-bucket.s3.amazonaws.com/${keyCode}.png`;

        // Insert the badge details into the PostgreSQL database
        console.log('Fetching database credentials');
        const dbCredentials = await getDbCredentials();
        console.log('Database credentials fetched successfully');
        const client = new Client({
            user: dbCredentials.username,
            host: dbCredentials.host,
            database: 'badge_db',
            password: dbCredentials.password,
            port: dbCredentials.port,
        });
        console.log('Connecting to PostgreSQL database');
        await client.connect();
        console.log('Connected to PostgreSQL database successfully');
        const insertQuery = `
            INSERT INTO badges (first_name, last_name, issuer, key_code, key_description, badge_url, student_id, hidden_field, email)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        const values = [firstName, lastName, issuer, keyCode, keyCodeCatalog[keyCode] || keyCode, badgeUrl, studentId, hiddenField, email];
        await client.query(insertQuery, values);
        console.log('Badge details inserted into PostgreSQL database successfully');
        await client.end();

        return badgeUrl;
    } catch (error) {
        console.error('Error generating badge:', error);
        throw error;
    }
}