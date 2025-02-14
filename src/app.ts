import express from 'express';
import { generateBadge } from './badge/generateBadge';
import { integrateLinkedIn } from './linkedin/integrateLinkedIn';

/* The code imports the express module for creating the server and two functions, 
generateBadge and integrateLinkedIn, from other modules. */

// Creating an instance of an Express application
const app = express();
const PORT = process.env.PORT || 3000; // Setting the port to the value from environment variables or default to 3000
const SERVER_IP = process.env.SERVER_IP || 'localhost'; // Setting the server IP from environment variables or default to 'localhost'

// Middleware to parse JSON bodies
app.use(express.json());

// Route to generate a digital badge
app.post('/generate-badge', async (req, res) => {
    const { badgeDetails } = req.body; // Extracting badge details from the request body
    try {
        const badgeUrl = await generateBadge(badgeDetails); // Generating the badge using the generateBadge function
        res.status(200).json({ badgeUrl }); // Sending the URL of the generated badge as the response
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate badge' }); // Sending an error response if badge generation fails
    }
});

// Route to integrate with LinkedIn
app.post('/share-badge', async (req, res) => {
    const { badgeId, userToken } = req.body; // Extracting badge ID and user token from the request body
    try {
        const response = await integrateLinkedIn(badgeId, userToken); // Integrating with LinkedIn using the integrateLinkedIn function
        res.status(200).json(response); // Sending the response from LinkedIn integration
    } catch (error) {
        res.status(500).json({ error: 'Failed to share badge on LinkedIn' }); // Sending an error response if LinkedIn integration fails
    }
});

// Route to serve an HTML page
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Badge Service</title>
            </head>
            <body>
                <h1>Badge Service</h1>
                <p>Server is running on http://${SERVER_IP}:${PORT}</p>
                <ul>
                    <li><a href="http://${SERVER_IP}:${PORT}/generate-badge">Generate Badge</a></li>
                    <li><a href="http://${SERVER_IP}:${PORT}/share-badge">Share Badge on LinkedIn</a></li>
                </ul>
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

/* This code sets up a basic Express server with two routes: 
one for generating a digital badge and another for sharing the badge on LinkedIn. */
