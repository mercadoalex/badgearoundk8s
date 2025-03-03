//TypeScript interfaces that describe the shape of objects used in your application
// Interface for Badge details
export interface Badge {
    firstName: string; 
    lastName: string;
    issuer: string; // Issuer of the badge
    keyCode: string;
    keyDescription: string; 
    badgeUrl: string; 
    studentId: string; 
    hiddenField: string; 
    email: string; 
    issued:boolean;
}

// Interface for LinkedIn integration details
export interface LinkedInIntegration {
    accessToken: string; // Access token for LinkedIn API
    badgeId: string; // ID of the badge to be shared
    userId: string; // LinkedIn user ID of the person sharing the badge
}
