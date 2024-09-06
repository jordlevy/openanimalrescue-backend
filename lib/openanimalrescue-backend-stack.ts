import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

//We'll load environment variables for some dynamically configurable values, refer to the .env.example file
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

//Define naming convention: {org}-{service}-{stage}
const resourceName = (service: string) => `oar-${ORG}-${service}-${STAGE}`;

export class OpenanimalrescueBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    //Always tag AWS resources, so here we define a function to add tags to resources
    const addTags = (resource: cdk.Resource, service: string) => {
      cdk.Tags.of(resource).add('organisation', ORG);
      cdk.Tags.of(resource).add('stage', STAGE);
      cdk.Tags.of(resource).add('version', version);
      cdk.Tags.of(resource).add('service', service);
    };

    //DynamoDB table
    const dynamoTable = new dynamodb.Table(this, resourceName('table'), {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: resourceName('table'),
    });
    addTags(dynamoTable, 'dynamodb');

    const s3Bucket = new s3.Bucket(this, resourceName('bucket'), {
      bucketName: resourceName('bucket'),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change based on lifecycle needs
      autoDeleteObjects: true, // Adjust based on your use case
    });
    addTags(s3Bucket, 's3');

    const api = new apigateway.RestApi(this, resourceName('api'), {
      restApiName: resourceName('api'),
      deployOptions: {
        stageName: STAGE,
      },
    });
    addTags(api, 'apigateway');

    //Lambda Layer that'll hold node modules shared across multiple Lambda functions
    const lambdaLayer = new lambda.LayerVersion(this, 'SharedUtilsLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../layers/shared-utils')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Shared utilities for Node.js Lambda functions',
    });
    addTags(lambdaLayer, 'lambda-layer');
  
    //And now we start defining Lambda functions, that'll be part of our backend
    //Lambda function for health check
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

    const healthLambdaIntegration = new apigateway.LambdaIntegration(healthLambda);
    const healthRoute = api.root.addResource('health');
    healthRoute.addMethod('GET', healthLambdaIntegration);

    //Output all the resources created
    new cdk.CfnOutput(this, 'DynamoTable', {
      value: dynamoTable.tableName,
    });
    new cdk.CfnOutput(this, 'S3Bucket', {
      value: s3Bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });
  }
}
