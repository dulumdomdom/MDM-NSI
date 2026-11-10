#!/usr/bin/env python3
"""MDM NSI - local web server for an offline Linux / macOS PC (standard library only).

Serves ./app on http://localhost:<port>/ with SPA fallback (unknown routes -> index.html).
Usage:  python3 serve.py [port]   (default 8080)
"""

import http.server
import os
import sys
import webbrowser

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
        ".json": "application/json",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        target = self.translate_path(path)
        # Application route without a file extension -> SPA entry point
        if not os.path.exists(target) and not os.path.splitext(path)[1]:
            self.path = "/index.html"
        return super().send_head()

    def end_headers(self):
        cache = "public, max-age=31536000, immutable" if "/assets/" in self.path else "no-cache"
        self.send_header("Cache-Control", cache)
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    if not os.path.isfile(os.path.join(ROOT, "index.html")):
        sys.exit(f"index.html not found in {ROOT}")
    # localhost only: service workers (demo data) require localhost or HTTPS
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://localhost:{PORT}/"
    print(f"\n  MDM NSI is running:  {url}\n  Press Ctrl+C to stop.\n")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
