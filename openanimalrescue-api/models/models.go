package models

type Animal struct {
	ID                    int     `json:"id"`
	Name                  string  `json:"name"`
	Species               string  `json:"species"`
	Breed                 *string `json:"breed,omitempty"`
	Age                   *int    `json:"age,omitempty"`
	Sex                   *string `json:"sex,omitempty"`
	Description           *string `json:"description,omitempty"`
	ArrivalDate           string  `json:"arrivalDate"`
	HealthStatus          *string `json:"healthStatus,omitempty"`
	SterilisationStatus   *bool   `json:"sterilisationStatus,omitempty"`
	ChipNumber            *string `json:"chipNumber,omitempty"`
	InternalNotes         *string `json:"internalNotes,omitempty"`
	ReasonOnboarded       *string `json:"reasonOnboarded,omitempty"`
	LatestVaccinationDate *string `json:"latestVaccinationDate,omitempty"`
	CurrentLocation       *string `json:"currentLocation,omitempty"`
	Status                string  `json:"status"`
}
