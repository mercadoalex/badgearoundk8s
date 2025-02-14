import { createCanvas, loadImage } from 'canvas';
import { Badge } from '../types';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-west-2' });

export async function generateBadge(badgeDetails: Badge): Promise<string> {
    const { name, issuer, uniqueKey } = badgeDetails;

    const width = 600;
    const height = 400; // Increased height to accommodate additional text
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    try {
        // Load the base image
        const baseImage = await loadImage(path.join(__dirname, '../../assets/badge.png'));
        context.drawImage(baseImage, 0, 0, width, 200); // Draw the base image at the top

        // Personalize the badge
        context.fillStyle = '#333';
        context.font = 'bold 24px Arial';
        context.fillText(name, 50, 250); // Draw the name below the image

        context.font = '18px Arial';
        context.fillText(`Issued by: ${issuer}`, 50, 300); // Draw the issuer below the name
        context.fillText(`Key: ${uniqueKey}`, 50, 350); // Draw the unique key below the issuer

        // Save the badge as a PNG file
        const buffer = canvas.toBuffer('image/png');
        const filePath = path.join(__dirname, `../../output/${uniqueKey}.png`);
        fs.writeFileSync(filePath, buffer);

        // Upload the badge to S3
        const uploadParams = {
            Bucket: 'digital-badge-bucket',
            Key: `${uniqueKey}.png`,
            Body: buffer,
            ContentType: 'image/png'
        };
        await s3.send(new PutObjectCommand(uploadParams));

        return `https://digital-badge-bucket.s3.amazonaws.com/${uniqueKey}.png`;
    } catch (error) {
        console.error('Error generating badge:', error);
        throw error;
    }
}