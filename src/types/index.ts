//TypeScript interfaces that describe the shape of objects used in your application
// Interface for Badge details
export interface Badge {
    name: string; // Name of the badge
    issuer: string; // Issuer of the badge
    uniqueKey: string; // Unique key for the badge
    keyDescription: string;
    firstName: string; 
    lastName: string;  
    studentId: string; 
    hiddenField: string; 
    email: string; 
}

// Interface for LinkedIn integration details
export interface LinkedInIntegration {
    accessToken: string; // Access token for LinkedIn API
    badgeId: string; // ID of the badge to be shared
    userId: string; // LinkedIn user ID of the person sharing the badge
}
