// Package cache provides a small concurrency-safe TTL cache with a hard
// entry cap, used to keep hot advisories off the network.
package cache

import (
	"container/list"
	"sync"
	"time"
)

// Cache is an LRU cache whose entries expire after a fixed TTL.
type Cache[V any] struct {
	mu      sync.Mutex
	ttl     time.Duration
	max     int
	order   *list.List // front = most recently used
	entries map[string]*list.Element
	now     func() time.Time
}

type entry[V any] struct {
	key     string
	value   V
	expires time.Time
}

// New builds a cache holding at most max entries for ttl each.
func New[V any](ttl time.Duration, max int) *Cache[V] {
	return &Cache[V]{
		ttl:     ttl,
		max:     max,
		order:   list.New(),
		entries: make(map[string]*list.Element),
		now:     time.Now,
	}
}

// Get returns the cached value and whether it was present and fresh.
func (c *Cache[V]) Get(key string) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	el, ok := c.entries[key]
	if !ok {
		var zero V
		return zero, false
	}
	e := el.Value.(*entry[V])
	if c.now().After(e.expires) {
		c.order.Remove(el)
		delete(c.entries, key)
		var zero V
		return zero, false
	}
	c.order.MoveToFront(el)
	return e.value, true
}

// Set stores a value, evicting the least recently used entry when full.
func (c *Cache[V]) Set(key string, value V) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.entries[key]; ok {
		e := el.Value.(*entry[V])
		e.value = value
		e.expires = c.now().Add(c.ttl)
		c.order.MoveToFront(el)
		return
	}
	if c.order.Len() >= c.max {
		oldest := c.order.Back()
		if oldest != nil {
			c.order.Remove(oldest)
			delete(c.entries, oldest.Value.(*entry[V]).key)
		}
	}
	c.entries[key] = c.order.PushFront(&entry[V]{key: key, value: value, expires: c.now().Add(c.ttl)})
}

// Len reports the current number of entries (fresh or not yet collected).
func (c *Cache[V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.order.Len()
}
