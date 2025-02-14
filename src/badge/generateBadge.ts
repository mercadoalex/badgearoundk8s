import { createCanvas, loadImage } from 'canvas';
import { Badge } from '../types';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';

const s3 = new AWS.S3();

export async function generateBadge(badgeDetails: Badge): Promise<string> {
    const { name, issuer, uniqueKey } = badgeDetails;

    const width = 600;
    const height = 200;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    // Load the base image
    const baseImage = await loadImage(path.join(__dirname, '../../assets/badge.png'));
    context.drawImage(baseImage, 0, 0, width, height);

    // Personalize the badge
    context.fillStyle = '#333';
    context.font = 'bold 24px Arial';
    context.fillText(name, 50, 50);

    context.font = '18px Arial';
    context.fillText(`Issued by: ${issuer}`, 50, 100);

    context.font = '16px Arial';
    context.fillText(`Unique Key: ${uniqueKey}`, 50, 150);

    context.font = '16px Arial';
    context.fillText(`Date: ${new Date().toLocaleDateString()}`, 50, 180);

    // Save the badge as a PNG file
    const buffer = canvas.toBuffer('image/png');
    const filePath = path.join(__dirname, '../../badges', `${uniqueKey}.png`);
    fs.writeFileSync(filePath, buffer);

    // Upload the badge to S3
    const s3Params = {
        Bucket: 'digital-badge-bucket',
        Key: `${uniqueKey}.png`,
        Body: buffer,
        ContentType: 'image/png',
        ACL: 'public-read'
    };

    await s3.upload(s3Params).promise();

    return `https://digital-badge-bucket.s3.amazonaws.com/${uniqueKey}.png`;
}