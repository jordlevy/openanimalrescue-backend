import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
// @ts-ignore
import { Event } from "/opt/nodejs/types";  // Import the shared Event type

const dynamoDb = new DynamoDBClient({});
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME || "";
const VENUE_TABLE_NAME = process.env.VENUE_TABLE_NAME || "";

export const handler = async (event: any) => {
  try {
    // Parse the request body
    const {
      eventDate,
      managerId,
      availableSpotsExec,
      availableSpotsStandard,
      venueId
    } = JSON.parse(event.body);

    // Validate required fields
    if (
      !eventDate ||
      !managerId ||
      availableSpotsExec === undefined ||
      availableSpotsStandard === undefined ||
      !venueId
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error:
            "Missing required fields: Event Date, Manager ID, availableSpotsExec, availableSpotsStandard, and Venue ID are required.",
        }),
      };
    }

    // Query the venue using venueId as the primary key
    const venueParams = {
      TableName: VENUE_TABLE_NAME,
      Key: marshall({ PK: venueId }),
    };

    const venueResponse = await dynamoDb.send(new GetItemCommand(venueParams));

    // If the venue doesn't exist, return an error
    if (!venueResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: `Venue with ID ${venueId} does not exist.`,
        }),
      };
    }

    // Format event date and create the event's PK
    const eventDateFormatted = new Date(eventDate)
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "");
    const eventPk = `${eventDateFormatted}#${venueId}`;

    // Create the event object
    const newEvent: Event = {
      PK: eventPk,
      managerId,
      eventDate: new Date(eventDate).toISOString(),
      venueId,
      availableSpotsExec,
      availableSpotsStandard,
      signUpOpen: true,
      animalsAssigned: [],
      approvedExecCount: 0,
      approvedStandardCount: 0,
    };

    // Prepare the PutItemCommand for DynamoDB
    const eventParams = {
      TableName: EVENTS_TABLE_NAME,
      Item: marshall(newEvent),
      ConditionExpression: "attribute_not_exists(PK)",
    };

    // Insert the event into the Events table
    await dynamoDb.send(new PutItemCommand(eventParams));

    // Return success response
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: `Event created for venue ${venueId} on ${eventDateFormatted}`,
        eventId: eventPk,
      }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: `Could not create event: ${errorMessage}`,
      }),
    };
  }
};
