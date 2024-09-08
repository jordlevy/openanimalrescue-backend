import { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
// @ts-ignore
import { Animal } from "/opt/nodejs/types";

const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME || "";

// Helper function to convert string to Proper Case
const toProperCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
};

export const handler = async (event: any) => {
  try {
    const { uuid } = event.pathParameters; // UUID is the PK now

    // Retrieve the existing animal from DynamoDB using UUID and species (SK)
    const getParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        PK: uuid,   // Use UUID as Partition Key
        SK: "species",  // Use species as Sort Key
      }),
    };

    const getResult = await dynamoDb.send(new GetItemCommand(getParams));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: `Animal with UUID: ${uuid} not found.`,
        }),
      };
    }

    const existingAnimal: Animal = unmarshall(getResult.Item) as Animal;

    // Parse request body for fields to update
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
      bio,
      availableToAdopt,
      showOnApp,
    } = JSON.parse(event.body);

    // Determine if the species is changing
    const speciesChanging = species && species.toLowerCase() !== existingAnimal.SK;

    // Proper case the name if provided
    name = name ? toProperCase(name) : existingAnimal.name;

    // Ensure that age is a valid number or use the existing value
    age = age !== undefined ? age : existingAnimal.age;

    // Set defaults or keep existing values for other fields
    breed = breed || existingAnimal.breed;
    goodWithCats = goodWithCats || existingAnimal.goodWithCats;
    goodWithDogs = goodWithDogs || existingAnimal.goodWithDogs;
    goodWithChildren = goodWithChildren || existingAnimal.goodWithChildren;
    goodWithPeople = goodWithPeople || existingAnimal.goodWithPeople;
    houseTrained = houseTrained || existingAnimal.houseTrained;
    specialNeeds = specialNeeds || existingAnimal.specialNeeds;
    headline = headline || existingAnimal.headline;
    bio = bio || existingAnimal.bio;
    availableToAdopt = availableToAdopt !== undefined ? availableToAdopt : existingAnimal.availableToAdopt;
    showOnApp = showOnApp !== undefined ? showOnApp : existingAnimal.showOnApp;

    // Update the timestamp
    const currentEpochTime = Math.floor(Date.now() / 1000);

    // If the species has changed, insert the updated animal as a new item
    if (speciesChanging) {
      const newAnimal: Animal = {
        PK: uuid,  // Keep UUID as Partition Key
        SK: species.toLowerCase(),  // Use the new species as Sort Key
        breed,
        name,
        age,
        availableToAdopt,
        showOnApp,
        photos: existingAnimal.photos,  // Keep existing photos
        onboardedAt: existingAnimal.onboardedAt,  // Keep the original onboardedAt timestamp
        updatedAt: currentEpochTime,  // Update the timestamp
        goodWithCats,
        goodWithDogs,
        goodWithChildren,
        goodWithPeople,
        houseTrained,
        specialNeeds,
        headline,
        bio,
      };

      // Insert the new animal record with the updated species
      const putParams = {
        TableName: TABLE_NAME,
        Item: marshall(newAnimal),
      };
      await dynamoDb.send(new PutItemCommand(putParams));

      // Delete the old animal record (with the old species as SK)
      const deleteParams = {
        TableName: TABLE_NAME,
        Key: marshall({
          PK: uuid,   // UUID remains the same
          SK: existingAnimal.SK,  // Delete the old species entry
        }),
      };
      await dynamoDb.send(new DeleteItemCommand(deleteParams));
    } else {
      // If species has not changed, just update the existing animal
      const updatedAnimal: Animal = {
        PK: uuid,  // Use UUID as Partition Key
        SK: existingAnimal.SK,  // Keep the existing species as Sort Key
        breed,
        name,
        age,
        availableToAdopt,
        showOnApp,
        photos: existingAnimal.photos,  // Keep the existing photos
        onboardedAt: existingAnimal.onboardedAt,  // Keep the original onboardedAt timestamp
        updatedAt: currentEpochTime,  // Update the timestamp
        goodWithCats,
        goodWithDogs,
        goodWithChildren,
        goodWithPeople,
        houseTrained,
        specialNeeds,
        headline,
        bio,
      };

      const putParams = {
        TableName: TABLE_NAME,
        Item: marshall(updatedAnimal),
      };
      await dynamoDb.send(new PutItemCommand(putParams));
    }

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `${name} has been updated successfully!`,
        uuid: uuid,
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
        error: `Could not update animal: ${errorMessage}`,
      }),
    };
  }
};
