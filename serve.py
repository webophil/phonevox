#!/usr/bin/env python3
"""Vox - petit serveur statique pour l'auto-hebergement.

Sert le dossier courant avec les bons types MIME et les bonnes en-tetes de
cache pour une PWA. Aucune dependance hors de la bibliotheque standard.

Usage :
    python3 serve.py                 # http://0.0.0.0:8080
    python3 serve.py --port 3000     # autre port
    python3 serve.py --port 3000 --host 127.0.0.1   # uniquement en local
    PORT=3000 python3 serve.py       # equivalent, par variables d'environnement

Les arguments --port/--host ont la priorite sur PORT/HOST. Avant, un --port
passe en ligne de commande etait ignore en silence et le serveur restait sur
8080 : c'est corrige ci-dessous.

En production, placez un reverse proxy TLS devant (Caddy, nginx, Traefik) :
le micro et le service worker exigent https:// (sauf sur localhost).
"""

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


def _cli(flag):
    """Valeur passee en ligne de commande : --port 3000 ou --port=3000."""
    argv = sys.argv[1:]
    for i, arg in enumerate(argv):
        if arg == flag and i + 1 < len(argv):
            return argv[i + 1]
        if arg.startswith(flag + "="):
            return arg.split("=", 1)[1]
    return None


HOST = _cli("--host") or os.environ.get("HOST", "0.0.0.0")
try:
    PORT = int(_cli("--port") or os.environ.get("PORT", "8080"))
except ValueError:
    sys.exit("Port invalide : indiquez un nombre, par exemple --port 8080.")

# Types que la bibliotheque standard ne connait pas ou connait mal.
EXTRA_TYPES = {
    ".webmanifest": "application/manifest+json",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".js": "text/javascript; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".wasm": "application/wasm",
}

# Fichiers qui doivent toujours etre revalides : sans cela, une mise a jour
# de l'application reste invisible pendant des jours chez les visiteurs.
NO_CACHE = {"/index.html", "/", "/sw.js", "/manifest.webmanifest"}


class VoxHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        base, ext = os.path.splitext(path)
        if ext.lower() in EXTRA_TYPES:
            return EXTRA_TYPES[ext.lower()]
        return super().guess_type(path)

    def end_headers(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path in NO_CACHE or path.endswith("/"):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        elif path.startswith("/icon") or path.startswith("/apple-touch-icon"):
            self.send_header("Cache-Control", "public, max-age=604800")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")

        # En-tetes de securite raisonnables pour une page autonome.
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header(
            "Permissions-Policy",
            "microphone=(self), camera=(), geolocation=(), payment=()",
        )
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    if not os.path.isfile(os.path.join(ROOT, "index.html")):
        sys.exit("index.html introuvable : lancez serve.py depuis le dossier de l'application.")

    httpd = ThreadingHTTPServer((HOST, PORT), VoxHandler)
    shown = "localhost" if HOST in ("0.0.0.0", "::") else HOST
    print("Vox sert %s" % ROOT)
    print("  http://%s:%d" % (shown, PORT))
    if HOST in ("0.0.0.0", "::"):
        print("  accessible aussi depuis le reseau local, sur l'IP de cette machine")
    print("Ctrl+C pour arreter.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArret.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
