package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	_ "menu-tree/backend/docs"
	"menu-tree/backend/internal/config"
	"menu-tree/backend/internal/database"
	"menu-tree/backend/internal/handler"
	"menu-tree/backend/internal/middleware"
	"menu-tree/backend/internal/repository"
	"menu-tree/backend/internal/service"
)

// @title Menu Tree API
// @version 1.0
// @description API for managing a hierarchical menu tree.
// @BasePath /
func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	if err = database.Migrate(cfg); err != nil {
		log.Fatalf("database migration failed: %v", err)
	}
	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(middleware.Logger(), middleware.Recovery(), middleware.CORS())
	repo := repository.NewMenuRepository(db)
	svc := service.NewMenuService(repo)
	h := handler.NewMenuHandler(svc)
	h.Register(router.Group("/api"))
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	router.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
	log.Printf("server listening on :%s", cfg.AppPort)
	if err = router.Run(":" + cfg.AppPort); err != nil {
		log.Fatal(err)
	}
}
