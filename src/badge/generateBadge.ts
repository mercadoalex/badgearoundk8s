import { createCanvas, loadImage, CanvasRenderingContext2D as CanvasContext } from 'canvas';
import { Badge } from '../types';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Load the KeyCode Catalog
const keyCodeCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/keyCodeCatalog.json'), 'utf-8'));


const s3 = new S3Client({ region: 'us-west-2' });

export async function generateBadge(badgeDetails: Badge): Promise<string> {
    const { name, issuer, uniqueKey } = badgeDetails;

    const width = 600;
    const height = 400; // Increased height to accommodate additional text
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d') as CanvasContext;

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
        wrapText(context, keyCodeCatalog[uniqueKey] || uniqueKey, 10, 65, width - 20, 15);

        // Draw the base image on the canvas
        context.drawImage(baseImage, 0, 80, width, baseImage.height);

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
        await s3.send(new PutObjectCommand(uploadParams));

        return `https://digital-badge-bucket.s3.amazonaws.com/${uniqueKey}.png`;
    } catch (error) {
        console.error('Error generating badge:', error);
        throw error;
    }
}