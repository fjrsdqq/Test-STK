package handler

import (
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"menu-tree/backend/internal/apperror"
	"menu-tree/backend/internal/dto"
	"menu-tree/backend/internal/repository"
	"menu-tree/backend/internal/service"
	"net/http"
	"strings"
)

type MenuHandler struct {
	service  service.MenuService
	validate *validator.Validate
}

func NewMenuHandler(s service.MenuService) *MenuHandler {
	return &MenuHandler{service: s, validate: validator.New()}
}
func (h *MenuHandler) Register(r gin.IRouter) {
	r.GET("/menus", h.List)
	r.GET("/menus/:id", h.Get)
	r.POST("/menus", h.Create)
	r.PUT("/menus/:id", h.Update)
	r.DELETE("/menus/:id", h.Delete)
}
func (h *MenuHandler) parseID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		writeError(c, apperror.InvalidID())
		return uuid.Nil, false
	}
	return id, true
}

// List godoc
// @Summary List menu tree
// @Tags menus
// @Produce json
// @Success 200 {array} dto.MenuResponse
// @Failure 500 {object} map[string]interface{}
// @Router /api/menus [get]
func (h *MenuHandler) List(c *gin.Context) {
	items, err := h.service.List(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

// Get godoc
// @Summary Get a menu and its descendants
// @Tags menus
// @Produce json
// @Param id path string true "Menu UUID"
// @Success 200 {object} dto.MenuResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /api/menus/{id} [get]
func (h *MenuHandler) Get(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	item, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

// Create godoc
// @Summary Create a menu
// @Tags menus
// @Accept json
// @Produce json
// @Param request body dto.CreateMenuRequest true "Menu"
// @Success 201 {object} dto.MenuResponse
// @Failure 422 {object} map[string]interface{}
// @Router /api/menus [post]
func (h *MenuHandler) Create(c *gin.Context) {
	var req dto.CreateMenuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, apperror.BadRequest("invalid JSON request body"))
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if err := h.validate.Struct(req); err != nil {
		writeError(c, apperror.Validation("name is required and must be at most 255 characters"))
		return
	}
	item, err := h.service.Create(c.Request.Context(), req.Name, req.ParentID)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

// Update godoc
// @Summary Rename a menu
// @Tags menus
// @Accept json
// @Produce json
// @Param id path string true "Menu UUID"
// @Param request body dto.UpdateMenuRequest true "New menu name"
// @Success 200 {object} dto.MenuResponse
// @Failure 422 {object} map[string]interface{}
// @Router /api/menus/{id} [put]
func (h *MenuHandler) Update(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	var req dto.UpdateMenuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, apperror.BadRequest("invalid JSON request body"))
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if err := h.validate.Struct(req); err != nil {
		writeError(c, apperror.Validation("name is required and must be at most 255 characters"))
		return
	}
	item, err := h.service.Update(c.Request.Context(), id, req.Name)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

// Delete godoc
// @Summary Delete a menu and all descendants
// @Tags menus
// @Param id path string true "Menu UUID"
// @Success 204
// @Failure 404 {object} map[string]interface{}
// @Router /api/menus/{id} [delete]
func (h *MenuHandler) Delete(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
func writeError(c *gin.Context, err error) {
	var appErr *apperror.Error
	if errors.As(err, &appErr) {
		c.JSON(appErr.Status, gin.H{"error": gin.H{"code": appErr.Code, "message": appErr.Message, "details": []string{}}})
		return
	}
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "menu not found", "details": []string{}}})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "INTERNAL_ERROR", "message": "an internal error occurred", "details": []string{}}})
}
