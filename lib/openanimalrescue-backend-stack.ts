import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dotenv from "dotenv";
import * as path from "path";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";

// Load environment variables
dotenv.config();

const { version } = require("../package.json");

const standardiseOrgName = (org: string | undefined): string => {
  if (!org) {
    return "defaultorg";
  }
  return org.toLowerCase().replace(/\s+/g, "");
};

const ORG = standardiseOrgName(process.env.ORG || "defaultorg");
const STAGE = process.env.STAGE || "dev";

// Define naming convention: {org}-{service}-{stage}
const resourceName = (service: string) => `oar-${ORG}-${service}-${STAGE}`;

export class OpenanimalrescueBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, resourceName("userpool"), {
      userPoolName: resourceName("userpool"),
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: false },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
    });
    this.addTags(userPool, "cognito-userpool");

    // Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(
      this,
      resourceName("userpool-client"),
      {
        userPool,
        generateSecret: false,
      }
    );
    this.addTags(userPoolClient, "cognito-userpool-client");

    // Cognito Identity Pool
    const identityPool = new cognito.CfnIdentityPool(
      this,
      resourceName("identity-pool"),
      {
        allowUnauthenticatedIdentities: false,
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName,
          },
        ],
      }
    );

    // IAM roles for authenticated and unauthenticated users
    const authenticatedRole = new iam.Role(this, resourceName("auth-role"), {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    const unauthenticatedRole = new iam.Role(
      this,
      resourceName("unauth-role"),
      {
        assumedBy: new iam.FederatedPrincipal(
          "cognito-identity.amazonaws.com",
          {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": identityPool.ref,
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "unauthenticated",
            },
          },
          "sts:AssumeRoleWithWebIdentity"
        ),
      }
    );

    this.addTags(authenticatedRole, "iam-auth-role");
    this.addTags(unauthenticatedRole, "iam-unauth-role");

    new cognito.CfnIdentityPoolRoleAttachment(
      this,
      resourceName("identity-pool-role-attachment"),
      {
        identityPoolId: identityPool.ref,
        roles: {
          authenticated: authenticatedRole.roleArn,
          unauthenticated: unauthenticatedRole.roleArn,
        },
      }
    );

    // Animals Table
    const animalsTable = new dynamodb.Table(this, resourceName("animals"), {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // PK: uuid
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },      // SK: species
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName("animals"),
    });
    this.addTags(animalsTable, "dynamodb-animals");

    // Global Secondary Index (GSI) for animals to query by UUID
    animalsTable.addGlobalSecondaryIndex({
      indexName: "breed-index",  // Index name for breed GSI
      partitionKey: { name: "breed", type: dynamodb.AttributeType.STRING }, // GSI PK: breed
      projectionType: dynamodb.ProjectionType.ALL,  // Project all attributes
    });

    animalsTable.addGlobalSecondaryIndex({
      indexName: "name-index",  // Name of the index for querying by name
      partitionKey: { name: "name", type: dynamodb.AttributeType.STRING }, // GSI PK: name
      projectionType: dynamodb.ProjectionType.ALL,  // Project all attributes
    });
  
    animalsTable.addGlobalSecondaryIndex({
      indexName: "species-index",
      partitionKey: { name: "SK", type: dynamodb.AttributeType.STRING }, // SK (species)
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Events Table
    const eventsTable = new dynamodb.Table(this, resourceName("events"), {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // PK: locationID
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING }, // SK: epoch (event timestamp)
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName("events"),
    });
    this.addTags(eventsTable, "dynamodb-events");

    // Adoptions Table
    const adoptionsTable = new dynamodb.Table(this, resourceName("adoptions"), {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // PK: CognitoID (user ID)
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING }, // SK: epoch (adoption timestamp)
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName("adoptions"),
    });
    this.addTags(adoptionsTable, "dynamodb-adoptions");

    // Users Table
    const usersTable = new dynamodb.Table(this, resourceName("users"), {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // PK: CognitoID
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName("users"),
    });
    this.addTags(usersTable, "dynamodb-users");

    // S3 bucket for data storage
    const s3Bucket = new s3.Bucket(this, resourceName("bucket"), {
      bucketName: resourceName("bucket"),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    this.addTags(s3Bucket, "s3");

    // SSM Parameter for species list
    const speciesListParam = new ssm.StringParameter(
      this,
      resourceName("species-list-ssm"),
      {
        parameterName: resourceName("species-list"),
        stringValue: JSON.stringify(["dog", "cat", "rabbit"]), // Default list of species, update as needed
        description: "A list of species used in the system",
      }
    );
    this.addTags(speciesListParam, "ssm-species-list");

    // API Gateway setup
    const api = new apigateway.RestApi(this, resourceName("api"), {
      restApiName: resourceName("api"),
      deployOptions: { stageName: STAGE },
    });
    this.addTags(api, "apigateway");

    // Lambda Layer for shared node modules
    const sharedUtilsLayer = new lambda.LayerVersion(this, "SharedUtilsLayer", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../layers/shared-utils")
      ),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Shared utilities for Node.js Lambda functions (e.g., uuid)",
    });
    this.addTags(sharedUtilsLayer, "lambda-layer");

    const sharedTypesLayer = new lambda.LayerVersion(this, "SharedTypesLayer", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../layers/shared-types")
      ),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Shared types for Node.js Lambda functions",
    });

    // Health Lambda function
    const healthLambda = this.createLambda(
      api,
      animalsTable,
      "health",
      "GET",
      "health",
      [sharedUtilsLayer],
      {
        VERSION: version,
        STAGE: STAGE,
      }
    );

    // Create the main CRUD Lambdas for individual animals
    const getAnimalLambda = this.createLambda(
      api,
      animalsTable,
      "getAnimal",
      "GET",
      "animal/{uuid}",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        SPECIES_LIST_SSM_PARAM: speciesListParam.parameterName,
      }
    );

    const createAnimalLambda = this.createLambda(
      api,
      animalsTable,
      "createAnimal",
      "POST",
      "animal/{uuid}",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        SPECIES_LIST_SSM_PARAM: speciesListParam.parameterName,
      }
    );
    // Add required permissions for SSM Parameter access
    createAnimalLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [speciesListParam.parameterArn], // Ensure correct parameter ARN
      })
    );

    const updateAnimalLambda = this.createLambda(
      api,
      animalsTable,
      "updateAnimal",
      "PATCH",
      "animal/{uuid}",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        SPECIES_LIST_SSM_PARAM: speciesListParam.parameterName,
      }
    );
    const deleteAnimalLambda = this.createLambda(
      api,
      animalsTable,
      "deleteAnimal",
      "DELETE",
      "animal/{uuid}",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        SPECIES_LIST_SSM_PARAM: speciesListParam.parameterName,
      }
    );

    // Species-based animals routes (now under /species/{species}/animals)
    const getAnimalsBySpeciesLambda = this.createLambda(
      api,
      animalsTable,
      "getAnimals",
      "GET",
      "species/{species}/animals", // New unified route for filtering by species
      [sharedUtilsLayer, sharedTypesLayer],
      {
        SPECIES_LIST_SSM_PARAM: speciesListParam.parameterName,
      }
    );
    getAnimalsBySpeciesLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [speciesListParam.parameterArn],
      })
    );

    // Output resources created
    this.addOutputs({
      UserPoolId: userPool.userPoolId,
      UserPoolClientId: userPoolClient.userPoolClientId,
      IdentityPoolId: identityPool.ref,
      AnimalsTable: animalsTable.tableName,
      S3Bucket: s3Bucket.bucketName,
      APIGatewayURL: api.url,
    });
  }

  // Helper method to create Lambda functions with routes
  createLambda(
    api: apigateway.RestApi,
    table: dynamodb.Table,
    functionName: string,
    method: string,
    path: string,
    layers: lambda.ILayerVersion[], // Accept an array of layers
    extraEnv: Record<string, string> = {}
  ) {
    const func = new lambda.Function(
      this,
      resourceName(`${functionName}-lambda`),
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset("lambda"),
        handler: `${functionName}.handler`,
        environment: {
          TABLE_NAME: table.tableName,
          ...extraEnv,
        },
        timeout: cdk.Duration.seconds(12),
        layers: layers,
      }
    );
    this.addTags(func, `lambda-${functionName}`);
    table.grantReadWriteData(func);
    const resource = api.root.resourceForPath(path);
    resource.addMethod(method, new apigateway.LambdaIntegration(func));
    return func;
  }

  // Class-level method to add tags to resources
  addTags(resource: cdk.Resource, service: string) {
    cdk.Tags.of(resource).add("organisation", ORG);
    cdk.Tags.of(resource).add("stage", STAGE);
    cdk.Tags.of(resource).add("version", version);
    cdk.Tags.of(resource).add("service", service);
  }

  // Helper method to add outputs
  addOutputs(outputs: Record<string, string>) {
    for (const [key, value] of Object.entries(outputs)) {
      new cdk.CfnOutput(this, key, { value });
    }
  }
}
