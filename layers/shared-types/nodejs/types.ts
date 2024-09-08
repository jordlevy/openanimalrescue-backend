export interface Animal {
    PK: string;           // UUID
    SK: string;           // Species
    breed: string;         // Breed
    name: string;         // Name of the animal
    age: number;          // Age in years
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