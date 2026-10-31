package desktop

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"stitch/internal/server"

	"github.com/wailsapp/wails/v2/pkg/assetserver"
	opts "github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

// The webview has no API server to talk to: Wails must serve the UI from the embedded
// assets and hand every /api request to the Go router.
func TestAssetServerRoutesAPIToGo(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	assets := fstest.MapFS{"dist/index.html": {Data: []byte("<html>stitch</html>")}}
	h, err := assetserver.NewAssetHandler(opts.Options{Assets: assets, Handler: server.Routes()}, nil)
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		method, path string
		want         string
	}{
		{"GET", "/", "stitch"},
		{"GET", "/api/diagrams", `"files"`},
		{"POST", "/api/diagrams", "error"}, // reaches the handler, which rejects the empty body
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(c.method, c.path, strings.NewReader("")))
		if rec.Code == http.StatusNotFound || !strings.Contains(rec.Body.String(), c.want) {
			t.Errorf("%s %s = %d %q, want body containing %q", c.method, c.path, rec.Code, rec.Body.String(), c.want)
		}
	}
}
