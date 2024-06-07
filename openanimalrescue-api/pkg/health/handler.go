package health

import (
	"context"
	"encoding/json"
	"net/http"
	"openanimalrescue-api/db"
	"openanimalrescue-api/logging"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

type HealthResponse struct {
	Caller   string `json:"caller"`
	Status   string `json:"status"`
	Database string `json:"database"`
}

func checkDatabaseConnection() string {
	// Perform a simple query to check database connectivity
	var dummy int
	err := db.DB.QueryRow("SELECT 1").Scan(&dummy)
	if err != nil {
		logging.LogError("Database connectivity check failed: " + err.Error())
		return "not_connected"
	}
	return "ok"
}

func HealthHandler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	callerIP := request.RequestContext.Identity.SourceIP

	response := HealthResponse{
		Caller:   callerIP,
		Status:   "ok",
		Database: checkDatabaseConnection(),
	}

	responseBody, err := json.Marshal(response)
	if err != nil {
		logging.LogError("Failed to marshal health response: " + err.Error())
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
		}, err
	}

	logging.LogInfo("Health check response: " + string(responseBody))
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
		Body: string(responseBody),
	}, nil
}

func Main() {
	// Initialize the database connection
	_ = db.DB

	lambda.Start(HealthHandler)
}
