import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

// @ts-ignore
import { VolunteerSignUp } from "/opt/nodejs/types";  // Import the shared VolunteerSignUp type
// @ts-ignore
import { validate as isUuid } from '/opt/nodejs/shared-utils/uuid';
// @ts-ignore
import { generateEpoch } from "/opt/nodejs/shared-utils";

const dynamoDb = new DynamoDBClient({});
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME || "";
const VOLUNTEER_SIGNUP_TABLE_NAME = process.env.VOLUNTEER_SIGNUP_TABLE_NAME || "";

export const handler = async (event: any) => {
  try {
    // Parse the request body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      console.error("Invalid JSON in request body:", parseError);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Invalid JSON format in request body.",
        }),
      };
    }

    const { eventId } = body;

    // Get the volunteer's Cognito ID from the request context
    const volunteerId = event.requestContext.authorizer?.claims?.sub;

    if (!volunteerId) {
      console.warn("Unauthorized access attempt: Missing volunteerId.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          error: "Unauthorized: Invalid authentication token.",
        }),
      };
    }

    // Validate input
    if (!eventId) {
      console.warn(`Volunteer ${volunteerId} attempted to sign up without an eventId.`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Event ID is required.",
        }),
      };
    }

    // Validate eventId format
    if (!isUuid(eventId)) {
      console.warn(`Volunteer ${volunteerId} provided invalid eventId format: ${eventId}`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Invalid Event ID format. It must be a valid UUID.",
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
      console.warn(`Volunteer ${volunteerId} attempted to sign up for non-existent event ${eventId}.`);
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
    if (typeof eventData.signUpOpen !== 'boolean' || !eventData.signUpOpen) {
      console.warn(`Volunteer ${volunteerId} attempted to sign up for event ${eventId} with sign-ups closed.`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Sign-ups for this event are currently closed.",
        }),
      };
    }

    // Check if the event has already started
    const eventDate = new Date(eventData.eventDate);
    const currentDate = new Date();

    if (eventDate < currentDate) {
      console.warn(`Volunteer ${volunteerId} attempted to sign up for past event ${eventId}.`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Cannot sign up for events that have already occurred.",
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
      console.warn(`Volunteer ${volunteerId} has already signed up for event ${eventId}.`);
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          error: "You have already signed up for this event.",
        }),
      };
    }

    // Optional: Check event capacity
    if (eventData.availableSpotsExec !== undefined && eventData.approvedExecCount >= eventData.availableSpotsExec) {
      console.warn(`No available executive spots left for event ${eventId}.`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "No available spots for executive volunteers in this event.",
        }),
      };
    }

    if (eventData.availableSpotsStandard !== undefined && eventData.approvedStandardCount >= eventData.availableSpotsStandard) {
      console.warn(`No available standard spots left for event ${eventId}.`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "No available spots for standard volunteers in this event.",
        }),
      };
    }

    // Prepare VolunteerSignUp item
    const newSignUp: VolunteerSignUp = {
      PK: eventId,
      SK: volunteerId,
      signupEpoch: generateEpoch(Date.now()),
      status: 'pending',
      assignedRole: null,
      // reviewedBy and reviewedAt are optional and not set at sign-up
    };

    const putItemParams = {
      TableName: VOLUNTEER_SIGNUP_TABLE_NAME,
      Item: marshall(newSignUp),
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    };

    try {
      await dynamoDb.send(new PutItemCommand(putItemParams));
      console.log(`Volunteer ${volunteerId} successfully signed up for event ${eventId}.`);
    } catch (error: any) {
      if (error.name === "ConditionalCheckFailedException") {
        console.warn(`Volunteer ${volunteerId} attempted duplicate sign-up for event ${eventId}.`);
        return {
          statusCode: 409,
          body: JSON.stringify({
            success: false,
            error: "You have already signed up for this event.",
          }),
        };
      }
      console.error("Error saving VolunteerSignUp:", error);
      throw error;
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: `Volunteer sign-up submitted for event ${eventId}. Awaiting Manager approval.`,
        signupStatus: 'pending',
      }),
    };
  } catch (error: any) {
    console.error("Error in createVolunteerSignUp handler:", error);
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
