import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';

// Load environment variables
dotenv.config();

const { version } = require('../package.json');

const standardiseOrgName = (org: string | undefined): string => {
  if (!org) {
    return 'defaultorg';
  }
  return org.toLowerCase().replace(/\s+/g, '');
};

let ORG = process.env.ORG || 'defaultorg';
ORG = standardiseOrgName(ORG);
const STAGE = process.env.STAGE || 'dev';

// Define naming convention: {org}-{service}-{stage}
const resourceName = (service: string) => `oar-${ORG}-${service}-${STAGE}`;

export class OpenanimalrescueBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Function to add tags to AWS resources
    const addTags = (resource: cdk.Resource, service: string) => {
      cdk.Tags.of(resource).add('organisation', ORG);
      cdk.Tags.of(resource).add('stage', STAGE);
      cdk.Tags.of(resource).add('version', version);
      cdk.Tags.of(resource).add('service', service);
    };

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, resourceName('userpool'), {
      userPoolName: resourceName('userpool'),
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: { email: false },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
    });
    addTags(userPool, 'cognito-userpool');

    // Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, resourceName('userpool-client'), {
      userPool,
      generateSecret: false,
    });
    addTags(userPoolClient, 'cognito-userpool-client');

    // Cognito Identity Pool (Optional, if you need to use federated identities)
    const identityPool = new cognito.CfnIdentityPool(this, resourceName('identity-pool'), {
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // IAM roles for authenticated and unauthenticated users
    const authenticatedRole = new iam.Role(this, resourceName('auth-role'), {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          'StringEquals': {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    const unauthenticatedRole = new iam.Role(this, resourceName('unauth-role'), {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          'StringEquals': {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    addTags(authenticatedRole, 'iam-auth-role');
    addTags(unauthenticatedRole, 'iam-unauth-role');

    // Attach authenticated role to the identity pool
    new cognito.CfnIdentityPoolRoleAttachment(this, resourceName('identity-pool-role-attachment'), {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
        unauthenticated: unauthenticatedRole.roleArn,
      },
    });

    // DynamoDB tables (same as before)
    const animalsTable = new dynamodb.Table(this, resourceName('animals'), {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // PK: species
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // SK: breed
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName('animals'),
    });
    addTags(animalsTable, 'dynamodb-animals');

    const eventsTable = new dynamodb.Table(this, resourceName('events'), {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },  // PK: locationID
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // SK: epoch
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName('events'),
    });
    addTags(eventsTable, 'dynamodb-events');

    const adoptionsTable = new dynamodb.Table(this, resourceName('adoptions'), {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },  // PK: CognitoID (user ID)
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // SK: epoch (adoption timestamp)
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName('adoptions'),
    });
    addTags(adoptionsTable, 'dynamodb-adoptions');

    const usersTable = new dynamodb.Table(this, resourceName('users'), {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },  // PK: CognitoID
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName('users'),
    });
    addTags(usersTable, 'dynamodb-users');

    // S3 bucket for data storage
    const s3Bucket = new s3.Bucket(this, resourceName('bucket'), {
      bucketName: resourceName('bucket'),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Adjust based on lifecycle needs
      autoDeleteObjects: true,                  // Adjust based on your use case
    });
    addTags(s3Bucket, 's3');

    // API Gateway setup
    const api = new apigateway.RestApi(this, resourceName('api'), {
      restApiName: resourceName('api'),
      deployOptions: {
        stageName: STAGE,
      },
    });
    addTags(api, 'apigateway');

    // Lambda Layer for shared node modules
    const lambdaLayer = new lambda.LayerVersion(this, 'SharedUtilsLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../layers/shared-utils')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Shared utilities for Node.js Lambda functions',
    });
    addTags(lambdaLayer, 'lambda-layer');

    // Health Lambda function
    const healthLambda = new lambda.Function(this, resourceName('health-lambda'), {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'health.handler',
      environment: {
        VERSION: version,
        STAGE: STAGE,
      },
      layers: [lambdaLayer],
    });
    addTags(healthLambda, 'lambda');

    // Health API route
    const healthLambdaIntegration = new apigateway.LambdaIntegration(healthLambda);
    const healthRoute = api.root.addResource('health');
    healthRoute.addMethod('GET', healthLambdaIntegration);

    // Output resources created
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
    });
    new cdk.CfnOutput(this, 'AnimalsTable', {
      value: animalsTable.tableName,
    });
    new cdk.CfnOutput(this, 'EventsTable', {
      value: eventsTable.tableName,
    });
    new cdk.CfnOutput(this, 'AdoptionsTable', {
      value: adoptionsTable.tableName,
    });
    new cdk.CfnOutput(this, 'UsersTable', {
      value: usersTable.tableName,
    });
    new cdk.CfnOutput(this, 'S3Bucket', {
      value: s3Bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'APIGatewayURL', {
      value: api.url,
    });
  }
}
