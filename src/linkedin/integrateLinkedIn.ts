// Function to integrate with LinkedIn API to share a badge
export const integrateLinkedIn = async (badgeId: string, accessToken: string) => {
    const linkedInApiUrl = 'https://api.linkedin.com/v2/shares'; // LinkedIn API endpoint for sharing content

    // Data to be sent to LinkedIn API
    const badgeData = {
        content: {
            title: 'Digital Badge Earned', // Title of the shared content
            description: `I have completed the training and earned a badge with ID: ${badgeId}`, // Description of the shared content
            submittedUrl: `https://yourbadgeurl.com/badge/${badgeId}`, // URL of the badge
            submittedImageUrl: `https://yourbadgeurl.com/images/${badgeId}.png` // URL of the badge image
        },
        owner: 'urn:li:person:YOUR_LINKEDIN_ID', // LinkedIn ID of the user sharing the content
        visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" // Visibility setting for the shared content
        }
    };

    try {
        // Making a POST request to LinkedIn API
        const response = await fetch(linkedInApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`, // Bearer token for authorization
                'Content-Type': 'application/json' // Content type set to JSON
            },
            body: JSON.stringify(badgeData) // Converting badge data to JSON string
        });

        // Checking if the response is not OK
        if (!response.ok) {
            throw new Error(`Error sharing badge on LinkedIn: ${response.statusText}`); // Throwing an error if the response is not OK
        }

        const result = await response.json(); // Parsing the response JSON
        return result; // Returning the result
    } catch (error) {
        console.error('LinkedIn integration error:', error); // Logging the error to the console
        throw error; // Throwing the error to be handled by the caller
    }
};