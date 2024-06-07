package main

import (
	"context"
	"os"
	"strconv"

	"openanimalrescue-api/db"
	"openanimalrescue-api/logging"
	"openanimalrescue-api/pkg/animals"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

func handleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var response events.APIGatewayProxyResponse

	switch request.HTTPMethod {
	case "GET":
		if id, ok := request.PathParameters["id"]; ok {
			idInt, err := strconv.Atoi(id)
			if err != nil {
				logging.LogError("Invalid ID: " + id)
				response = events.APIGatewayProxyResponse{
					StatusCode: 400,
					Body:       "Invalid ID",
				}
				break
			}
			response = animals.GetAnimalByID(idInt)
		} else {
			response = animals.GetAnimals()
		}
	case "POST":
		response = animals.CreateAnimal(request.Body)
	case "PATCH":
		if id, ok := request.PathParameters["id"]; ok {
			idInt, err := strconv.Atoi(id)
			if err != nil {
				logging.LogError("Invalid ID: " + id)
				response = events.APIGatewayProxyResponse{
					StatusCode: 400,
					Body:       "Invalid ID",
				}
				break
			}
			response = animals.UpdateAnimal(idInt, request.Body)
		} else {
			logging.LogError("ID not provided for PATCH request")
			response = events.APIGatewayProxyResponse{
				StatusCode: 400,
				Body:       "ID not provided",
			}
		}
	case "DELETE":
		if id, ok := request.PathParameters["id"]; ok {
			idInt, err := strconv.Atoi(id)
			if err != nil {
				logging.LogError("Invalid ID: " + id)
				response = events.APIGatewayProxyResponse{
					StatusCode: 400,
					Body:       "Invalid ID",
				}
				break
			}
			response = animals.DeleteAnimal(idInt)
		} else {
			logging.LogError("ID not provided for DELETE request")
			response = events.APIGatewayProxyResponse{
				StatusCode: 400,
				Body:       "ID not provided",
			}
		}
	default:
		logging.LogError("Method not allowed: " + request.HTTPMethod)
		response = events.APIGatewayProxyResponse{
			StatusCode: 405,
			Body:       "Method not allowed",
		}
	}

	return response, nil
}

func main() {
	dbSecretArn := os.Getenv("DB_SECRET_ARN")
	db.InitDB(dbSecretArn)
	lambda.Start(handleRequest)
}
