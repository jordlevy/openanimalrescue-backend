package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"openanimalrescue-api/logging"
	"openanimalrescue-api/models"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	_ "github.com/lib/pq" // PostgreSQL driver
)

type DBConfig struct {
	Host     string `json:"DB_HOST"`
	Port     string `json:"DB_PORT"`
	User     string `json:"DB_USERNAME"`
	Password string `json:"DB_PASSWORD"`
	Name     string `json:"DB_NAME"`
	SSLMode  string `json:"DB_SSLMODE"`
}

// Export the database connection
var DB *sql.DB

func InitDB(secretArn string) {
	if secretArn == "" {
		logging.LogError("DB_SECRET_ARN environment variable is not set")
		log.Fatalf("DB_SECRET_ARN environment variable is not set")
	}

	dbConfig := getDBConfigFromSecret(secretArn)

	if dbConfig.Host == "" || dbConfig.Port == "" || dbConfig.User == "" || dbConfig.Password == "" || dbConfig.Name == "" || dbConfig.SSLMode == "" {
		logging.LogError("Database credentials are not set correctly")
		log.Fatalf("Database credentials are not set correctly")
	}

	dbConnStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dbConfig.Host, dbConfig.Port, dbConfig.User, dbConfig.Password, dbConfig.Name, dbConfig.SSLMode)

	var err error
	DB, err = sql.Open("postgres", dbConnStr)
	if err != nil {
		logging.LogError(fmt.Sprintf("Failed to connect to the database: %v", err))
		panic(err)
	}

	err = DB.Ping()
	if err != nil {
		logging.LogError(fmt.Sprintf("Failed to ping the database: %v", err))
		panic(err)
	}

	logging.LogSuccess("Successfully connected to the database")
}

func getDBConfigFromSecret(secretArn string) DBConfig {
	region := "af-south-1"

	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(region))
	if err != nil {
		logging.LogError(fmt.Sprintf("Failed to load configuration: %v", err))
		log.Fatalf("failed to load configuration, %v", err)
	}

	svc := secretsmanager.NewFromConfig(cfg)

	input := &secretsmanager.GetSecretValueInput{
		SecretId: aws.String(secretArn),
	}

	result, err := svc.GetSecretValue(context.TODO(), input)
	if err != nil {
		logging.LogError(fmt.Sprintf("Failed to get secret value: %v", err))
		log.Fatalf("failed to get secret value, %v", err)
	}

	var dbConfig DBConfig
	err = json.Unmarshal([]byte(*result.SecretString), &dbConfig)
	if err != nil {
		logging.LogError(fmt.Sprintf("Failed to unmarshal secret: %v", err))
		log.Fatalf("failed to unmarshal secret, %v", err)
	}

	logging.LogSuccess("Successfully fetched database credentials from Secrets Manager")
	return dbConfig
}

// Database interaction functions...

func GetAllAnimals() ([]models.Animal, error) {
	rows, err := DB.Query("SELECT * FROM Animals")
	if err != nil {
		logging.LogError(fmt.Sprintf("Failed to fetch animals: %v", err))
		return nil, err
	}
	defer rows.Close()

	var animals []models.Animal
	for rows.Next() {
		var animal models.Animal
		if err := rows.Scan(&animal.ID, &animal.Name, &animal.Species, &animal.Breed, &animal.Age, &animal.Sex, &animal.Description, &animal.ArrivalDate, &animal.HealthStatus, &animal.SterilisationStatus, &animal.ChipNumber, &animal.InternalNotes, &animal.ReasonOnboarded, &animal.LatestVaccinationDate, &animal.CurrentLocation, &animal.Status); err != nil {
			logging.LogError(fmt.Sprintf("Failed to scan animal: %v", err))
			return nil, err
		}
		animals = append(animals, animal)
	}
	logging.LogSuccess("Successfully fetched all animals")
	return animals, nil
}

func CreateAnimal(animal models.Animal) (models.Animal, error) {
	var id int
	err := DB.QueryRow("INSERT INTO Animals (name, species, breed, age, sex, description, arrivalDate, healthStatus, sterilisationStatus, chipNumber, internalNotes, reasonOnboarded, latestVaccinationDate, currentLocation, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id",
		animal.Name, animal.Species, animal.Breed, animal.Age, animal.Sex, animal.Description, animal.ArrivalDate, animal.HealthStatus, animal.SterilisationStatus, animal.ChipNumber, animal.InternalNotes, animal.ReasonOnboarded, animal.LatestVaccinationDate, animal.CurrentLocation, animal.Status).Scan(&id)
	if err != nil {
		logging.LogError(fmt.Sprintf("Failed to create animal: %v", err))
		return animal, err
	}
	animal.ID = id
	logging.LogSuccess(fmt.Sprintf("Successfully created animal with ID %d", id))
	return animal, nil
}

func GetAnimalByID(id int) (models.Animal, error) {
	var animal models.Animal
	err := DB.QueryRow("SELECT * FROM Animals WHERE id = $1", id).Scan(&animal.ID, &animal.Name, &animal.Species, &animal.Breed, &animal.Age, &animal.Sex, &animal.Description, &animal.ArrivalDate, &animal.HealthStatus, &animal.SterilisationStatus, &animal.ChipNumber, &animal.InternalNotes, &animal.ReasonOnboarded, &animal.LatestVaccinationDate, &animal.CurrentLocation, &animal.Status)
	if err != nil {
		logging.LogError(fmt.Sprintf("Failed to fetch animal by ID %d: %v", id, err))
		return animal, err
	}
	logging.LogSuccess(fmt.Sprintf("Successfully fetched animal with ID %d", id))
	return animal, nil
}

func UpdateAnimal(id int, animal models.Animal) (models.Animal, error) {
	_, err := DB.Exec("UPDATE Animals SET name=$1, species=$2, breed=$3, age=$4, sex=$5, description=$6, arrivalDate=$7, healthStatus=$8, sterilisationStatus=$9, chipNumber=$10, internalNotes=$11, reasonOnboarded=$12, latestVaccinationDate=$13, currentLocation=$14, status=$15 WHERE id=$16",
		animal.Name, animal.Species, animal.Breed, animal.Age, animal.Sex, animal.Description, animal.ArrivalDate, animal.HealthStatus, animal.SterilisationStatus, animal.ChipNumber, animal.InternalNotes, animal.ReasonOnboarded, animal.LatestVaccinationDate, animal.CurrentLocation, animal.Status, id)
	if err != nil {
		logging.LogError(fmt.Sprintf("Failed to update animal with ID %d: %v", id, err))
		return animal, err
	}
	animal.ID = id
	logging.LogSuccess(fmt.Sprintf("Successfully updated animal with ID %d", id))
	return animal, nil
}

func DeleteAnimal(id int) error {
	_, err := DB.Exec("DELETE FROM Animals WHERE id = $1", id)
	if err != nil {
		logging.LogError(fmt.Sprintf("Failed to delete animal with ID %d: %v", id, err))
		return err
	}
	logging.LogSuccess(fmt.Sprintf("Successfully deleted animal with ID %d", id))
	return nil
}
