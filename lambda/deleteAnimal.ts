import { DynamoDBClient, DeleteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
// @ts-ignore
import { Animal } from "/opt/nodejs/types";

const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME || "";

export const handler = async (event: any) => {
  const { uuid } = event.pathParameters;  // UUID is the PK
  const species = event.queryStringParameters?.species?.toLowerCase(); // Get species from query params

  // Validate that species is provided
  if (!species) {
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        success: false, 
        error: "Species is required as a query parameter." 
      }),
    };
  }

  // First, get the item using the UUID as the PK and species as SK
  const getParams = {
    TableName: TABLE_NAME,
    Key: marshall({
      PK: uuid,  // Use UUID as the Partition Key
      SK: species, // Use species as the Sort Key (SK)
    }),
  };

  try {
    const getResult = await dynamoDb.send(new GetItemCommand(getParams));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: "Animal not found" }),
      };
    }

    const animal: Animal = unmarshall(getResult.Item) as Animal;

    // Now delete the item using the UUID (PK) and species (SK)
    const deleteParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        PK: uuid,        // Partition Key is the UUID
        SK: animal.SK,   // Sort Key is the species
      }),
    };

    await dynamoDb.send(new DeleteItemCommand(deleteParams));

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Animal with UUID: ${uuid} and species: ${animal.SK} deleted successfully.`,
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
        error: `Could not delete animal: ${errorMessage}`,
      }),
    };
  }
};
