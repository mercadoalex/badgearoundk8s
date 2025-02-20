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

// Function to validate email format
function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Route to generate a digital badge
app.post('/generate-badge', async (req: Request, res: Response): Promise<void> => {
    const { firstName, lastName, keyCode, email, hiddenField, studentId } = req.body; // Extracting form data from the request body
    const issuer = hiddenField; // Use the hidden field value as the issuer

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

    // Validate the email format
    if (!validateEmail(email)) {
        res.send(`
            <html>
                <head>
                    <title>Badge Generation Error</title>
                </head>
                <body>
                    <h1>Badge Generation Error</h1>
                    <p style="color: red;">Invalid Email Format</p>
                    <p><a href="/">Go back</a></p>
                </body>
            </html>
        `);
        return;
    }

    // Validate the student ID
    if (studentId < 100 || studentId > 151) {
        res.send(`
            <html>
                <head>
                    <title>Badge Generation Error</title>
                </head>
                <body>
                    <h1>Badge Generation Error</h1>
                    <p style="color: red;">Invalid Student ID</p>
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

// Route for the root URL
app.get('/', (req: Request, res: Response) => {
    const hiddenFieldValue = `KMMX-${Date.now()}`; // Generate the hidden field value

    // Generate the list of key codes
    const keyCodeOptions = Object.keys(keyCodeCatalog).map(keyCode => `<option value="${keyCode}">${keyCode}</option>`).join('');

    res.send(`
        <html>
            <head>
                <title>Welcome</title>
                <script>
                    const keyCodeCatalog = ${JSON.stringify(keyCodeCatalog)};
                    function confirmSubmission(event) {
                        const keyCode = document.getElementById('keyCode').value;
                        const keyDescription = keyCodeCatalog[keyCode] || keyCode;
                        const confirmation = confirm('Badge: ' + keyDescription + '\\n\\nDo you want to proceed?');
                        if (!confirmation) {
                            event.preventDefault();
                        }
                    }
                </script>
            </head>
            <body>
                <h1>Welcome to the Badge Generation Service</h1>
                <form id="badgeForm" action="/generate-badge" method="post" onsubmit="confirmSubmission(event)">
                    <label for="firstName">First Name:</label>
                    <input type="text" id="firstName" name="firstName" required><br>
                    <label for="lastName">Last Name:</label>
                    <input type="text" id="lastName" name="lastName" required><br>
                    <label for="keyCode">Key Code:</label>
                    <select id="keyCode" name="keyCode" required>
                        ${keyCodeOptions}
                    </select><br>
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" required><br>
                    <label for="studentId">Student ID:</label>
                    <input type="number" id="studentId" name="studentId" min="100" max="151" required><br>
                    <input type="hidden" id="hiddenField" name="hiddenField" value="${hiddenFieldValue}"><br>
                    <button type="submit">Generate Badge</button>
                </form>
            </body>
        </html>
    `);
});

// Starting the server and listening on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on http://${SERVER_IP}:${PORT}`);
    console.log(`Generate Badge: http://${SERVER_IP}:${PORT}/generate-badge`);
    console.log(`Share Badge on LinkedIn: http://${SERVER_IP}:${PORT}/share-badge`);
});

/* This code sets up a basic Express server with three routes: 
one for generating a digital badge, one for sharing the badge on LinkedIn, and one for the root URL with a form to generate a badge. */

