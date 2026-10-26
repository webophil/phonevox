# Vox — dicter, traduire, écouter

PWA installable en un seul écran : on dicte un texte, on touche un drapeau, la traduction arrive dans une carte, et « Lire » la prononce avec la voix du téléphone.

## Lancer en local

Le service worker et le micro exigent `https://` ou `localhost` : ouvrir `index.html` par double-clic ne suffit pas.

```bash
cd /space/spaces/sp_mvpsqq3aixnos1/work
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Installer sur le téléphone

- **Android / Chrome** : bouton « Installer » dans l'app, ou menu ⋮ → « Installer l'application ».
- **iPhone / Safari** : bouton Partager → « Sur l'écran d'accueil ». Le bouton « Installer » de l'app rappelle la manip.

Pour un vrai téléphone, servir le dossier en HTTPS (ngrok, Cloudflare Tunnel, ou un hébergement statique) : le micro est refusé en `http://` sur un autre hôte que `localhost`.

## Auto-héberger

Le dossier est prêt à être mis derrière un vrai domaine, en HTTPS. Trois
chemins possibles, détaillés dans [DEPLOY.md](DEPLOY.md) :

```bash
docker compose up -d --build     # image minimale, reverse proxy Caddy fourni
python3 serve.py                 # serveur statique sans dépendance
python3 serve.py --port 3000     # ou sur un autre port
# ou nginx.conf + certbot
```

`DEPLOY.md` couvre aussi l'installation sur le téléphone, le remplacement de
Google par une instance LibreTranslate, et la procédure de mise à jour.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | l'application entière : interface, dictée, traduction, lecture |
| `manifest.webmanifest` | nom, icônes, mode plein écran, couleurs |
| `sw.js` | cache de la coque pour l'ouverture hors ligne |
| `icon.svg`, `icon-maskable.svg` | icônes d'installation |
| `serve.py` | serveur statique autonome, types MIME et cache corrects |
| `Dockerfile`, `docker-compose.yml` | image de quelques mégaoctets, utilisateur non privilégié |
| `Caddyfile`, `nginx.conf` | configurations prêtes, TLS et en-têtes de sécurité |
| `DEPLOY.md` | guide d'auto-hébergement complet |
| `test/e2e.js`, `test/a11y.js` | tests de bout en bout et accessibilité |

## Tests

Serveur lancé sur le port 8123, puis :

```bash
node test/e2e.js 8123    # parcours réel : drapeau, traduction, lecture, persistance, service worker
node test/a11y.js 8123   # axe-core, WCAG 2.1 A/AA
```

Les deux pilotent Chrome headless par CDP (`test/cdp.js`), avec un profil neuf à chaque lancement : le service worker ne sert donc jamais une version périmée.

## Comment ça marche

- **Dictée** : `SpeechRecognition` (Chrome, Edge, Safari 14.1+). Résultat intermédiaire affiché en italique, les phrases finales s'ajoutent au texte. `continuous` garde le micro ouvert et le relance après une coupure.
- **Traduction** : endpoint public `translate.googleapis.com` (découpé en morceaux de 1100 caractères), repli sur MyMemory. Nécessite le réseau.
- **Lecture** : `speechSynthesis`, voix choisie sur la locale de la carte (`de-DE`, `ja-JP`…), texte découpé en segments de 190 caractères pour éviter les coupures. Si la voix n'est pas installée sur l'appareil, la carte le signale.
- **Mémoire** : texte et cartes dans `localStorage`, donc rien n'est envoyé ailleurs qu'au service de traduction.

## Limites connues

- La dictée dépend du navigateur, pas de l'app : Firefox ne l'implémente pas encore.
- Les langues sans voix installée (souvent le chinois, l'arabe, le japonais sur un iPhone neuf) se lisent avec une prononciation approximative tant que la voix n'est pas téléchargée dans les réglages du système.
- Les endpoints de traduction publics peuvent limiter le débit ; la carte affiche alors « Réessayer ».
- La page est servie réseau d'abord, cache ensuite : une mise à jour est visible au rechargement, et l'app s'ouvre quand même hors ligne avec la dernière version en cache.
