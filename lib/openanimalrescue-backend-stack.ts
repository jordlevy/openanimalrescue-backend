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
import { CfnJson } from "aws-cdk-lib";

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
  private userPool: cognito.UserPool;
  private cognitoAuthorizer: apigateway.CognitoUserPoolsAuthorizer; // Shared Authorizer

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ============================
    // Cognito User Pool and Client
    // ============================

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, resourceName("userpool"), {
      userPoolName: resourceName("userpool"),
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.REQUIRED, // Require MFA for all users
      mfaSecondFactor: {
        sms: true, // Enable SMS MFA
        otp: true, // Enable TOTP MFA
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
    });
    this.addTags(this.userPool, "cognito-userpool");

    // Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(
      this,
      resourceName("userpool-client"),
      {
        userPool: this.userPool,
        generateSecret: false,
        authFlows: {
          adminUserPassword: true,
          userSrp: true,
          custom: true,
        },
        preventUserExistenceErrors: true,
      }
    );
    this.addTags(userPoolClient, "cognito-userpool-client");

    // Cognito Identity Pool
    const identityPool = new cognito.CfnIdentityPool(
      this,
      resourceName("identity-pool"),
      {
        allowUnauthenticatedIdentities: true, // Allow unauthenticated identities for public access
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: this.userPool.userPoolProviderName,
          },
        ],
      }
    );

    // ============================
    // Shared Cognito Authorizer
    // ============================

    // Initialize the shared Cognito Authorizer
    this.cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      resourceName("shared-authorizer"),
      {
        cognitoUserPools: [this.userPool],
        authorizerName: resourceName("shared-authorizer"),
        identitySource: "method.request.header.Authorization", // Default identity source
      }
    );
    this.addTags(this.cognitoAuthorizer, "apigateway-authorizer");

    // ============================
    // DynamoDB Tables
    // ============================

    // Array to hold DynamoDB tables
    const dynamoTables: dynamodb.Table[] = [];

    // Animals Table
    const animalsTable = new dynamodb.Table(this, resourceName("animals"), {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // PK: uuid
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING }, // SK: species
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName("animals"),
    });
    this.addTags(animalsTable, "dynamodb-animals");
    dynamoTables.push(animalsTable);

    // Global Secondary Indexes for Animals Table
    animalsTable.addGlobalSecondaryIndex({
      indexName: "breed-index",
      partitionKey: { name: "breed", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    animalsTable.addGlobalSecondaryIndex({
      indexName: "name-index",
      partitionKey: { name: "name", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    animalsTable.addGlobalSecondaryIndex({
      indexName: "species-index",
      partitionKey: { name: "SK", type: dynamodb.AttributeType.STRING }, // SK (species)
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Events Table
    const eventsTable = new dynamodb.Table(this, resourceName("events"), {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // PK: DDMMYYYY#VenueName
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName("events"),
    });
    this.addTags(eventsTable, "dynamodb-events");
    dynamoTables.push(eventsTable);

    // Venues Table
    const venuesTable = new dynamodb.Table(this, resourceName("venues"), {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // PK: venueName#City
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName("venues"),
    });
    this.addTags(venuesTable, "dynamodb-venues");
    dynamoTables.push(venuesTable);

    // Adoptions Table
    const adoptionsTable = new dynamodb.Table(this, resourceName("adoptions"), {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // PK: CognitoID (user ID)
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING }, // SK: epoch (adoption timestamp)
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName("adoptions"),
    });
    this.addTags(adoptionsTable, "dynamodb-adoptions");
    dynamoTables.push(adoptionsTable);

    // Users Table
    const usersTable = new dynamodb.Table(this, resourceName("users"), {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // PK: CognitoID
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName("users"),
    });
    this.addTags(usersTable, "dynamodb-users");
    dynamoTables.push(usersTable);

    // Global Secondary Index for Users Table
    usersTable.addGlobalSecondaryIndex({
      indexName: "emails-index",
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // VolunteerSignUp Table
    const volunteerSignUpTable = new dynamodb.Table(
      this,
      resourceName("volunteer-signups"),
      {
        partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, // Event ID
        sortKey: { name: "SK", type: dynamodb.AttributeType.STRING }, // Volunteer ID
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        tableName: resourceName("volunteer-signups"),
      }
    );
    this.addTags(volunteerSignUpTable, "dynamodb-volunteer-signups");
    dynamoTables.push(volunteerSignUpTable);

    // Collect ARNs of all tables
    const tableArns = dynamoTables.flatMap((table) => [
      table.tableArn, // Table ARN
      `${table.tableArn}/*`, // Items in the table
    ]);

    // ============================
    // IAM Roles and Policies
    // ============================

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

    // Staff Role
    const staffRole = new iam.Role(this, resourceName("staff-role"), {
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
    this.addTags(staffRole, "iam-staff-role");

    // Attach policies to staffRole
    staffRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ],
        resources: tableArns,
      })
    );

    // Managers Role
    const managersRole = new iam.Role(this, resourceName("managers-role"), {
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
    this.addTags(managersRole, "iam-managers-role");

    // Attach policies to managersRole
    managersRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:*"], // Full DynamoDB access
        resources: tableArns,
      })
    );

    // Allow managers to manage user groups
    managersRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminDeleteUser",
        ],
        resources: [this.userPool.userPoolArn],
      })
    );

    // ============================
    // Cognito User Pool Groups
    // ============================

    // Create the "Staff" group
    const staffGroup = new cognito.CfnUserPoolGroup(
      this,
      resourceName("staff-group"),
      {
        userPoolId: this.userPool.userPoolId,
        groupName: "Staff",
        description: "Group for staff users with CRUD permissions",
        roleArn: staffRole.roleArn, // Assign the role to the group
      }
    );

    // Create the "Managers" group
    const managersGroup = new cognito.CfnUserPoolGroup(
      this,
      resourceName("managers-group"),
      {
        userPoolId: this.userPool.userPoolId,
        groupName: "Managers",
        description: "Group for manager users with elevated permissions",
        roleArn: managersRole.roleArn, // Assign the role to the group
      }
    );

    // ============================
    // Identity Pool Role Attachment with Role Mappings
    // ============================

    const cognitoPrincipalTag = `${this.userPool.userPoolProviderName}:${userPoolClient.userPoolClientId}`;

    const roleMappings = new CfnJson(this, resourceName("roleMappings"), {
      value: {
        [cognitoPrincipalTag]: {
          Type: "Rules",
          AmbiguousRoleResolution: "AuthenticatedRole",
          RulesConfiguration: {
            Rules: [
              {
                Claim: "cognito:groups",
                MatchType: "Contains",
                Value: "Managers",
                RoleARN: managersRole.roleArn,
              },
              {
                Claim: "cognito:groups",
                MatchType: "Contains",
                Value: "Staff",
                RoleARN: staffRole.roleArn,
              },
            ],
          },
        },
      },
    });

    new cognito.CfnIdentityPoolRoleAttachment(
      this,
      resourceName("identity-pool-role-attachment"),
      {
        identityPoolId: identityPool.ref,
        roles: {
          authenticated: authenticatedRole.roleArn,
          unauthenticated: unauthenticatedRole.roleArn,
        },
        roleMappings: roleMappings.value,
      }
    );

    // ============================
    // Other Resources
    // ============================

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

    // ============================
    // Lambda Layers
    // ============================

    // Lambda Layer for shared node modules
    const sharedUtilsLayer = new lambda.LayerVersion(
      this,
      "SharedUtilsLayer",
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../layers/shared-utils")
        ),
        compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
        description: "Shared utilities for Node.js Lambda functions (e.g., uuid)",
      }
    );
    this.addTags(sharedUtilsLayer, "lambda-layer");

    // Lambda Layer for shared types
    const sharedTypesLayer = new lambda.LayerVersion(
      this,
      "SharedTypesLayer",
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../layers/shared-types")
        ),
        compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
        description: "Shared types for Node.js Lambda functions",
      }
    );
    this.addTags(sharedTypesLayer, "lambda-types-layer");

    // ============================
    // Lambda Functions
    // ============================

    // Health Lambda function
    const healthLambda = this.createLambda(
      api,
      [animalsTable],
      "health",
      "GET",
      "health",
      [sharedUtilsLayer],
      {
        VERSION: version,
        STAGE: STAGE,
      },
      false // Public access
    );

    // Get Animal Lambda (Public access)
    const getAnimalLambda = this.createLambda(
      api,
      [animalsTable],
      "getAnimal",
      "GET",
      "animal/{uuid}",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        SPECIES_LIST_SSM_PARAM: speciesListParam.parameterName,
      },
      false // Public access
    );

    // Create Animal Lambda (Authenticated access)
    const createAnimalLambda = this.createLambda(
      api,
      [animalsTable],
      "createAnimal",
      "POST",
      "animal/{uuid}",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        SPECIES_LIST_SSM_PARAM: speciesListParam.parameterName,
      },
      true // Authenticated access
    );
    createAnimalLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [speciesListParam.parameterArn],
      })
    );

    // Update Animal Lambda (Authenticated access)
    const updateAnimalLambda = this.createLambda(
      api,
      [animalsTable],
      "updateAnimal",
      "PATCH",
      "animal/{uuid}",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        SPECIES_LIST_SSM_PARAM: speciesListParam.parameterName,
      },
      true // Authenticated access
    );

    // Delete Animal Lambda (Authenticated access)
    const deleteAnimalLambda = this.createLambda(
      api,
      [animalsTable],
      "deleteAnimal",
      "DELETE",
      "animal/{uuid}",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        SPECIES_LIST_SSM_PARAM: speciesListParam.parameterName,
      },
      true // Authenticated access
    );

    // Get Animals Lambda (Public access)
    const getAnimalsLambda = this.createLambda(
      api,
      [animalsTable],
      "getAnimals",
      "GET",
      "animals",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        SPECIES_LIST_SSM_PARAM: speciesListParam.parameterName,
      },
      false // Public access
    );
    getAnimalsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [speciesListParam.parameterArn],
      })
    );

    // Create Event Lambda (Authenticated access)
    const createEventLambda = this.createLambda(
      api,
      [eventsTable, venuesTable],
      "createEvent",
      "POST",
      "event",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        EVENTS_TABLE_NAME: eventsTable.tableName,
        VENUE_TABLE_NAME: venuesTable.tableName,
      },
      true // Authenticated access
    );

    // Create Venue Lambda (Authenticated access)
    const createVenueLambda = this.createLambda(
      api,
      [venuesTable],
      "createVenue",
      "POST",
      "venue",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        TABLE_NAME: venuesTable.tableName,
      },
      true // Authenticated access
    );

    // Volunteer Management Lambdas

    // Create Volunteer Signup Lambda (Authenticated users)
    const createVolunteerSignupLambda = this.createLambda(
      api,
      [volunteerSignUpTable, eventsTable],
      "createVolunteerSignup",
      "POST",
      "volunteer/signup",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        VOLUNTEER_SIGNUP_TABLE_NAME: volunteerSignUpTable.tableName,
        EVENTS_TABLE_NAME: eventsTable.tableName,
      },
      true // Requires authentication
    );

    // Confirm Volunteer Lambda (Managers only)
    const confirmVolunteerLambda = this.createLambda(
      api,
      [volunteerSignUpTable, eventsTable],
      "confirmVolunteer",
      "POST",
      "volunteer/confirm",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        VOLUNTEER_SIGNUP_TABLE_NAME: volunteerSignUpTable.tableName,
        EVENTS_TABLE_NAME: eventsTable.tableName,
      },
      true // Requires authentication
    );

    // Get Volunteers for Event Lambda (Managers only)
    const getVolunteersForEventLambda = this.createLambda(
      api,
      [volunteerSignUpTable],
      "getVolunteersForEvent",
      "GET",
      "event/{eventId}/volunteers",
      [sharedUtilsLayer, sharedTypesLayer],
      {
        VOLUNTEER_SIGNUP_TABLE_NAME: volunteerSignUpTable.tableName,
      },
      true // Requires authentication
    );

    // Manage User Groups Lambda (Managers only)
    const manageUserGroupsLambda = this.createLambda(
      api,
      [],
      "manageUserGroups",
      "POST",
      "user/group",
      [sharedUtilsLayer],
      {
        USER_POOL_ID: this.userPool.userPoolId,
      },
      true // Requires authentication
    );
    // Grant permissions to manage Cognito User Pool
    manageUserGroupsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminDeleteUser",
        ],
        resources: [this.userPool.userPoolArn],
      })
    );

    // ============================
    // Outputs
    // ============================

    // Output resources created
    this.addOutputs({
      UserPoolId: this.userPool.userPoolId,
      UserPoolClientId: userPoolClient.userPoolClientId,
      IdentityPoolId: identityPool.ref,
      AnimalsTable: animalsTable.tableName,
      EventsTable: eventsTable.tableName,
      VenuesTable: venuesTable.tableName,
      AdoptionsTable: adoptionsTable.tableName,
      UsersTable: usersTable.tableName,
      VolunteerSignUpsTable: volunteerSignUpTable.tableName,
      S3Bucket: s3Bucket.bucketName,
      APIGatewayURL: api.url,
    });
  }

  /**
   * Creates a Lambda function and integrates it with API Gateway.
   *
   * @param api - The API Gateway RestApi instance.
   * @param tables - Array of DynamoDB tables to grant permissions.
   * @param functionName - Name of the Lambda function.
   * @param method - HTTP method (GET, POST, etc.).
   * @param path - API Gateway resource path.
   * @param layers - Array of Lambda layers to attach.
   * @param extraEnv - Additional environment variables.
   * @param authorized - Whether the endpoint requires authorization.
   * @returns The created Lambda function.
   */
  createLambda(
    api: apigateway.RestApi,
    tables: dynamodb.Table[],
    functionName: string,
    method: string,
    path: string,
    layers: lambda.ILayerVersion[],
    extraEnv: Record<string, string> = {},
    authorized: boolean = false
  ) {
    const func = new lambda.Function(
      this,
      resourceName(`${functionName}-lambda`),
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset("lambda"),
        handler: `${functionName}.handler`,
        environment: {
          ...extraEnv,
        },
        timeout: cdk.Duration.seconds(12),
        layers: layers,
      }
    );
    this.addTags(func, `lambda-${functionName}`);

    // Grant read/write permissions to DynamoDB tables
    tables.forEach((table) => {
      table.grantReadWriteData(func);
    });

    // Build the API resource path
    const pathParts = path.split("/").filter((p) => p !== "");
    let resource = api.root;
    for (const part of pathParts) {
      if (resource.getResource(part)) {
        // If the resource already exists, reuse it
        resource = resource.getResource(part) as apigateway.Resource;
      } else {
        // Otherwise, create a new resource
        resource = resource.addResource(part);
      }
    }

    const integration = new apigateway.LambdaIntegration(func);

    const methodOptions: apigateway.MethodOptions = authorized
      ? {
          authorizer: this.cognitoAuthorizer, // Use the shared authorizer
          authorizationType: apigateway.AuthorizationType.COGNITO,
        }
      : {};

    resource.addMethod(method, integration, methodOptions);
    return func;
  }

  /**
   * Adds tags to an AWS resource.
   *
   * @param resource - The AWS resource to tag.
   * @param service - The service name for tagging.
   */
  addTags(resource: cdk.Resource, service: string) {
    cdk.Tags.of(resource).add("organisation", ORG);
    cdk.Tags.of(resource).add("stage", STAGE);
    cdk.Tags.of(resource).add("version", version);
    cdk.Tags.of(resource).add("service", service);
  }

  /**
   * Adds CloudFormation outputs.
   *
   * @param outputs - A record of output keys and values.
   */
  addOutputs(outputs: Record<string, string>) {
    for (const [key, value] of Object.entries(outputs)) {
      new cdk.CfnOutput(this, key, { value });
    }
  }
}
