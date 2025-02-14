import { createCanvas, loadImage, registerFont } from 'canvas';
import { Badge } from '../types';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

export async function generateBadge(badgeDetails: Badge): Promise<string> {
    const { name, issuer, uniqueKey } = badgeDetails;

    try {
        // Load the base image
        const baseImage = await loadImage(path.join(__dirname, '../../assets/badge.png'));
        const width = baseImage.width;
        const height = baseImage.height + 200; // Increased height to accommodate additional text

        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');

        context.drawImage(baseImage, 0, 0, width, baseImage.height); // Draw the base image at its original size

        // Personalize the badge
        context.fillStyle = '#333';
        context.font = 'bold 24px Arial, OpenSans'; // Use Arial with fallback to OpenSans
        context.fillText(name, 50, baseImage.height + 50); // Draw the name below the image

        context.font = '18px Arial, OpenSans'; // Use Arial with fallback to OpenSans
        context.fillText(`Issued by: ${issuer}`, 50, baseImage.height + 100); // Draw the issuer below the name
        context.fillText(`Key: ${uniqueKey}`, 50, baseImage.height + 150); // Draw the unique key below the issuer

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

        return `https://digital-badge-bucket.s3.amazonaws.com/${fileName}`;
    } catch (error) {
        console.error('Error generating badge:', error);
        throw error;
    }
}