import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDb = new DynamoDBClient({});
const VOLUNTEER_SIGNUP_TABLE_NAME = process.env.VOLUNTEER_SIGNUP_TABLE_NAME || "";

export const handler = async (event: any) => {
  try {
    const eventId = event.pathParameters.eventId;
    const managerId = event.requestContext.authorizer.claims.sub;
    const userGroups = event.requestContext.authorizer.claims["cognito:groups"] || [];

    // Check if user has Manager role
    if (!userGroups.includes("Managers")) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          error: "Unauthorized: Only Managers can access this endpoint.",
        }),
      };
    }

    // Validate input
    if (!eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Event ID is required in the path parameters.",
        }),
      };
    }

    // Query the VolunteerSignUp table for the eventId
    const params = {
      TableName: VOLUNTEER_SIGNUP_TABLE_NAME,
      KeyConditionExpression: "PK = :eventId",
      ExpressionAttributeValues: {
        ":eventId": { S: eventId },
      },
    };

    const result = await dynamoDb.send(new QueryCommand(params));

    const volunteers = result.Items ? result.Items.map(item => unmarshall(item)) : [];

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        volunteers,
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: `Could not retrieve volunteers: ${errorMessage}`,
      }),
    };
  }
};
