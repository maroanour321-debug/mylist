import http.server, socketserver, functools, re
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if "/watch/" in self.path or "episode" in self.path:
            body = open("watch.html","rb").read()
            body = body.replace(b"EP_N", re.search(r"episode-(\d+)", self.path).group(1).encode())
            self.send_response(200); self.send_header("Content-Type","text/html; charset=utf-8"); self.end_headers(); self.wfile.write(body)
        elif self.path == "/series/test/":
            body = open("index.html","rb").read()
            self.send_response(200); self.send_header("Content-Type","text/html; charset=utf-8"); self.end_headers(); self.wfile.write(body)
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 8777), H) as httpd:
    httpd.serve_forever()
