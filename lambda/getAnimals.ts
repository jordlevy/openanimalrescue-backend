import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
// @ts-ignore
import { Animal } from "/opt/nodejs/types"; // Import the shared Animal type

const dynamoDb = new DynamoDBClient({});
const ssmClient = new SSMClient({});
const TABLE_NAME = process.env.TABLE_NAME || "";
const SPECIES_LIST_SSM_PARAM = process.env.SPECIES_LIST_SSM_PARAM || "";

export const handler = async (event: any) => {
  try {
    // Fetch species list from SSM
    const speciesParam = await ssmClient.send(
      new GetParameterCommand({ Name: SPECIES_LIST_SSM_PARAM })
    );
    const speciesList: string[] = JSON.parse(
      speciesParam.Parameter?.Value || "[]"
    ).map((s: string) => s.toLowerCase());

    const pathParams = event.pathParameters || {};
    const speciesParamValue = pathParams.species
      ? pathParams.species.toLowerCase()
      : null;

    let animals: Animal[] = [];

    // Case 1: No species parameter provided, fetch all animals
    if (!speciesParamValue) {
      const params = {
        TableName: TABLE_NAME,
        IndexName: "species-index", // Use the GSI to query by breed
      };

      const command = new QueryCommand(params);
      const result = await dynamoDb.send(command);

      if (result.Items && result.Items.length > 0) {
        animals = result.Items.map((item) => unmarshall(item) as Animal);
      }

      // Case 2: Species parameter provided, validate and query by species (Sort Key)
    } else if (speciesList.includes(speciesParamValue)) {
      const params = {
        TableName: TABLE_NAME,
        IndexName: "species-index", // Use the GSI to query by breed
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

      // Case 3: Invalid species parameter
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: `Invalid species parameter: ${speciesParamValue}`,
        }),
      };
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
          error: speciesParamValue
            ? `No animals found for species: ${speciesParamValue}`
            : "No animals found.",
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
