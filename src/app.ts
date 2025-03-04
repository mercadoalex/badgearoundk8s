import express, { Request, Response } from 'express';
import { generateBadgeFiles } from './badge/badgeGenerator';
import { insertBadgeData } from './badge/databaseInsertion';
import { uploadBadgeFiles } from './badge/s3Storage';
import fs from 'fs';
import path from 'path';

// Load the KeyCode Catalog
const keyCodeCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/keyCodeCatalog.json'), 'utf-8'));
// Load the Issuer Catalog
const issuerCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/issuerCatalog.json'), 'utf-8'));

/* The code imports the express module for creating the server and functions for generating badge files, 
inserting badge data into the database, and uploading badge files to S3 from other modules. */

// Creating an instance of an Express application
const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_IP = process.env.SERVER_IP || 'localhost';

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded bodies

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Function to validate keyCode
function validateKeyCode(keyCode: string): boolean {
    return keyCode in keyCodeCatalog;
}

// Function to validate issuer
function validateIssuer(issuerCode: string): boolean {
    return issuerCode in issuerCatalog;
}

// Function to validate email format
function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Route to generate a digital badge
app.post('/generate-badge', async (req: Request, res: Response): Promise<void> => {
    try {
        const badgeDetails = req.body;

        // Validate the badge details
        if (!validateEmail(badgeDetails.email)) {
            res.status(400).send('Invalid email format');
            return;
        }
        if (!validateKeyCode(badgeDetails.keyCode)) {
            res.status(400).send('Invalid key code');
            return;
        }
        if (!validateIssuer(badgeDetails.issuer)) {
            res.status(400).send('Invalid issuer');
            return;
        }

        // Generate badge files
        const { pngFilePath, pdfFilePath } = await generateBadgeFiles(badgeDetails);

        // Upload badge files to S3
        await uploadBadgeFiles(badgeDetails, pngFilePath, pdfFilePath);

        // Insert badge data into the database
        await insertBadgeData(badgeDetails);

        const badgePngUrl = `https://digital-badge-bucket.s3.amazonaws.com/${badgeDetails.keyCode}.png`;
        const badgeUrl = `https://digital-badge-bucket.s3.amazonaws.com/${badgeDetails.keyCode}.pdf`;

        res.send(`
            <html>
                <head>
                    <title>Badge Generated</title>
                    <link rel="stylesheet" type="text/css" href="/css/bootstrap.min.css">
                    <link rel="stylesheet" type="text/css" href="/css/font-awesome.min.css">
                    <link rel="stylesheet" type="text/css" href="/css/animate.css">
                    <link rel="stylesheet" type="text/css" href="/css/hamburgers.min.css">
                    <link rel="stylesheet" type="text/css" href="/css/animsition.min.css">
                    <link rel="stylesheet" type="text/css" href="/css/select2.min.css">
                    <link rel="stylesheet" type="text/css" href="/css/daterangepicker.css">
                    <link rel="stylesheet" type="text/css" href="/css/util.css">
                    <link rel="stylesheet" type="text/css" href="/css/main.css">
                </head>
                <body>
                    <div class="container-contact100">
                        <div class="wrap-contact100">
                            <span class="contact100-form-title">
                                Here is your badge:
                            </span>
                            <img src="${badgePngUrl}" alt="Generated Badge">
                            <ul>
                                <li><a href="http://${SERVER_IP}:${PORT}/share-badge">Share Badge on LinkedIn</a></li>
                                <li><a href="${badgePngUrl}" download>Download Badge as PNG</a></li>
                                <li><a href="${badgeUrl}" download>Download Badge as PDF</a></li>
                            </ul>
                            <p><a href="/">Go back</a></p>
                        </div>
                    </div>
                </body>
            </html>
        `); // Sending the URL of the generated badge as the response
    } catch (error) {
        console.error('Error generating badge:', error);
        res.status(500).send('Error generating badge'); // Sending an error response if badge generation fails
    }
});

