// deleteAnimal.ts

import { DynamoDBClient, DeleteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
// @ts-ignore
import { Animal } from "/opt/nodejs/types";
// @ts-ignore
import { isUserAuthorized } from "/opt/nodejs/cognitoAuthCheck";

const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME || "";
const ALLOWED_GROUPS = ["Staff", "Managers"];

/**
 * Lambda Handler
 * @param event - API Gateway event
 * @returns API Gateway response
 */
export const handler = async (event: any) => {
  try {
    // Authorization: Check if user is in allowed groups using shared function
    if (!isUserAuthorized(event, ALLOWED_GROUPS)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          error: "You do not have permission to perform this action.",
        }),
      };
    }

    // Extract UUID from path parameters
    const { uuid } = event.pathParameters || {};
    if (!uuid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "UUID is required in the path parameters.",
        }),
      };
    }

    // Extract species from query parameters
    const speciesParam = event.queryStringParameters?.species;
    if (!speciesParam) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Species is required as a query parameter.",
        }),
      };
    }

    const species = speciesParam.toLowerCase();

    // Prepare DynamoDB GetItem command to verify existence
    const getParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        PK: uuid,    // Partition Key: UUID
        SK: species, // Sort Key: Species
      }),
    };

    // Fetch the animal from DynamoDB
    const getResult = await dynamoDb.send(new GetItemCommand(getParams));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: `Animal with UUID: ${uuid} and species: ${species} not found.`,
        }),
      };
    }

    const animal: Animal = unmarshall(getResult.Item) as Animal;

    // Prepare DynamoDB DeleteItem command
    const deleteParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        PK: uuid,  // Partition Key: UUID
        SK: species, // Sort Key: Species
      }),
    };

    // Delete the animal from DynamoDB
    await dynamoDb.send(new DeleteItemCommand(deleteParams));

    // Successful deletion response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Animal with UUID: ${uuid} and species: ${species} deleted successfully.`,
      }),
    };
  } catch (error) {
    console.error("Error deleting animal:", error);

    // Determine the error message
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";

    // Internal server error response
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: `Could not delete animal: ${errorMessage}`,
      }),
    };
  }
};
