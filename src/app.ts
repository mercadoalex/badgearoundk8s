import express, { Request, Response } from 'express';
import { generateBadge } from './badge/generateBadge';
import { integrateLinkedIn } from './linkedin/integrateLinkedIn';
import { Badge } from './types';
import fs from 'fs';
import path from 'path';

// Load the KeyCode Catalog
const keyCodeCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/keyCodeCatalog.json'), 'utf-8'));

/* The code imports the express module for creating the server and two functions, 
generateBadge and integrateLinkedIn, from other modules. */

// Creating an instance of an Express application
const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_IP = process.env.SERVER_IP || 'localhost';

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded bodies

// Function to validate keyCode
function validateKeyCode(keyCode: string): boolean {
    return keyCode in keyCodeCatalog;
}

// Route to generate a digital badge
app.post('/generate-badge', async (req: Request, res: Response): Promise<void> => {
    const { firstName, lastName, keyCode } = req.body; // Extracting form data from the request body
    const issuer = `KMMX-${Date.now()}`; // Generating the issuer value with a timestamp and 'KMMX-' prefix

    // Validate the keyCode
    if (!validateKeyCode(keyCode)) {
        res.send(`
            <html>
                <head>
                    <title>Badge Generation Error</title>
                </head>
                <body>
                    <h1>Badge Generation Error</h1>
                    <p style="color: red;">Not Valid</p>
                    <p><a href="/">Go back</a></p>
                </body>
            </html>
        `);
        return;
    }

    const badgeDetails: Badge = {
        name: `${firstName} ${lastName}`,
        issuer,
        uniqueKey: keyCode,
        keyDescription: keyCodeCatalog[keyCode] || keyCode // Add this line
    };

    try {
        const badgeUrl = await generateBadge(badgeDetails); // Generating the badge using the generateBadge function
        res.send(`
            <html>
                <head>
                    <title>Badge Generated</title>
                </head>
                <body>
                    <h1>Badge Generated Successfully</h1>
                    <p>Here is your badge:</p>
                    <img src="${badgeUrl}" alt="Generated Badge">
                    <ul>
                        <li><a href="http://${SERVER_IP}:${PORT}/share-badge">Share Badge on LinkedIn</a></li>
                    </ul>
                    <p><a href="/">Go back</a></p>
                </body>
            </html>
        `); // Sending the URL of the generated badge as the response
    } catch (error) {
        console.error('Error generating badge:', error);
        res.status(500).send('Error generating badge'); // Sending an error response if badge generation fails
    }
});

// Starting the server and listening on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on http://${SERVER_IP}:${PORT}`);
    console.log(`Generate Badge: http://${SERVER_IP}:${PORT}/generate-badge`);
    console.log(`Share Badge on LinkedIn: http://${SERVER_IP}:${PORT}/share-badge`);
});

/* This code sets up a basic Express server with two routes: 
one for generating a digital badge and another for sharing the badge on LinkedIn. */

