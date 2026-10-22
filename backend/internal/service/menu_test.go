package service

import (
	"context"
	"github.com/google/uuid"
	"menu-tree/backend/internal/apperror"
	"menu-tree/backend/internal/model"
	"menu-tree/backend/internal/repository"
	"testing"
)

type mockRepo struct {
	rows      []model.Menu
	getErr    error
	deleteErr error
}

func (m *mockRepo) List(context.Context) ([]model.Menu, error) { return m.rows, nil }
func (m *mockRepo) Get(_ context.Context, id uuid.UUID) (model.Menu, error) {
	if m.getErr != nil {
		return model.Menu{}, m.getErr
	}
	for _, r := range m.rows {
		if r.ID == id {
			return r, nil
		}
	}
	return model.Menu{}, repository.ErrNotFound
}
func (m *mockRepo) Create(_ context.Context, row *model.Menu) error {
	if row.ID == uuid.Nil {
		row.ID = uuid.New()
	}
	m.rows = append(m.rows, *row)
	return nil
}
func (m *mockRepo) Update(context.Context, *model.Menu) error { return nil }
func (m *mockRepo) Delete(context.Context, uuid.UUID) error   { return m.deleteErr }

func TestListBuildsNestedTree(t *testing.T) {
	a, b, c := uuid.New(), uuid.New(), uuid.New()
	repo := &mockRepo{rows: []model.Menu{{ID: a, Name: "root"}, {ID: b, Name: "child", ParentID: &a}, {ID: c, Name: "grandchild", ParentID: &b}}}
	tree, err := NewMenuService(repo).List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(tree) != 1 || len(tree[0].Children) != 1 || len(tree[0].Children[0].Children) != 1 {
		t.Fatalf("unexpected tree: %#v", tree)
	}
}
func TestCreateRejectsMissingParent(t *testing.T) {
	repo := &mockRepo{}
	_, err := NewMenuService(repo).Create(context.Background(), "child", ptrUUID(uuid.New()))
	if err == nil {
		t.Fatal("expected error")
	}
	if e, ok := err.(*apperror.Error); !ok || e.Status != 404 {
		t.Fatalf("expected 404, got %v", err)
	}
}
func TestCreateRejectsBlankName(t *testing.T) {
	_, err := NewMenuService(&mockRepo{}).Create(context.Background(), "  ", nil)
	if e, ok := err.(*apperror.Error); !ok || e.Status != 422 {
		t.Fatalf("expected validation error, got %v", err)
	}
}
func TestDeleteMissingMenu(t *testing.T) {
	repo := &mockRepo{deleteErr: repository.ErrNotFound}
	err := NewMenuService(repo).Delete(context.Background(), uuid.New())
	if e, ok := err.(*apperror.Error); !ok || e.Status != 404 {
		t.Fatalf("expected 404, got %v", err)
	}
}
func ptrUUID(id uuid.UUID) *uuid.UUID { return &id }
