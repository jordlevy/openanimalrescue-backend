import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
// @ts-ignore
import { Event } from "/opt/nodejs/types";  // Import the shared Event type

const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = process.env.EVENTS_TABLE_NAME || "";

export const handler = async (event: any) => {
  try {
    // Parse the request body
    const {
      eventDate,
      venueName,
      city,
      managerId,
      availableSpotsExec,
      availableSpotsStandard,
      venueId
    } = JSON.parse(event.body);

    if (!eventDate || !venueName || !city || !managerId || !availableSpotsExec || !availableSpotsStandard || !venueId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Missing required fields: Event Date, Venue, City, Manager, Spots for Execs, Spots for standard volunteers, and Venue are required.",
        }),
      };
    }

    const eventDateFormatted = new Date(eventDate).toISOString().split('T')[0].replace(/-/g, '');
    const pk = `${eventDateFormatted}#${venueName}`;

    // Create the event object
    const newEvent: Event = {
      PK: pk,
      managerId,
      eventDate: new Date(eventDate).toISOString(),
      venueId,
      availableSpotsExec,
      availableSpotsStandard,
      signUpOpen: true, // Default to open for sign-ups
      volunteersExec: [],
      volunteersStandard: [],
      animalsAssigned: []
    };

    // Prepare DynamoDB PutItem command
    const params = {
      TableName: TABLE_NAME,
      Item: marshall(newEvent),
    };

    // Write the new event to DynamoDB
    await dynamoDb.send(new PutItemCommand(params));

    // Return success response
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: `Event created for ${venueName} on ${eventDateFormatted}`,
        eventId: pk,
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
        error: `Could not create event: ${errorMessage}`,
      }),
    };
  }
};
