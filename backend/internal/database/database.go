package database

import (
	"fmt"
	"log"
	"net/url"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"menu-tree/backend/internal/config"
)

func Connect(c config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	return db, nil
}
func Migrate(c config.Config) error {
	u := url.URL{Scheme: "postgres", Host: fmt.Sprintf("%s:%s", c.DBHost, c.DBPort), User: url.UserPassword(c.DBUser, c.DBPassword), Path: "/" + c.DBName}
	q := u.Query()
	q.Set("sslmode", "disable")
	u.RawQuery = q.Encode()
	m, err := migrate.New("file://migrations", u.String())
	if err != nil {
		return err
	}
	defer func() {
		srcErr, dbErr := m.Close()
		if srcErr != nil {
			log.Printf("migration source close: %v", srcErr)
		}
		if dbErr != nil {
			log.Printf("migration database close: %v", dbErr)
		}
	}()
	if err = m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}
