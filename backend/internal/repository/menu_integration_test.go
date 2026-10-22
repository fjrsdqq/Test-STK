package repository

import (
	"context"
	"errors"
	"os"
	"sort"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"menu-tree/backend/internal/model"
)

func TestMoveAndReorderKeepSiblingPositionsCompact(t *testing.T) {
	dsn := os.Getenv("MENU_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set MENU_TEST_DATABASE_URL to run PostgreSQL repository integration tests")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	defer sqlDB.Close()
	if err := db.Exec(`CREATE TEMP TABLE menus (
		id UUID PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		parent_id UUID NULL REFERENCES menus(id) ON DELETE CASCADE,
		position INTEGER NOT NULL DEFAULT 0,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`).Error; err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	repo := NewMenuRepository(db)
	newMenu := func(name string, parentID *uuid.UUID) model.Menu {
		t.Helper()
		menu := model.Menu{ID: uuid.New(), Name: name, ParentID: parentID}
		if err := repo.Create(ctx, &menu); err != nil {
			t.Fatal(err)
		}
		return menu
	}
	rootA := newMenu("A", nil)
	rootB := newMenu("B", nil)
	rootC := newMenu("C", nil)
	childA1 := newMenu("A1", &rootA.ID)
	childA2 := newMenu("A2", &rootA.ID)
	childA3 := newMenu("A3", &rootA.ID)

	assertCycle := func(id uuid.UUID, parentID *uuid.UUID) {
		t.Helper()
		if _, err := repo.Move(ctx, id, parentID, nil); !errors.Is(err, ErrCycleDetected) {
			t.Fatalf("expected cycle error, got %v", err)
		}
	}
	assertCycle(rootA.ID, &rootA.ID)
	assertCycle(rootA.ID, &childA2.ID)
	missing := uuid.New()
	if _, err := repo.Move(ctx, childA1.ID, &missing, nil); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected missing parent error, got %v", err)
	}
	position := 1
	if _, err := repo.Move(ctx, childA1.ID, nil, &position); err != nil {
		t.Fatalf("move to root failed: %v", err)
	}
	if _, err := repo.Reorder(ctx, rootC.ID, 0); err != nil {
		t.Fatalf("reorder failed: %v", err)
	}
	if _, err := repo.Reorder(ctx, rootB.ID, 999); err != nil {
		t.Fatalf("clamped reorder failed: %v", err)
	}
	if _, err := repo.Move(ctx, childA2.ID, nil, nil); err != nil {
		t.Fatalf("move to root with default position failed: %v", err)
	}
	if err := assertCompactPositions(ctx, repo); err != nil {
		t.Fatal(err)
	}

	rows, err := repo.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	positions := make(map[uuid.UUID]int, len(rows))
	for _, row := range rows {
		positions[row.ID] = row.Position
	}
	if positions[rootC.ID] != 0 || positions[rootA.ID] != 1 || positions[childA1.ID] != 2 || positions[rootB.ID] != 3 || positions[childA2.ID] != 4 {
		t.Fatalf("unexpected root ordering: %#v", positions)
	}
	if positions[childA3.ID] != 0 {
		t.Fatalf("expected A3 to be compacted to child position 0, got %d", positions[childA3.ID])
	}
	if err := repo.Delete(ctx, rootA.ID); err != nil {
		t.Fatalf("delete with descendants failed: %v", err)
	}
	if _, err := repo.Get(ctx, childA3.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected cascade delete of A3, got %v", err)
	}
	if err := assertCompactPositions(ctx, repo); err != nil {
		t.Fatal(err)
	}
	newMenu("D", nil)
	if err := assertCompactPositions(ctx, repo); err != nil {
		t.Fatalf("create after delete left a position gap: %v", err)
	}
}

func assertCompactPositions(ctx context.Context, repo MenuRepository) error {
	rows, err := repo.List(ctx)
	if err != nil {
		return err
	}
	groups := make(map[string][]int)
	for _, row := range rows {
		parent := "root"
		if row.ParentID != nil {
			parent = row.ParentID.String()
		}
		groups[parent] = append(groups[parent], row.Position)
	}
	for parent, positions := range groups {
		sort.Ints(positions)
		for i, position := range positions {
			if i != position {
				return errors.New("sibling positions are not contiguous for parent " + parent)
			}
		}
	}
	return nil
}
