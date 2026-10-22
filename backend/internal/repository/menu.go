package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"menu-tree/backend/internal/model"
)

var (
	ErrNotFound        = errors.New("menu not found")
	ErrCycleDetected   = errors.New("menu cycle detected")
	ErrInvalidPosition = errors.New("position must be non-negative")
)

const mutationLockKey int64 = 734829104

type MenuRepository interface {
	List(context.Context) ([]model.Menu, error)
	Get(context.Context, uuid.UUID) (model.Menu, error)
	Create(context.Context, *model.Menu) error
	Update(context.Context, *model.Menu) error
	Delete(context.Context, uuid.UUID) error
	Move(context.Context, uuid.UUID, *uuid.UUID, *int) (model.Menu, error)
	Reorder(context.Context, uuid.UUID, int) (model.Menu, error)
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
		if err := lockMutations(tx); err != nil {
			return err
		}
		if m.ParentID != nil {
			if _, err := getMenu(tx, *m.ParentID); err != nil {
				return err
			}
		}
		siblings, err := lockSiblings(tx, m.ParentID)
		if err != nil {
			return err
		}
		if err := savePositions(tx, siblings); err != nil {
			return err
		}
		m.Position = len(siblings)
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
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockMutations(tx); err != nil {
			return err
		}
		menu, err := getMenu(tx, id)
		if err != nil {
			return err
		}
		siblings, err := lockSiblings(tx, menu.ParentID)
		if err != nil {
			return err
		}
		if err = tx.Delete(&model.Menu{}, "id = ?", id).Error; err != nil {
			return err
		}
		remaining := removeMenu(siblings, id)
		return savePositions(tx, remaining)
	})
}

func (r *GormMenuRepository) Move(ctx context.Context, id uuid.UUID, parentID *uuid.UUID, position *int) (result model.Menu, err error) {
	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockMutations(tx); err != nil {
			return err
		}
		menu, err := getMenu(tx, id)
		if err != nil {
			return err
		}
		if parentID != nil {
			if *parentID == id {
				return ErrCycleDetected
			}
			if _, err := getMenu(tx, *parentID); err != nil {
				return err
			}
			if !sameParent(menu.ParentID, parentID) {
				var cycle bool
				if err := tx.Raw(`WITH RECURSIVE descendants AS (
					SELECT id FROM menus WHERE parent_id = ?
					UNION ALL
					SELECT child.id FROM menus AS child
					JOIN descendants AS parent ON child.parent_id = parent.id
				) SELECT EXISTS (SELECT 1 FROM descendants WHERE id = ?)`, id, *parentID).Scan(&cycle).Error; err != nil {
					return err
				}
				if cycle {
					return ErrCycleDetected
				}
			}
		}

		source, err := lockSiblings(tx, menu.ParentID)
		if err != nil {
			return err
		}
		if sameParent(menu.ParentID, parentID) {
			idx := len(source) - 1
			if position != nil {
				idx = *position
			}
			if err := validatePosition(idx); err != nil {
				return err
			}
			ordered, err := reorderRows(source, id, idx)
			if err != nil {
				return err
			}
			if err := savePositions(tx, ordered); err != nil {
				return err
			}
			result, err = getMenu(tx, id)
			return err
		}

		target, err := lockSiblings(tx, parentID)
		if err != nil {
			return err
		}
		idx := len(target)
		if position != nil {
			idx = *position
		}
		if err := validatePosition(idx); err != nil {
			return err
		}
		remaining := removeMenu(source, id)
		if err := savePositions(tx, remaining); err != nil {
			return err
		}
		if idx > len(target) {
			idx = len(target)
		}
		moving := menu
		moving.ParentID = parentID
		moving.Position = idx
		if err := tx.Model(&model.Menu{}).Where("id = ?", id).Updates(map[string]any{
			"parent_id": parentID, "position": idx, "updated_at": gorm.Expr("NOW()"),
		}).Error; err != nil {
			return err
		}
		target = append(target, model.Menu{})
		copy(target[idx+1:], target[idx:])
		target[idx] = moving
		if err := savePositions(tx, target); err != nil {
			return err
		}
		result, err = getMenu(tx, id)
		return err
	})
	return result, err
}

func (r *GormMenuRepository) Reorder(ctx context.Context, id uuid.UUID, position int) (result model.Menu, err error) {
	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockMutations(tx); err != nil {
			return err
		}
		menu, err := getMenu(tx, id)
		if err != nil {
			return err
		}
		if err := validatePosition(position); err != nil {
			return err
		}
		siblings, err := lockSiblings(tx, menu.ParentID)
		if err != nil {
			return err
		}
		ordered, err := reorderRows(siblings, id, position)
		if err != nil {
			return err
		}
		if err = savePositions(tx, ordered); err != nil {
			return err
		}
		result, err = getMenu(tx, id)
		return err
	})
	return result, err
}

func lockMutations(tx *gorm.DB) error {
	return tx.Exec("SELECT pg_advisory_xact_lock(?)", mutationLockKey).Error
}

func getMenu(tx *gorm.DB, id uuid.UUID) (model.Menu, error) {
	var menu model.Menu
	err := tx.First(&menu, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.Menu{}, ErrNotFound
	}
	return menu, err
}

func lockSiblings(tx *gorm.DB, parentID *uuid.UUID) ([]model.Menu, error) {
	query := tx.Model(&model.Menu{}).Clauses(clause.Locking{Strength: "UPDATE"})
	if parentID == nil {
		query = query.Where("parent_id IS NULL")
	} else {
		query = query.Where("parent_id = ?", *parentID)
	}
	var siblings []model.Menu
	err := query.Order("position ASC").Order("id ASC").Find(&siblings).Error
	return siblings, err
}

func savePositions(tx *gorm.DB, rows []model.Menu) error {
	for position, row := range rows {
		if row.Position == position {
			continue
		}
		updates := map[string]any{"position": position, "updated_at": gorm.Expr("NOW()")}
		if err := tx.Model(&model.Menu{}).Where("id = ?", row.ID).Updates(updates).Error; err != nil {
			return err
		}
	}
	return nil
}

func removeMenu(rows []model.Menu, id uuid.UUID) []model.Menu {
	remaining := make([]model.Menu, 0, len(rows)-1)
	for _, row := range rows {
		if row.ID != id {
			remaining = append(remaining, row)
		}
	}
	return remaining
}

func reorderRows(rows []model.Menu, id uuid.UUID, position int) ([]model.Menu, error) {
	idx := -1
	for i := range rows {
		if rows[i].ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		return nil, ErrNotFound
	}
	if position >= len(rows) {
		position = len(rows) - 1
	}
	if err := validatePosition(position); err != nil {
		return nil, err
	}
	ordered := make([]model.Menu, len(rows))
	ordered[position] = rows[idx]
	destination := 0
	for i, row := range rows {
		if i == idx {
			continue
		}
		if destination == position {
			destination++
		}
		ordered[destination] = row
		destination++
	}
	return ordered, nil
}

func sameParent(a, b *uuid.UUID) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func validatePosition(position int) error {
	if position < 0 {
		return ErrInvalidPosition
	}
	return nil
}
