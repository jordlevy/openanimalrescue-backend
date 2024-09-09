import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
// @ts-ignore
import { Animal } from "/opt/nodejs/types"; // Import the shared Animal type

const dynamoDb = new DynamoDBClient({});
const ssmClient = new SSMClient({});
const TABLE_NAME = process.env.TABLE_NAME || "";
const SPECIES_LIST_SSM_PARAM = process.env.SPECIES_LIST_SSM_PARAM || "";
const SPECIES_INDEX = "species-index";  // New GSI for querying by species

export const handler = async (event: any) => {
  try {
    // Fetch species list from SSM
    const speciesParam = await ssmClient.send(
      new GetParameterCommand({ Name: SPECIES_LIST_SSM_PARAM })
    );
    const speciesList: string[] = JSON.parse(speciesParam.Parameter?.Value || "[]").map((s: string) => s.toLowerCase());

    const pathParams = event.pathParameters || {};
    const speciesParamValue = pathParams.species ? pathParams.species.toLowerCase() : null;

    let animals: Animal[] = [];

    // Case 1: Species parameter provided, validate and query by species
    if (speciesParamValue && speciesList.includes(speciesParamValue)) {
      const params = {
        TableName: TABLE_NAME,
        IndexName: SPECIES_INDEX,  // Use the GSI for species
        KeyConditionExpression: "SK = :species",
        ExpressionAttributeValues: {
          ":species": { S: speciesParamValue },
        },
      };

      const command = new QueryCommand(params);
      const result = await dynamoDb.send(command);

      if (result.Items && result.Items.length > 0) {
        animals = result.Items.map((item) => unmarshall(item) as Animal);
      }

    // Case 2: No species parameter provided, query all species
    } else if (!speciesParamValue) {
      for (const species of speciesList) {
        const params = {
          TableName: TABLE_NAME,
          IndexName: SPECIES_INDEX,  // Use the GSI for species
          KeyConditionExpression: "SK = :species",
          ExpressionAttributeValues: {
            ":species": { S: species },
          },
        };

        const command = new QueryCommand(params);
        const result = await dynamoDb.send(command);

        if (result.Items && result.Items.length > 0) {
          animals.push(...result.Items.map((item) => unmarshall(item) as Animal));
        }
      }
    }

    // Return animals if found
    if (animals.length > 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, data: animals }),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: speciesParamValue ? `No animals found for species: ${speciesParamValue}` : "No animals found.",
        }),
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
        error: `Could not retrieve animals: ${errorMessage}`,
      }),
    };
  }
};
