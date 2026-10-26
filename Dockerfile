# Vox - image minimale, sans dependance applicative.
FROM python:3.12-slim

LABEL org.opencontainers.image.title="Vox" \
      org.opencontainers.image.description="PWA de dictee, traduction et lecture vocale" \
      org.opencontainers.image.licenses="MIT"

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

# Seulement ce qu'il faut pour servir l'application.
COPY serve.py index.html manifest.webmanifest sw.js icon.svg icon-maskable.svg ./

# Utilisateur non privilegie.
RUN useradd --system --uid 10001 --shell /usr/sbin/nologin vox \
    && chown -R vox:vox /app
USER vox

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python3 -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/index.html', timeout=2).status==200 else 1)"

CMD ["python3", "serve.py"]
