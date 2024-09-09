import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
// @ts-ignore
import { Animal } from "/opt/nodejs/types"; // Shared Animal type

const dynamoDb = new DynamoDBClient({});
const ssmClient = new SSMClient({});
const TABLE_NAME = process.env.TABLE_NAME || "";
const SPECIES_LIST_SSM_PARAM = process.env.SPECIES_LIST_SSM_PARAM || "";
const SPECIES_INDEX = "species-index";
const BREED_INDEX = "breed-index";
const NAME_INDEX = "name-index";

const logQueryDetails = (species: string | null, breed: string | null, name: string | null) => {
    console.log("Search Query:", { species, breed, name });
  };
  
  export const handler = async (event: any) => {
    try {
      // Fetch species list from SSM
      const speciesParam = await ssmClient.send(
        new GetParameterCommand({ Name: SPECIES_LIST_SSM_PARAM })
      );
      const speciesList: string[] = JSON.parse(speciesParam.Parameter?.Value || "[]").map((s: string) => s.toLowerCase());
      console.log("Valid species list:", speciesList);
  
      const queryParams = event.queryStringParameters || {};
      const species = queryParams.species ? queryParams.species.toLowerCase() : null;
      const breed = queryParams.breed ? queryParams.breed.toLowerCase() : null;
      const name = queryParams.name ? queryParams.name.toLowerCase() : null;
  
      // Log query parameters
      logQueryDetails(species, breed, name);
  
      let animals: Animal[] = [];
      let params;

      // If no query parameters are provided, return an error
      if (!species && !breed && !name) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            query: queryParams,
            error: "Please provide at least one query parameter (species, breed, or name)." }),
        };
      }
      
      // Case 1: Validate species and return error if not valid
      if (species && !speciesList.includes(species)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            query: queryParams,
            error: `Invalid species '${species}' provided. Here are the valid species:`,
            validSpecies: speciesList,
          }),
        };
      }
  
      // Case 2: Query by species if valid
      if (species) {
        params = {
          TableName: TABLE_NAME,
          IndexName: SPECIES_INDEX,
          KeyConditionExpression: "SK = :species",
          ExpressionAttributeValues: {
            ":species": { S: species },
          },
        };
  
        const command = new QueryCommand(params);
        const result = await dynamoDb.send(command);
  
        if (result.Items && result.Items.length > 0) {
          animals = result.Items.map((item) => unmarshall(item) as Animal);
        }
  
        // Apply further filtering for breed and name in Lambda (in-memory)
        if (breed) {
          animals = animals.filter(animal => animal.breed.toLowerCase() === breed);
        }
        if (name) {
          animals = animals.filter(animal => animal.name.toLowerCase() === name);
        }
  
      // Case 3: Query by breed only (if species not provided)
      } else if (breed) {
        params = {
          TableName: TABLE_NAME,
          IndexName: BREED_INDEX,
          KeyConditionExpression: "breed = :breed",
          ExpressionAttributeValues: {
            ":breed": { S: breed },
          },
        };
  
        const command = new QueryCommand(params);
        const result = await dynamoDb.send(command);
  
        if (result.Items && result.Items.length > 0) {
          animals = result.Items.map((item) => unmarshall(item) as Animal);
        }
  
        // Further filter by name if provided
        if (name) {
          animals = animals.filter(animal => animal.name.toLowerCase() === name);
        }
  
      // Case 4: Query by name only (if neither species nor breed is provided)
      } else if (name) {
        params = {
          TableName: TABLE_NAME,
          IndexName: NAME_INDEX,
          KeyConditionExpression: "name = :name",
          ExpressionAttributeValues: {
            ":name": { S: name },
          },
        };
  
        const command = new QueryCommand(params);
        const result = await dynamoDb.send(command);
  
        if (result.Items && result.Items.length > 0) {
          animals = result.Items.map((item) => unmarshall(item) as Animal);
        }
      }
  
      // Return animals if found
      if (animals.length > 0) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true, 
            query: queryParams,
            data: animals }),
        };
      } else {
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false, 
            query: queryParams,
            error: "No animals found." }),
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
          query: event.queryStringParameters,
          error: errorMessage }),
      };
    }
  };
  