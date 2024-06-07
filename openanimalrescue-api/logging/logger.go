package logging

import (
	"log"
	"os"
	"time"
)

type logEntry struct {
	level   string
	emoji   string
	message string
}

var (
	env      string
	logLevel = map[string]string{
		"SUCCESS": "✅",
		"WARNING": "⚠️",
		"ERROR":   "❌",
		"INFO":    "ℹ️",
	}
)

func init() {
	env = os.Getenv("ENV")
	if env == "" {
		env = "development"
	}
}

func logMessage(entry logEntry) {
	now := time.Now().Format("02-01-2006 15:04")
	log.Printf("[%s][%s][%s]: %s %s\n", now, env, entry.level, entry.emoji, entry.message)
}

func LogSuccess(message string) {
	logMessage(logEntry{"SUCCESS", logLevel["SUCCESS"], message})
}

func LogWarning(message string) {
	logMessage(logEntry{"WARNING", logLevel["WARNING"], message})
}

func LogError(message string) {
	logMessage(logEntry{"ERROR", logLevel["ERROR"], message})
}

func LogInfo(message string) {
	logMessage(logEntry{"INFO", logLevel["INFO"], message})
}
