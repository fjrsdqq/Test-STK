package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"menu-tree/backend/internal/apperror"
	"menu-tree/backend/internal/dto"
	"menu-tree/backend/internal/repository"
	"menu-tree/backend/internal/service"
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
	r.PATCH("/menus/:id/move", h.Move)
	r.PATCH("/menus/:id/reorder", h.Reorder)
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

// Move godoc
// @Summary Move a menu to another parent and position
// @Description parent_id is required; send null to move to the root. Example: {"parent_id":null,"position":0}. Omit position to append among the target siblings.
// @Tags menus
// @Accept json
// @Produce json
// @Param id path string true "Menu UUID"
// @Param request body dto.MoveMenuRequest true "Move request"
// @Success 200 {object} dto.MenuResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Failure 422 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/menus/{id}/move [patch]
func (h *MenuHandler) Move(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	var raw dto.MoveMenuJSON
	if err := c.ShouldBindJSON(&raw); err != nil {
		writeError(c, apperror.BadRequest("invalid JSON request body"))
		return
	}
	if len(raw.ParentID) == 0 {
		writeError(c, apperror.Validation("parent_id is required and must be a UUID or null"))
		return
	}
	var parentID *uuid.UUID
	if !bytes.Equal(bytes.TrimSpace(raw.ParentID), []byte("null")) {
		var value uuid.UUID
		if err := json.Unmarshal(raw.ParentID, &value); err != nil {
			writeError(c, apperror.InvalidID())
			return
		}
		parentID = &value
	}
	var position *int
	if raw.Position != nil && !bytes.Equal(bytes.TrimSpace(*raw.Position), []byte("null")) {
		var value int
		if err := json.Unmarshal(*raw.Position, &value); err != nil {
			writeError(c, apperror.Validation("position must be a non-negative integer"))
			return
		}
		position = &value
	}
	req := dto.MoveMenuRequest{ParentID: parentID, Position: position}
	if err := h.validate.Struct(req); err != nil {
		writeError(c, apperror.Validation("position must be a non-negative integer"))
		return
	}
	item, err := h.service.Move(c.Request.Context(), id, req)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

// Reorder godoc
// @Summary Reorder a menu among its siblings
// @Description Example request: {"position":2}. Positions beyond the sibling list are clamped to its last slot.
// @Tags menus
// @Accept json
// @Produce json
// @Param id path string true "Menu UUID"
// @Param request body dto.ReorderMenuRequest true "Reorder request"
// @Success 200 {object} dto.MenuResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 422 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/menus/{id}/reorder [patch]
func (h *MenuHandler) Reorder(c *gin.Context) {
	id, ok := h.parseID(c)
	if !ok {
		return
	}
	var raw struct {
		Position json.RawMessage `json:"position"`
	}
	if err := c.ShouldBindJSON(&raw); err != nil {
		writeError(c, apperror.BadRequest("invalid JSON request body"))
		return
	}
	if len(raw.Position) == 0 || bytes.Equal(bytes.TrimSpace(raw.Position), []byte("null")) {
		writeError(c, apperror.Validation("position is required and must be a non-negative integer"))
		return
	}
	var position int
	if err := json.Unmarshal(raw.Position, &position); err != nil {
		writeError(c, apperror.Validation("position must be a non-negative integer"))
		return
	}
	req := dto.ReorderMenuRequest{Position: &position}
	if err := h.validate.Struct(req); err != nil {
		writeError(c, apperror.Validation("position must be a non-negative integer"))
		return
	}
	item, err := h.service.Reorder(c.Request.Context(), id, position)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
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
