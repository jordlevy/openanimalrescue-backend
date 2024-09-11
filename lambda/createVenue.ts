import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
// @ts-ignore
import { Venue } from "/opt/nodejs/types";  // Import the shared Venue type

const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = process.env.VENUE_TABLE_NAME || "";

export const handler = async (event: any) => {
  try {

    const { name, city, suburb, address, latitude, longitude, description } = JSON.parse(event.body);

    if (!name || !city || !suburb || !address) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Missing required fields: Name, City, Suburb, and Address must be provided.",
        }),
      };
    }

    const pk = `${name}#${city}`;

    const newVenue: Venue = {
      PK: pk, // PK: venueName#City
      suburb,
      address,
      coordinates: {
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
      description: description ?? "No description provided"
    };

    const params = {
      TableName: TABLE_NAME,
      Item: marshall(newVenue),
    };

    await dynamoDb.send(new PutItemCommand(params));

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: `${name} in ${city} added successfully!`,
        VenueId: pk,
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
        error: `Could not create Venue: ${errorMessage}`,
      }),
    };
  }
};