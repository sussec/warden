package cache

import (
	"testing"
	"time"
)

func TestGetSet(t *testing.T) {
	c := New[string](time.Minute, 10)
	if _, ok := c.Get("a"); ok {
		t.Fatal("empty cache should miss")
	}
	c.Set("a", "1")
	if v, ok := c.Get("a"); !ok || v != "1" {
		t.Fatalf("want hit '1', got %q ok=%v", v, ok)
	}
}

func TestExpiry(t *testing.T) {
	c := New[string](time.Minute, 10)
	base := time.Now()
	c.now = func() time.Time { return base }
	c.Set("a", "1")
	c.now = func() time.Time { return base.Add(2 * time.Minute) }
	if _, ok := c.Get("a"); ok {
		t.Fatal("expired entry should miss")
	}
	if c.Len() != 0 {
		t.Fatalf("expired entry should be collected, len=%d", c.Len())
	}
}

func TestLruEviction(t *testing.T) {
	c := New[int](time.Minute, 2)
	c.Set("a", 1)
	c.Set("b", 2)
	c.Get("a") // a is now most recent
	c.Set("c", 3)
	if _, ok := c.Get("b"); ok {
		t.Fatal("b should have been evicted")
	}
	if _, ok := c.Get("a"); !ok {
		t.Fatal("a should survive")
	}
	if c.Len() != 2 {
		t.Fatalf("len=%d", c.Len())
	}
}

func TestUpdateRefreshes(t *testing.T) {
	c := New[int](time.Minute, 2)
	c.Set("a", 1)
	c.Set("a", 2)
	if v, _ := c.Get("a"); v != 2 {
		t.Fatalf("want 2, got %d", v)
	}
	if c.Len() != 1 {
		t.Fatalf("update should not duplicate, len=%d", c.Len())
	}
}
