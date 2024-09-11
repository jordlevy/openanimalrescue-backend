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
    PK: string;             // DDMMYYYY#VenueName (e.g., 15092024#Parktown) I'm South African, so we use DDMMYYYY
    managerId: string;      // The CognitoID of the manager who created the event
    eventDate: string;      // ISO Date format (e.g., '2024-09-15T10:00:00Z') mainly for sorting in memory or with a GSI
    venueId: string;     // ID of the venue so we can fetch from the Venues table, or review the venue details below.
    availableSpotsExec: number;     // Number of spots for exec volunteers
    availableSpotsStandard: number; // Number of spots for standard volunteers
    signUpOpen: boolean;    // Flag to indicate if sign-ups are open
    volunteersExec: string[];   // Array of CognitoIDs of exec volunteers
    volunteersStandard: string[]; // Array of CognitoIDs of standard volunteers
    animalsAssigned: string[];   // Array of Animal PKs assigned to the event
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
    PK: string;           // DDMMYYYY#VenueName (e.g., 15092024#Parktown)
    SK: string;           // CognitoID of the volunteer (e.g., user123)
    userId: string;       // CognitoID of the volunteer
    signupEpoch: number;  // Epoch timestamp when the volunteer signed up
    assignedRole: 'exec' | 'standard' | null;  // Role assigned by staff, default is null
    reviewedBy: string | null;  // CognitoID of the staff member who reviewed and added them to the list
    reviewedAt: number | null;  // Epoch timestamp for when the review was completed
  }
  