import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";  
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
// @ts-ignore
import { v4 as uuidv4 } from "/opt/nodejs/node_modules/uuid";  // Import uuid
// @ts-ignore
import { Animal } from "/opt/nodejs/types";  // Import the shared Animal type

const dynamoDb = new DynamoDBClient({});
const ssmClient = new SSMClient({});
const TABLE_NAME = process.env.TABLE_NAME || "";
const SPECIES_LIST_SSM_PARAM = process.env.SPECIES_LIST_SSM_PARAM || "";

// Helper function to convert string to Proper Case
const toProperCase = (str: string): string => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
};

export const handler = async (event: any) => {
  try {
    // Fetch species list from SSM
    const speciesParam = await ssmClient.send(
      new GetParameterCommand({ Name: SPECIES_LIST_SSM_PARAM })
    );
    const speciesList: string[] = JSON.parse(speciesParam.Parameter?.Value || "[]").map((s: string) => s.toLowerCase());


    // Parse the request body
    let {
      species,
      breed,
      name,
      age,
      goodWithCats,
      goodWithDogs,
      goodWithChildren,
      goodWithPeople,
      houseTrained,
      specialNeeds,
      headline,
      bio
    } = JSON.parse(event.body);

    // Validate required fields
    if (!species || !breed || !name || age === undefined || typeof age !== 'number' || age <= 0) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: "Missing required fields: Species, Breed, Name, and Age must be valid.",
          }),
        };
      }

    // Convert species to lowercase for validation
    species = species.toLowerCase();

    // Validate if species exists in the species list
    if (!speciesList.includes(species)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: `Invalid species provided: ${species}. Available species are: ${speciesList.join(", ")}.`,
        }),
      };
    }

    // Proper case the animal name
    name = toProperCase(name);

    // Default values for optional fields
    goodWithCats = goodWithCats ?? "Unknown";
    goodWithDogs = goodWithDogs ?? "Unknown";
    goodWithChildren = goodWithChildren ?? "Unknown";
    goodWithPeople = goodWithPeople ?? "Unknown";
    houseTrained = houseTrained ?? "Unknown";
    specialNeeds = specialNeeds ?? "None";
    headline = headline ?? "No headline provided";
    bio = bio ?? "No bio provided";

    const currentEpochTime = Math.floor(Date.now() / 1000);

    // Generate a UUID for the animal
    const animalUuid = uuidv4();

    // Create the animal object using the shared Animal type
    const newAnimal: Animal = {
        PK: animalUuid,  // UUID as Partition Key
        SK: species,     // Species as Sort Key
        breed: breed,    // Store breed for GSI
        name,
        age,
        availableToAdopt: false,  // Default to false
        showOnApp: false,         // Default to false
        photos: [],               // Empty array for now
        onboardedAt: currentEpochTime,
        updatedAt: currentEpochTime,
        goodWithCats,
        goodWithDogs,
        goodWithChildren,
        goodWithPeople,
        houseTrained,
        specialNeeds,
        headline,
        bio
      };

    // Prepare DynamoDB PutItem command
    const params = {
      TableName: TABLE_NAME,
      Item: marshall(newAnimal),
    };

    // Write the new animal to DynamoDB
    await dynamoDb.send(new PutItemCommand(params));

    // Return success response
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: `${name} onboarded successfully!`,
        uuid: animalUuid,
        onboardedAt: currentEpochTime,
        updatedAt: currentEpochTime,
      }),
    };

  } catch (error) {
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: `Could not create animal: ${errorMessage}`,
      }),
    };
  }
};
