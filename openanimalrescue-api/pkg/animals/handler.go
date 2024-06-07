package animals

import (
	"encoding/json"
	"net/http"
	"openanimalrescue-api/db"
	"openanimalrescue-api/logging"
	"openanimalrescue-api/models"

	"github.com/aws/aws-lambda-go/events"
)

func GetAnimals() events.APIGatewayProxyResponse {
	animals, err := db.GetAllAnimals()
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       "Failed to fetch animals",
		}
	}

	body, err := json.Marshal(animals)
	if err != nil {
		logging.LogError("Failed to marshal animals: " + err.Error())
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       "Failed to marshal animals",
		}
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       string(body),
	}
}

func CreateAnimal(requestBody string) events.APIGatewayProxyResponse {
	var animal models.Animal
	err := json.Unmarshal([]byte(requestBody), &animal)
	if err != nil {
		logging.LogError("Failed to unmarshal request body: " + err.Error())
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusBadRequest,
			Body:       "Invalid request body",
		}
	}

	createdAnimal, err := db.CreateAnimal(animal)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       "Failed to create animal",
		}
	}

	body, err := json.Marshal(createdAnimal)
	if err != nil {
		logging.LogError("Failed to marshal created animal: " + err.Error())
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       "Failed to marshal created animal",
		}
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusCreated,
		Body:       string(body),
	}
}

func GetAnimalByID(id int) events.APIGatewayProxyResponse {
	animal, err := db.GetAnimalByID(id)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       "Failed to fetch animal by ID",
		}
	}

	body, err := json.Marshal(animal)
	if err != nil {
		logging.LogError("Failed to marshal animal: " + err.Error())
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       "Failed to marshal animal",
		}
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       string(body),
	}
}

func UpdateAnimal(id int, requestBody string) events.APIGatewayProxyResponse {
	var animal models.Animal
	err := json.Unmarshal([]byte(requestBody), &animal)
	if err != nil {
		logging.LogError("Failed to unmarshal request body: " + err.Error())
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusBadRequest,
			Body:       "Invalid request body",
		}
	}

	updatedAnimal, err := db.UpdateAnimal(id, animal)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       "Failed to update animal",
		}
	}

	body, err := json.Marshal(updatedAnimal)
	if err != nil {
		logging.LogError("Failed to marshal updated animal: " + err.Error())
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       "Failed to marshal updated animal",
		}
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       string(body),
	}
}

func DeleteAnimal(id int) events.APIGatewayProxyResponse {
	err := db.DeleteAnimal(id)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       "Failed to delete animal",
		}
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusNoContent,
	}
}
