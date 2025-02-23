import express, { Request, Response } from 'express';
import { generateBadge } from './badge/generateBadge';
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
                    <h1>Badge Generation Error</h1>
                    <p style="color: red;">Invalid Key Code</p>
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
                    <h1>Badge Generation Error</h1>
                    <p style="color: red;">Invalid Student ID</p>
                    <p><a href="/">Go back</a></p>
                </body>
            </html>
        `);
        return;
    }

    // Create the badgeDetails object
    const badgeDetails: Badge = {
        name: `${firstName} ${lastName}`, // Add the name property
        firstName,
        lastName,
        email,
        studentId,
        hiddenField,
        issuer,
        uniqueKey: keyCode,
        keyDescription: keyCodeCatalog[keyCode] || keyCode
    };

    try {
        const badgeUrl = await generateBadge(badgeDetails); // Generating the badge using the generateBadge function
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
       <!DOCTYPE html>
        <html lang="en">
            <head>
                <title>Welcome To the Digital Badge Creator</title>
                	<meta charset="UTF-8">
	                <meta name="viewport" content="width=device-width, initial-scale=1">
                <!--===============================================================================================-->
	            <link rel="icon" type="image/png" href="images/icons/favicon.ico">
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
                <h3>Recognize accomplishments with 100% verifiable digital badges</h3>
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

                dfsgfhfkhjklfjhjflghklfkhfglhkñgfhkgflhkfghlñfgkhlgfñhklñghklfghkgfñlhkfghklfgkhkfglhkfglks

	<div class="container-contact100">
		<div class="wrap-contact100">
			<form class="contact100-form validate-form">
				<span class="contact100-form-title">
					Say Hello!
				</span>

				<div class="wrap-input100 validate-input" data-validate="Name is required">
					<span class="label-input100">Your Name</span>
					<input class="input100" type="text" name="name" placeholder="Enter your name">
					<span class="focus-input100"></span>
				</div>

				<div class="wrap-input100 validate-input" data-validate = "Valid email is required: ex@abc.xyz">
					<span class="label-input100">Email</span>
					<input class="input100" type="text" name="email" placeholder="Enter your email addess">
					<span class="focus-input100"></span>
				</div>

				<div class="wrap-input100 input100-select">
					<span class="label-input100">Needed Services</span>
					<div>
						<select class="selection-2" name="service">
							<option>Choose Services</option>
							<option>Online Store</option>
							<option>eCommerce Bussiness</option>
							<option>UI/UX Design</option>
							<option>Online Services</option>
						</select>
					</div>
					<span class="focus-input100"></span>
				</div>

				<div class="wrap-input100 input100-select">
					<span class="label-input100">Budget</span>
					<div>
						<select class="selection-2" name="budget">
							<option>Select Budget</option>
							<option>1500 $</option>
							<option>2000 $</option>
							<option>2500 $</option>
						</select>
					</div>
					<span class="focus-input100"></span>
				</div>

				<div class="wrap-input100 validate-input" data-validate = "Message is required">
					<span class="label-input100">Message</span>
					<textarea class="input100" name="message" placeholder="Your message here..."></textarea>
					<span class="focus-input100"></span>
				</div>

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
	<script src="vendor/jquery/jquery-3.2.1.min.js"></script>
    <!--===============================================================================================-->
	<script src="vendor/animsition/js/animsition.min.js"></script>
    <!--===============================================================================================-->
	<script src="vendor/bootstrap/js/popper.js"></script>
	<script src="vendor/bootstrap/js/bootstrap.min.js"></script>
    <!--===============================================================================================-->
	<script src="vendor/select2/select2.min.js"></script>
	<script>
		$(".selection-2").select2({
			minimumResultsForSearch: 20,
			dropdownParent: $('#dropDownSelect1')
		});
	</script>
    <!--===============================================================================================-->
	<script src="vendor/daterangepicker/moment.min.js"></script>
	<script src="vendor/daterangepicker/daterangepicker.js"></script>
    <!--===============================================================================================-->
	<script src="vendor/countdowntime/countdowntime.js"></script>
    <!--===============================================================================================-->
	<script src="js/main.js"></script>

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

