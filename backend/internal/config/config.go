package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	AppPort    string
	AppEnv     string
}

func Load() (Config, error) {
	_ = godotenv.Load()
	c := Config{
		DBHost: os.Getenv("DB_HOST"), DBPort: os.Getenv("DB_PORT"),
		DBUser: os.Getenv("DB_USER"), DBPassword: os.Getenv("DB_PASSWORD"),
		DBName: os.Getenv("DB_NAME"), AppPort: os.Getenv("APP_PORT"), AppEnv: os.Getenv("APP_ENV"),
	}
	defaults := map[*string]string{&c.DBHost: "localhost", &c.DBPort: "5432", &c.DBUser: "menu_user", &c.DBPassword: "menu_password", &c.DBName: "menu_tree", &c.AppPort: "8080", &c.AppEnv: "development"}
	for target, value := range defaults {
		if *target == "" {
			*target = value
		}
	}
	if c.DBHost == "" || c.DBPort == "" {
		return Config{}, fmt.Errorf("database host and port are required")
	}
	return c, nil
}
