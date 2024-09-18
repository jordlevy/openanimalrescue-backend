import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
// @ts-ignore
import { VolunteerSignUp } from "/opt/nodejs/types";  // Import the shared VolunteerSignUp type

const dynamoDb = new DynamoDBClient({});
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME || "";
const VOLUNTEER_SIGNUP_TABLE_NAME = process.env.VOLUNTEER_SIGNUP_TABLE_NAME || "";

export const handler = async (event: any) => {
  try {
    // Parse the request body
    const { eventId } = JSON.parse(event.body);

    // Get the volunteer's Cognito ID from the request context
    const volunteerId = event.requestContext.authorizer.claims.sub;

    // Validate input
    if (!eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Event ID is required.",
        }),
      };
    }

    // Check if the event exists
    const eventParams = {
      TableName: EVENTS_TABLE_NAME,
      Key: marshall({ PK: eventId }),
    };

    const eventResponse = await dynamoDb.send(new GetItemCommand(eventParams));

    if (!eventResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: `Event with ID ${eventId} does not exist.`,
        }),
      };
    }

    const eventData = unmarshall(eventResponse.Item);

    // Check if sign-ups are open
    if (!eventData.signUpOpen) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Sign-ups for this event are currently closed.",
        }),
      };
    }

    // Check if the volunteer has already signed up
    const signUpParams = {
      TableName: VOLUNTEER_SIGNUP_TABLE_NAME,
      Key: marshall({ PK: eventId, SK: volunteerId }),
    };

    const signUpResponse = await dynamoDb.send(new GetItemCommand(signUpParams));

    if (signUpResponse.Item) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          error: "You have already signed up for this event.",
        }),
      };
    }

    // Prepare VolunteerSignUp item
    const newSignUp: VolunteerSignUp = {
      PK: eventId,
      SK: volunteerId,
      signupEpoch: Date.now(),
      status: 'pending',
      assignedRole: null,
      // reviewedBy and reviewedAt are optional and not set at sign-up
    };

    // Save to DynamoDB
    const putItemParams = {
      TableName: VOLUNTEER_SIGNUP_TABLE_NAME,
      Item: marshall(newSignUp),
    };

    await dynamoDb.send(new PutItemCommand(putItemParams));

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: `Volunteer sign-up submitted for event ${eventId}. Awaiting Manager approval.`,
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: `Could not sign up volunteer: ${errorMessage}`,
      }),
    };
  }
};