// Route for sharing the badge on LinkedIn
app.get('/share-badge', (req: Request, res: Response) => {
    res.send(`
        <html>
            <head>
                <title>Share Badge on LinkedIn</title>
                <link rel="stylesheet" type="text/css" href="/css/bootstrap.min.css">
                <link rel="stylesheet" type="text/css" href="/css/font-awesome.min.css">
                <link rel="stylesheet" type="text/css" href="/css/animate.css">
                <link rel="stylesheet" type="text/css" href="/css/hamburgers.min.css">
                <link rel="stylesheet" type="text/css" href="/css/animsition.min.css">
                <link rel="stylesheet" type="text/css" href="/css/select2.min.css">
                <link rel="stylesheet" type="text/css" href="/css/daterangepicker.css">
                <link rel="stylesheet" type="text/css" href="/css/util.css">
                <link rel="stylesheet" type="text/css" href="/css/main.css">
            </head>
            <body>
                <div class="container-contact100">
                    <div class="wrap-contact100">
                        <span class="contact100-form-title">
                            Share your badge on LinkedIn
                        </span>
                        <p>Click the button below to share your badge on LinkedIn:</p>
                        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`http://${SERVER_IP}:${PORT}/badge-url`)}" target="_blank" class="btn btn-primary">Share on LinkedIn</a>
                        <p><a href="/">Go back</a></p>
                    </div>
                </div>
            </body>
        </html>
    `);
});

// Route for the root URL
app.get('/', (req: Request, res: Response) => {
    // Generate the list of key codes
    const keyCodeOptions = Object.keys(keyCodeCatalog).map(keyCode => `<option value="${keyCode}">${keyCode}</option>`).join('');
    // Generate the list of issuers
    const issuerOptions = Object.keys(issuerCatalog).map(issuer => `<option value="${issuer}">${issuer}</option>`).join('');

    res.send(`
       <!DOCTYPE html>
        <html lang="en">
            <head>
                <title>Welcome To the Digital Badge Service</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <!--===============================================================================================-->
                <link rel="icon" type="image/png" href="/images/icons/favicon.ico">
                <!--===============================================================================================-->
                <link rel="stylesheet" type="text/css" href="/css/bootstrap.min.css">
                <!--===============================================================================================-->
                <link rel="stylesheet" type="text/css" href="/css/font-awesome.min.css">
                <!--===============================================================================================-->
                <link rel="stylesheet" type="text/css" href="/css/animate.css">
                <!--===============================================================================================-->
                <link rel="stylesheet" type="text/css" href="/css/hamburgers.min.css">
                <!--===============================================================================================-->
                <link rel="stylesheet" type="text/css" href="/css/animsition.min.css">
                <!--===============================================================================================-->
                <link rel="stylesheet" type="text/css" href="/css/select2.min.css">
                <!--===============================================================================================-->
                <link rel="stylesheet" type="text/css" href="/css/daterangepicker.css">
                <!--===============================================================================================-->
                <link rel="stylesheet" type="text/css" href="/css/util.css">
                <link rel="stylesheet" type="text/css" href="/css/main.css">
                <!--===============================================================================================-->
                <meta name="robots" content="noindex, follow">
                <script>
                    const keyCodeCatalog = ${JSON.stringify(keyCodeCatalog)};
                    const issuerCatalog = ${JSON.stringify(issuerCatalog)};
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
        <div class="container-contact100">
        <div class="wrap-contact100">
        <form class="contact100-form validate-form" id="badgeForm" action="/generate-badge" method="post" onsubmit="confirmSubmission(event)">
                <span class="contact100-form-title">
                    Welcome to the Badge Generation Service
                </span>
                <p> Recognize accomplishments with 100% verifiable digital badges </p>
                <div class="wrap-input100 validate-input" data-validate=" First Name is required">
                    <span class="label-input100">First Name</span>
                    <input class="input100" type="text" name="firstName" placeholder="Enter First name">
                    <span class="focus-input100"></span>
                </div>
                <div class="wrap-input100 validate-input" data-validate=" Last Name is required">
                    <span class="label-input100">Last Name</span>
                    <input class="input100" type="text" name="lastName" placeholder="Enter Last name">
                    <span class="focus-input100"></span>
                </div>
                <div class="wrap-input100 validate-input" data-validate = "Valid email is required: ex@abc.xyz">
                    <span class="label-input100">Email</span>
                    <input class="input100" type="text" name="email" placeholder="Enter your email address">
                    <span class="focus-input100"></span>
                </div>
                <div class="wrap-input100 validate-input" data-validate = "Issuer is required">
                    <span class="label-input100">Issuer</span>
                    <select class="selection-2" id="issuer" name="issuer" required>
                        ${issuerOptions}
                    </select>
                    <span class="focus-input100"></span>
                </div>
                <div class="wrap-input100 validate-input" data-validate = "Key Code is required">
                    <span class="label-input100">Key Code</span>
                    <select class="selection-2" id="keyCode" name="keyCode" required>
                        ${keyCodeOptions}
                    </select>
                    <span class="focus-input100"></span>
                </div>
                 <div class="wrap-input100 validate-input" data-validate = "Participant Id is required">
                    <span class="label-input100">Student Id:</span>
                    <input class="input100" type="number" name="studentId" min="100" max="151" placeholder="Enter your student ID">
                    <span class="focus-input100"></span>
                </div>
                    <input type="hidden" id="hiddenField" name="hiddenField" value=""><br>
                <div class="container-contact100-form-btn">
                    <div class="wrap-contact100-form-btn">
                        <div class="contact100-form-bgbtn"></div>
                        <button class="contact100-form-btn">
                            <span>
                                Submit
                                <i class="fa fa-long-arrow-right m-l-7" aria-hidden="true"></i>
                            </span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>
    <div id="dropDownSelect1"></div>

            <!--===============================================================================================-->
    <script src="/scripts/jquery-3.2.1.min.js"></script>
            <!--===============================================================================================-->
    <script src="/scripts/animsition.min.js"></script>
            <!--===============================================================================================-->
    <script src="/scripts/popper.js"></script>
    <script src="/scripts/bootstrap.min.js"></script>
            <!--===============================================================================================-->
    <script src="/scripts/select2.min.js"></script>
            <script>
                $(".selection-2").select2({
                    minimumResultsForSearch: 20,
                    dropdownParent: $('#dropDownSelect1')
                });
            </script>
            <!--===============================================================================================-->
            <script src="/scripts/moment.min.js"></script>
            <script src="/scripts/daterangepicker.js"></script>
            <!--===============================================================================================-->
            <script src="/scripts/countdowntime.js"></script>
            <!--===============================================================================================-->
            <script src="/scripts/main.js"></script>

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

