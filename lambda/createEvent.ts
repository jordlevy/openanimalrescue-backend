import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
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

    const venuePk = `${venueName}#${city}`;

    const venueParams = {
      TableName: VENUE_TABLE_NAME,
      Key: marshall({ PK: venuePk }),
    };

    const venueResponse = await dynamoDb.send(new GetItemCommand(venueParams));

    if (!venueResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: `Venue ${venueName} in ${city} does not exist.`,
        }),
      };
    }

    const eventDateFormatted = new Date(eventDate).toISOString().split('T')[0].replace(/-/g, '');
    const eventPk = `${eventDateFormatted}#${venueName}`;

    const newEvent: Event = {
      PK: eventPk,
      managerId,
      eventDate: new Date(eventDate).toISOString(),
      venueId,
      availableSpotsExec,
      availableSpotsStandard,
      signUpOpen: true,
      volunteersExec: [],
      volunteersStandard: [],
      animalsAssigned: []
    };

    const eventParams = {
      TableName: EVENTS_TABLE_NAME,
      Item: marshall(newEvent),
    };

    await dynamoDb.send(new PutItemCommand(eventParams));

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: `Event created for ${venueName} on ${eventDateFormatted}`,
        eventId: eventPk,
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
