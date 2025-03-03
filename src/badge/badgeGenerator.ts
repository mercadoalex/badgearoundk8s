import { createCanvas, loadImage, CanvasRenderingContext2D as CanvasContext } from 'canvas';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Badge } from '../types';

// Load the KeyCode Catalog
const keyCodeCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/keyCodeCatalog.json'), 'utf-8'));

// Generate a badge and return the file paths of the badge
export async function generateBadgeFiles(badgeDetails: Badge): Promise<{ pngFilePath: string, pdfFilePath: string }> {
    const { firstName, lastName, uniqueKey, email, studentId, hiddenField, issuer } = badgeDetails;

    if (!firstName || !lastName || !studentId || !hiddenField || !email || !issuer) {
        throw new Error('Missing required badge details');
    }

    const width = 300; // Reduced width by half
    const height = 200; // Reduced height by half
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d') as CanvasContext;

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
    context.font = 'bold 14px Arial'; // Reduced font size by half
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

    // Draw the hidden field below the base image
    context.font = '6px Arial, OpenSans'; // Reduced font size by half
    wrapText(context, `Hidden Field: ${hiddenField}`, 5, imageHeight + 90, width - 10, 7.5);

    // Ensure the output directory exists
    const outputDir = path.join(__dirname, '../../output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save the badge as a PNG file
    const buffer = canvas.toBuffer('image/png');
    const pngFilePath = path.join(outputDir, `${uniqueKey}.png`);
    fs.writeFileSync(pngFilePath, buffer);

    // Create a PDF document
    const pdfDoc = new PDFDocument();
    const pdfFilePath = path.join(outputDir, `${uniqueKey}.pdf`);
    pdfDoc.pipe(fs.createWriteStream(pdfFilePath));

    // Add the badge image to the PDF
    pdfDoc.image(buffer, 0, 0, { width: pdfDoc.page.width, height: pdfDoc.page.height });

    // Finalize the PDF and end the stream
    pdfDoc.end();

    return { pngFilePath, pdfFilePath };
}