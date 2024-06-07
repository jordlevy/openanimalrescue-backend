package main

import (
	"openanimalrescue-api/db"
	"openanimalrescue-api/pkg/health"
	"os"
)

func main() {
	dbSecretArn := os.Getenv("DB_SECRET_ARN")
	db.InitDB(dbSecretArn)
	health.Main()
}
