package dto

import (
	"github.com/google/uuid"
	"menu-tree/backend/internal/model"
)

type CreateMenuRequest struct {
	Name     string     `json:"name" validate:"required,max=255"`
	ParentID *uuid.UUID `json:"parent_id"`
}

type UpdateMenuRequest struct {
	Name string `json:"name" validate:"required,max=255"`
}

type MenuResponse struct {
	ID        uuid.UUID      `json:"id"`
	Name      string         `json:"name"`
	ParentID  *uuid.UUID     `json:"parent_id,omitempty"`
	Position  int            `json:"position"`
	CreatedAt string         `json:"created_at"`
	UpdatedAt string         `json:"updated_at"`
	Children  []MenuResponse `json:"children"`
}

func FromModel(m model.Menu) MenuResponse {
	return MenuResponse{ID: m.ID, Name: m.Name, ParentID: m.ParentID, Position: m.Position, CreatedAt: m.CreatedAt.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"), UpdatedAt: m.UpdatedAt.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"), Children: []MenuResponse{}}
}
