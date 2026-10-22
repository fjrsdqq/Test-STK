package service

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"menu-tree/backend/internal/apperror"
	"menu-tree/backend/internal/dto"
	"menu-tree/backend/internal/model"
	"menu-tree/backend/internal/repository"
)

type MenuService interface {
	List(context.Context) ([]dto.MenuResponse, error)
	Get(context.Context, uuid.UUID) (dto.MenuResponse, error)
	Create(context.Context, string, *uuid.UUID) (dto.MenuResponse, error)
	Update(context.Context, uuid.UUID, string) (dto.MenuResponse, error)
	Delete(context.Context, uuid.UUID) error
}
type DefaultMenuService struct{ repo repository.MenuRepository }

func NewMenuService(repo repository.MenuRepository) *DefaultMenuService {
	return &DefaultMenuService{repo: repo}
}
func (s *DefaultMenuService) List(ctx context.Context) ([]dto.MenuResponse, error) {
	rows, err := s.repo.List(ctx)
	if err != nil {
		return nil, apperror.Internal()
	}
	return buildTree(rows, nil), nil
}
func (s *DefaultMenuService) Get(ctx context.Context, id uuid.UUID) (dto.MenuResponse, error) {
	rows, err := s.repo.List(ctx)
	if err != nil {
		return dto.MenuResponse{}, apperror.Internal()
	}
	if _, err = s.repo.Get(ctx, id); err != nil {
		return dto.MenuResponse{}, mapRepoError(err)
	}
	tree := buildTree(rows, &id)
	if len(tree) == 0 {
		return dto.MenuResponse{}, apperror.NotFound()
	}
	return tree[0], nil
}

func buildTree(rows []model.Menu, rootID *uuid.UUID) []dto.MenuResponse {
	byID := make(map[uuid.UUID]model.Menu, len(rows))
	children := make(map[uuid.UUID][]uuid.UUID, len(rows))
	roots := make([]uuid.UUID, 0)
	for _, row := range rows {
		byID[row.ID] = row
	}
	for _, row := range rows {
		if row.ParentID == nil {
			roots = append(roots, row.ID)
		} else {
			children[*row.ParentID] = append(children[*row.ParentID], row.ID)
		}
	}
	var makeNode func(uuid.UUID) dto.MenuResponse
	makeNode = func(id uuid.UUID) dto.MenuResponse {
		node := dto.FromModel(byID[id])
		node.Children = make([]dto.MenuResponse, 0, len(children[id]))
		for _, childID := range children[id] {
			node.Children = append(node.Children, makeNode(childID))
		}
		return node
	}
	if rootID != nil {
		if _, ok := byID[*rootID]; !ok {
			return []dto.MenuResponse{}
		}
		return []dto.MenuResponse{makeNode(*rootID)}
	}
	result := make([]dto.MenuResponse, 0, len(roots))
	for _, id := range roots {
		result = append(result, makeNode(id))
	}
	return result
}
func (s *DefaultMenuService) Create(ctx context.Context, name string, parentID *uuid.UUID) (dto.MenuResponse, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return dto.MenuResponse{}, apperror.Validation("name is required")
	}
	if len([]rune(name)) > 255 {
		return dto.MenuResponse{}, apperror.Validation("name must be at most 255 characters")
	}
	if parentID != nil {
		if _, err := s.repo.Get(ctx, *parentID); err != nil {
			if err == repository.ErrNotFound {
				return dto.MenuResponse{}, apperror.NotFound()
			}
			return dto.MenuResponse{}, apperror.Internal()
		}
	}
	m := model.Menu{Name: name, ParentID: parentID}
	if err := s.repo.Create(ctx, &m); err != nil {
		return dto.MenuResponse{}, apperror.Internal()
	}
	return dto.FromModel(m), nil
}
func (s *DefaultMenuService) Update(ctx context.Context, id uuid.UUID, name string) (dto.MenuResponse, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return dto.MenuResponse{}, apperror.Validation("name is required")
	}
	if len([]rune(name)) > 255 {
		return dto.MenuResponse{}, apperror.Validation("name must be at most 255 characters")
	}
	m, err := s.repo.Get(ctx, id)
	if err != nil {
		return dto.MenuResponse{}, mapRepoError(err)
	}
	m.Name = name
	if err = s.repo.Update(ctx, &m); err != nil {
		return dto.MenuResponse{}, mapRepoError(err)
	}
	return dto.FromModel(m), nil
}
func (s *DefaultMenuService) Delete(ctx context.Context, id uuid.UUID) error {
	err := s.repo.Delete(ctx, id)
	if err != nil {
		return mapRepoError(err)
	}
	return nil
}
func mapRepoError(err error) error {
	if err == repository.ErrNotFound {
		return apperror.NotFound()
	}
	return apperror.Internal()
}
