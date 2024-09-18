export interface Animal {
    PK: string;           // UUID
    SK: string;           // Species
    breed: string;         // Breed
    name: string;         // Name of the animal
    age: number;          // Age in years
    gender: string;      // Gender as String
    chipNumber: string;  // Chip number
    availableToAdopt: boolean; // Whether the animal is available for adoption
    showOnApp: boolean;   // Whether to show the animal on the app
    photos: string[];     // Array of S3 links for photos
    onboardedAt: number;  // Epoch timestamp when the animal was onboarded
    updatedAt: number;    // Epoch timestamp for when the animal was last updated
    goodWithCats: string; // Yes/No/Unknown
    goodWithDogs: string; // Yes/No/Unknown
    goodWithChildren: string; // Yes/No/Unknown
    goodWithPeople: string;   // Yes/No/Unknown
    houseTrained: string;     // Yes/No/Unknown
    specialNeeds: string;     // Any special needs
    headline: string;         // Short headline about the animal
    bio: string;              // Detailed bio about the animal
  }

  export interface Event {
    PK: string;             // Event ID (e.g., '15092024#Parktown')
    managerId: string;      // CognitoID of the manager who created the event
    eventDate: string;      // ISO Date format (e.g., '2024-09-15T10:00:00Z')
    venueId: string;        // ID of the venue
    availableSpotsExec: number;     // Number of spots for exec volunteers
    availableSpotsStandard: number; // Number of spots for standard volunteers
    signUpOpen: boolean;    // Flag to indicate if sign-ups are open
    animalsAssigned: string[];   // Array of Animal PKs assigned to the event
    approvedExecCount: number;       // Number of approved exec volunteers
    approvedStandardCount: number;   // Number of approved standard volunteers
  }
  
  
  export interface Venue {
    PK: string;            // venueName#City (e.g., Parktown#Johannesburg)
    suburb: string;        // Suburb of the venue
    address: string;       // Full address of the venue
    coordinates?: {
      latitude: number;    // Latitude of the venue (optional)
      longitude: number;   // Longitude of the venue (optional)
    };
    description?: string;  // Additional details or description of the venue (optional)
  }
  
  export interface VolunteerSignUp {
    PK: string;           // Event ID (e.g., '15092024#Parktown')
    SK: string;           // Volunteer ID (CognitoID)
    signupEpoch: number;  // Epoch timestamp when the volunteer signed up
    status: 'pending' | 'approved' | 'rejected'; // Status of the sign-up
    assignedRole: 'exec' | 'standard' | null;    // Role assigned upon approval
    reviewedBy?: string;  // CognitoID of the Manager who reviewed
    reviewedAt?: number;  // Epoch timestamp when the review was completed
  }
  
  