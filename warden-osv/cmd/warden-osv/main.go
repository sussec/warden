// warden-osv is Techanv Warden's OSV.dev advisory service: a cached, typed
// facade over https://api.osv.dev used by warden-api for finding and package
// advisory enrichment.
//
// Configuration (environment):
//
//	PORT         listen port                          (default 9000)
//	OSV_URL      OSV-compatible API base URL          (default https://api.osv.dev)
//	CACHE_TTL    advisory cache TTL, Go duration      (default 1h)
//	CACHE_MAX    max cached entries per cache         (default 10000)
//	EPSS_URL     FIRST.org EPSS API base URL          (default https://api.first.org/data/v1/epss)
//	KEV_URL      CISA KEV catalog JSON feed URL       (default cisa.gov feed)
//	KEV_REFRESH  KEV catalog refresh interval         (default 6h)
//	ENRICH       set "false" to disable EPSS/KEV      (default true)
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/sussec/warden/warden-osv/internal/enrich"
	"github.com/sussec/warden/warden-osv/internal/osv"
	"github.com/sussec/warden/warden-osv/internal/server"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	port := envOr("PORT", "9000")
	baseURL := envOr("OSV_URL", osv.DefaultBaseURL)
	ttl := durationOr(log, "CACHE_TTL", time.Hour)
	maxEntries := intOr(log, "CACHE_MAX", 10_000)

	var enricher *enrich.Enricher
	rootCtx, rootCancel := context.WithCancel(context.Background())
	defer rootCancel()
	if envOr("ENRICH", "true") != "false" {
		epss := enrich.NewEpss(envOr("EPSS_URL", enrich.DefaultEpssURL), 12*time.Hour, maxEntries)
		kev := enrich.NewKev(envOr("KEV_URL", enrich.DefaultKevURL), log)
		go kev.Run(rootCtx, durationOr(log, "KEV_REFRESH", 6*time.Hour))
		enricher = enrich.New(epss, kev, log)
	}

	client := osv.NewClient(osv.WithBaseURL(baseURL))
	srv := server.New(client, log, server.Config{CacheTTL: ttl, CacheMax: maxEntries, Enricher: enricher})

	httpSrv := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Info("warden-osv listening", "port", port, "osv_url", baseURL, "cache_ttl", ttl.String())
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(ctx); err != nil {
		log.Error("graceful shutdown failed", "error", err)
	}
	log.Info("warden-osv stopped")
}

func envOr(name, def string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return def
}

func durationOr(log *slog.Logger, name string, def time.Duration) time.Duration {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		log.Warn("invalid duration, using default", "var", name, "value", v, "default", def.String())
		return def
	}
	return d
}

func intOr(log *slog.Logger, name string, def int) int {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		log.Warn("invalid integer, using default", "var", name, "value", v, "default", def)
		return def
	}
	return n
}
