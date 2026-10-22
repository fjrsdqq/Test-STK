package model

import (
	"time"

	"github.com/google/uuid"
)

type Menu struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string     `gorm:"type:varchar(255);not null" json:"name"`
	ParentID  *uuid.UUID `gorm:"type:uuid;index:idx_menus_parent_position,priority:1" json:"parent_id,omitempty"`
	Position  int        `gorm:"not null;default:0;index:idx_menus_parent_position,priority:2" json:"position"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}
