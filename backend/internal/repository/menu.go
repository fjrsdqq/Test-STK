package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"menu-tree/backend/internal/model"
)

var ErrNotFound = errors.New("menu not found")

type MenuRepository interface {
	List(context.Context) ([]model.Menu, error)
	Get(context.Context, uuid.UUID) (model.Menu, error)
	Create(context.Context, *model.Menu) error
	Update(context.Context, *model.Menu) error
	Delete(context.Context, uuid.UUID) error
}
type GormMenuRepository struct{ db *gorm.DB }

func NewMenuRepository(db *gorm.DB) *GormMenuRepository { return &GormMenuRepository{db: db} }
func (r *GormMenuRepository) List(ctx context.Context) ([]model.Menu, error) {
	var rows []model.Menu
	err := r.db.WithContext(ctx).Order("position ASC").Order("id ASC").Find(&rows).Error
	return rows, err
}
func (r *GormMenuRepository) Get(ctx context.Context, id uuid.UUID) (model.Menu, error) {
	var m model.Menu
	err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.Menu{}, ErrNotFound
	}
	return m, err
}
func (r *GormMenuRepository) Create(ctx context.Context, m *model.Menu) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var max *int
		q := tx.Model(&model.Menu{}).Select("MAX(position)").Where("parent_id IS NULL")
		if m.ParentID != nil {
			q = q.Where("parent_id = ?", *m.ParentID)
		}
		if err := q.Scan(&max).Error; err != nil {
			return err
		}
		if max != nil {
			m.Position = *max + 1
		}
		return tx.Create(m).Error
	})
}
func (r *GormMenuRepository) Update(ctx context.Context, m *model.Menu) error {
	res := r.db.WithContext(ctx).Model(&model.Menu{}).Where("id = ?", m.ID).Update("name", m.Name)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}
func (r *GormMenuRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Delete(&model.Menu{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}
