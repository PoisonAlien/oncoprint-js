#!/usr/bin/env python3
"""
Simple HTTP server to serve the examples locally.
This solves the CORS issues with ES modules.

Usage: python serve.py
Then open http://localhost:8000 in your browser
"""

import http.server
import socketserver
import os
import sys

# Change to the project root directory
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(project_root)

PORT = 8000

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def guess_type(self, path):
        mimetype, encoding = super().guess_type(path)
        # Ensure .js files are served with correct MIME type
        if path.endswith('.js'):
            return 'application/javascript'
        return mimetype, encoding

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        print(f"Examples available at:")
        print(f"  http://localhost:{PORT}/examples/basic-usage-simple.html")
        print(f"  http://localhost:{PORT}/examples/basic-usage.html")
        print(f"\nPress Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")
            sys.exit(0)