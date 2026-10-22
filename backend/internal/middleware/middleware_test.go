package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSUsesConfiguredOriginAllowlist(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS([]string{"http://localhost:3000", "https://menus.example.com"}))
	router.GET("/resource", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	router.OPTIONS("/resource", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	tests := []struct {
		name            string
		method          string
		origin          string
		wantStatus      int
		wantAllowOrigin string
	}{
		{name: "local origin", method: http.MethodGet, origin: "http://localhost:3000", wantStatus: http.StatusNoContent, wantAllowOrigin: "http://localhost:3000"},
		{name: "production origin preflight", method: http.MethodOptions, origin: "https://menus.example.com", wantStatus: http.StatusNoContent, wantAllowOrigin: "https://menus.example.com"},
		{name: "unknown origin", method: http.MethodOptions, origin: "https://malicious.example", wantStatus: http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/resource", nil)
			req.Header.Set("Origin", tt.origin)
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)
			if res.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", res.Code, tt.wantStatus)
			}
			if got := res.Header().Get("Access-Control-Allow-Origin"); got != tt.wantAllowOrigin {
				t.Fatalf("allow-origin = %q, want %q", got, tt.wantAllowOrigin)
			}
		})
	}
}
