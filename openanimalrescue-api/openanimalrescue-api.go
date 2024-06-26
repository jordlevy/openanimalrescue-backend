package main

import (
	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsapigateway"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambda"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssecretsmanager"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type OpenanimalrescueApiStackProps struct {
	awscdk.StackProps
}

func NewOpenanimalrescueApiStack(scope constructs.Construct, id string, props *OpenanimalrescueApiStackProps) awscdk.Stack {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	// Define the Lambda function for /health endpoint
	healthFunction := awslambda.NewFunction(stack, jsii.String("HealthFunction"), &awslambda.FunctionProps{
		Runtime:      awslambda.Runtime_PROVIDED_AL2023(),
		Handler:      jsii.String("bootstrap"),
		Architecture: awslambda.Architecture_ARM_64(),
		Code:         awslambda.Code_FromAsset(jsii.String("./bin/health"), nil),
		Environment: &map[string]*string{
			"DB_SECRET_ARN": jsii.String("arn:aws:secretsmanager:af-south-1:931521367637:secret:openanimalrescue/db/prod-Te9sz2"),
		},
	})

	// Define the Lambda function for handling animals
	animalsFunction := awslambda.NewFunction(stack, jsii.String("AnimalsFunction"), &awslambda.FunctionProps{
		Runtime:      awslambda.Runtime_PROVIDED_AL2023(),
		Handler:      jsii.String("bootstrap"),
		Architecture: awslambda.Architecture_ARM_64(),
		Code:         awslambda.Code_FromAsset(jsii.String("./bin/animals"), nil),
		Environment: &map[string]*string{
			"DB_SECRET_ARN": jsii.String("arn:aws:secretsmanager:af-south-1:931521367637:secret:openanimalrescue/db/prod-Te9sz2"),
		},
	})

	// Reference the existing secret
	secret := awssecretsmanager.Secret_FromSecretCompleteArn(stack, jsii.String("DBSecret"), jsii.String("arn:aws:secretsmanager:af-south-1:931521367637:secret:openanimalrescue/db/prod-Te9sz2"))

	// Grant the Lambda function permission to read the secret
	secret.GrantRead(animalsFunction.Role(), nil)
	secret.GrantRead(healthFunction.Role(), nil)

	// Define the API Gateway
	api := awsapigateway.NewRestApi(stack, jsii.String("OpenanimalrescueApi"), nil)

	// Add /health endpoint
	health := api.Root().AddResource(jsii.String("health"), nil)
	health.AddMethod(jsii.String("GET"), awsapigateway.NewLambdaIntegration(healthFunction, nil), nil)

	// Add /animals endpoint
	animals := api.Root().AddResource(jsii.String("animals"), nil)
	animals.AddMethod(jsii.String("GET"), awsapigateway.NewLambdaIntegration(animalsFunction, nil), nil)
	animals.AddMethod(jsii.String("POST"), awsapigateway.NewLambdaIntegration(animalsFunction, nil), nil)

	animal := animals.AddResource(jsii.String("{id}"), nil)
	animal.AddMethod(jsii.String("GET"), awsapigateway.NewLambdaIntegration(animalsFunction, nil), nil)
	animal.AddMethod(jsii.String("PATCH"), awsapigateway.NewLambdaIntegration(animalsFunction, nil), nil)
	animal.AddMethod(jsii.String("DELETE"), awsapigateway.NewLambdaIntegration(animalsFunction, nil), nil)

	return stack
}

func main() {
	defer jsii.Close()

	app := awscdk.NewApp(nil)

	NewOpenanimalrescueApiStack(app, "OpenanimalrescueApiStack", &OpenanimalrescueApiStackProps{
		awscdk.StackProps{
			Env: env(),
		},
	})

	app.Synth(nil)
}

// env determines the AWS environment (account+region) in which our stack is to
// be deployed. For more information see: https://docs.aws.amazon.com/cdk/latest/guide/environments.html
func env() *awscdk.Environment {
	// If unspecified, this stack will be "environment-agnostic".
	// Account/Region-dependent features and context lookups will not work, but a
	// single synthesized template can be deployed anywhere.
	return nil
}
