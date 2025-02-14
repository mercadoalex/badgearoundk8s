import { createCanvas, loadImage, registerFont } from 'canvas';
import { Badge } from '../types';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Load the KeyCode Catalog
const keyCodeCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/keyCodeCatalog.json'), 'utf-8'));

// Register the custom font and fallback font
try {
    registerFont(path.join(__dirname, '../../assets/fonts/Arial.ttf'), { family: 'Arial' });
    console.log('Arial font registered successfully.');
} catch (error) {
    console.error('Error registering Arial font:', error);
    try {
        registerFont(path.join(__dirname, '../../assets/fonts/OpenSans-Regular.ttf'), { family: 'OpenSans' });
        console.log('OpenSans font registered successfully.');
    } catch (fallbackError) {
        console.error('Error registering fallback font:', fallbackError);
    }
}

const s3 = new S3Client({ region: 'us-west-2' });

/**
 * Generates a badge with the provided details and uploads it to S3.
 * @param badgeDetails - The details of the badge to be generated.
 * @returns The URL of the uploaded badge.
 */
export async function generateBadge(badgeDetails: Badge): Promise<string> {
    const { name, issuer, uniqueKey } = badgeDetails;

    try {
        // Load the base image
        const baseImage = await loadImage(path.join(__dirname, '../../assets/badge.png'));
        const width = baseImage.width;
        const height = baseImage.height + 50; // Increased height to accommodate additional text

        // Create a canvas with the dimensions of the base image
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');

        // Draw the base image on the canvas
        context.drawImage(baseImage, 0, 0, width, baseImage.height);

        // Set the fill color for the text
        context.fillStyle = '#333';

        // Draw the name below the image
        context.font = 'bold 14px Arial, OpenSans'; // Use Arial with fallback to OpenSans
        context.fillText(name, 10, baseImage.height + 0);

        // Draw the issuer below the name
        context.font = '8px Arial, OpenSans'; // Use Arial with fallback to OpenSans
        context.fillText(`Issued by: ${issuer}`, 10, baseImage.height + 10);

        // Get the description from the catalog or use the uniqueKey if not found
        const keyDescription = keyCodeCatalog[uniqueKey] || uniqueKey;

        // Draw the unique key or its description below the issuer
        context.font = '12px Arial, OpenSans'; // Use Arial with fallback to OpenSans
        const lines = [`Successfully completed the training:`, keyDescription];
        lines.forEach((line, index) => {
            context.fillText(line, 10, baseImage.height + 25 + (index * 15));
        });

        // Ensure the output directory exists
        const outputDir = path.join(__dirname, '../../output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save the badge as a PNG file
        const buffer = canvas.toBuffer('image/png');
        const fileName = `${name.replace(/\s+/g, '_')}_${issuer}.png`;
        const filePath = path.join(outputDir, fileName);
        fs.writeFileSync(filePath, buffer);

        // Upload the badge to S3
        const uploadParams = {
            Bucket: 'digital-badge-bucket',
            Key: fileName,
            Body: buffer,
            ContentType: 'image/png'
        };
        await s3.send(new PutObjectCommand(uploadParams));

        // Return the URL of the uploaded badge
        return `https://digital-badge-bucket.s3.amazonaws.com/${fileName}`;
    } catch (error) {
        console.error('Error generating badge:', error);
        throw error;
    }
}