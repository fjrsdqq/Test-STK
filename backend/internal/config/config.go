package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	AppPort            string
	AppEnv             string
	CORSAllowedOrigins []string
}

func Load() (Config, error) {
	_ = godotenv.Load()
	c := Config{
		DBHost: os.Getenv("DB_HOST"), DBPort: os.Getenv("DB_PORT"),
		DBUser: os.Getenv("DB_USER"), DBPassword: os.Getenv("DB_PASSWORD"),
		DBName: os.Getenv("DB_NAME"), AppPort: os.Getenv("APP_PORT"), AppEnv: os.Getenv("APP_ENV"),
		CORSAllowedOrigins: splitOrigins(os.Getenv("CORS_ALLOWED_ORIGINS")),
	}
	defaults := map[*string]string{&c.DBHost: "localhost", &c.DBPort: "5432", &c.DBUser: "menu_user", &c.DBPassword: "menu_password", &c.DBName: "menu_tree", &c.AppPort: "8080", &c.AppEnv: "development"}
	for target, value := range defaults {
		if *target == "" {
			*target = value
		}
	}
	if len(c.CORSAllowedOrigins) == 0 {
		c.CORSAllowedOrigins = []string{"http://localhost:3000"}
	}
	for _, origin := range c.CORSAllowedOrigins {
		if origin == "*" {
			return Config{}, fmt.Errorf("CORS_ALLOWED_ORIGINS must list explicit origins; wildcard is not allowed")
		}
	}
	if c.DBHost == "" || c.DBPort == "" {
		return Config{}, fmt.Errorf("database host and port are required")
	}
	return c, nil
}

func splitOrigins(value string) []string {
	var origins []string
	for _, origin := range strings.Split(value, ",") {
		if trimmed := strings.TrimSpace(origin); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}
