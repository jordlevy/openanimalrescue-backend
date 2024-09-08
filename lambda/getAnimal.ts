import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
// @ts-ignore
import { Animal } from "/opt/nodejs/types";

const dynamoDb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME || "";

export const handler = async (event: any) => {
  const { uuid } = event.pathParameters;

  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :uuid",
    ExpressionAttributeValues: {
      ":uuid": { S: uuid },
    },
  };

  try {
    const result = await dynamoDb.send(new QueryCommand(params));
    if (result.Items && result.Items.length > 0) {
      const animal: Animal = unmarshall(result.Items[0]) as Animal;  // Cast the unmarshalled result as Animal

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: animal,
        }),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: "Animal not found" }),
      };
    }
  } catch (error) {
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: `Could not fetch animal: ${errorMessage}`,
      }),
    };
  }
};
