# Auto-héberger Vox

Vox est une application purement statique : trois fichiers utiles (`index.html`,
`manifest.webmanifest`, `sw.js`), deux icônes, et un petit serveur Python sans
dépendance. Il n'y a ni base de données, ni compte, ni clé d'API à configurer.

## Ce qu'il faut savoir avant de commencer

**HTTPS est obligatoire**, sauf sur `localhost`. Le micro (`getUserMedia`) et le
service worker sont refusés sur du `http://` distant par tous les navigateurs.
Un certificat gratuit suffit : Let's Encrypt via Caddy, certbot, ou le TLS
automatique de votre hébergeur.

Le navigateur doit pouvoir joindre `translate.googleapis.com` (et
`api.mymemory.translated.net` en secours). La traduction part du navigateur du
visiteur, pas de votre serveur : si vos visiteurs sont derrière un réseau qui
bloque ces domaines, il faut héberger la traduction vous-même (voir plus bas).

## Option 1 : Docker (le plus court)

```bash
unzip vox-pwa.zip
cd vox-pwa
docker compose up -d --build
```

L'application écoute sur `127.0.0.1:8080`. Pour la rendre publique, décommentez
le service `caddy` dans `docker-compose.yml`, mettez votre domaine dans
`Caddyfile`, et relancez :

```bash
docker compose up -d --build
```

Caddy obtient le certificat tout seul dès que les ports 80 et 443 sont
joignables et que le DNS pointe vers la machine.

## Option 2 : nginx + certbot

```bash
sudo mkdir -p /var/www/vox
sudo cp index.html manifest.webmanifest sw.js icon.svg icon-maskable.svg /var/www/vox/
sudo cp nginx.conf /etc/nginx/sites-available/vox
sudo ln -s /etc/nginx/sites-available/vox /etc/nginx/sites-enabled/vox
```

Remplacez `vox.exemple.fr` dans le fichier par votre domaine, puis :

```bash
sudo certbot --nginx -d vox.exemple.fr
sudo nginx -t && sudo systemctl reload nginx
```

Pour mettre à jour plus tard, il suffit de recopier `index.html` et `sw.js` :
le service worker est servi en `no-cache`, la nouvelle version apparaît donc au
rechargement suivant.

## Option 3 : sans Docker, sans nginx

```bash
python3 serve.py                    # http://0.0.0.0:8080
python3 serve.py --port 3000        # autre port
python3 serve.py --port 3000 --host 127.0.0.1   # uniquement en local
PORT=3000 python3 serve.py          # equivalent, par variable d'environnement
```

Pratique pour un NAS, un Raspberry Pi ou un test sur le réseau local. Ce
serveur ne fait pas de TLS : placez-le derrière Caddy, Traefik ou un tunnel
(Cloudflare Tunnel, ngrok) si l'app doit sortir du réseau local.

## Installer l'application sur le téléphone

- **Android / Chrome** : le bouton « Installer » apparaît dans l'app, ou menu
  ⋮ puis « Installer l'application ».
- **iPhone / Safari** : bouton Partager, puis « Sur l'écran d'accueil ». Safari
  n'expose pas d'événement d'installation, le bouton de l'app rappelle la
  manipulation.

Une fois installée, l'application s'ouvre en plein écran, sans barre d'adresse,
et démarre hors ligne avec la dernière version en cache.

## Personnaliser

| Quoi | Où |
| --- | --- |
| Langues proposées, noms et locales de lecture | `LANGS`, au début du `<script>` de `index.html` |
| Langue de dictée par défaut | attribut `value` posé sur `#sourceLang` en fin de script |
| Couleurs, rayons, polices | variables CSS `:root` en haut de `index.html` |
| Nom affiché et couleur de la barre système | `manifest.webmanifest` |
| Version du cache | `CACHE` dans `sw.js`, à changer à chaque mise à jour majeure |

### Remplacer Google par votre traduction

La fonction `viaGoogle()` de `index.html` appelle
`https://translate.googleapis.com/translate_a/single`. Pour utiliser une
instance [LibreTranslate](https://libretranslate.com/) que vous hébergez :

```js
async function viaGoogle(q, from, to) {
  const res = await fetch('https://votre-libretranslate.exemple.fr/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, source: from, target: to, format: 'text' })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data || !data.translatedText) throw new Error('Reponse inattendue');
  return String(data.translatedText).trim();
}
```

Les codes de langue de Vox (`en`, `de`, `zh`, `pt`…) sont déjà ceux attendus
par LibreTranslate. Aucune autre modification n'est nécessaire : le reste du
code appelle `translateOne()`, qui garde son repli sur MyMemory si
`viaGoogle()` échoue.

## Sauvegarde et vie privée

Les textes et les traductions vivent dans le `localStorage` du navigateur de
chaque visiteur, jamais sur le serveur. Il n'y a donc rien à sauvegarder côté
hébergement, et rien à purger côté données personnelles : votre serveur ne voit
que des requêtes de fichiers statiques.

La contrepartie : effacer les données du navigateur efface aussi l'historique
des cartes. C'est le comportement attendu d'une app locale.

## Vérifier votre installation

Après déploiement, ouvrez la page et contrôlez :

1. Le bouton « Installer » apparaît (ou la mention d'ajout à l'écran d'accueil).
2. Un appui sur le micro déclenche la demande d'autorisation, puis la dictée.
3. Un drapeau crée une carte traduite en une ou deux secondes.
4. « Lire » prononce le texte avec une voix de la bonne langue.
5. Rechargez hors ligne (mode avion, puis relance) : l'app s'ouvre encore.

En cas de doute sur le cache, `sw.js` porte un numéro de version dans `CACHE` :
l'incrémenter force tous les visiteurs à reprendre la coque à jour.

## Tests

```bash
python3 serve.py &            # ou un autre serveur sur le port 8123
PORT=8123 CHROME_BIN=/usr/bin/google-chrome node test/e2e.js 8123
node test/a11y.js 8123
```

Les tests pilotent Chrome headless par CDP avec un profil neuf à chaque
lancement, pour ne jamais servir une version périmée depuis le cache. Ils
vérifient le rendu des 16 drapeaux, une vraie traduction, la persistance après
rechargement, le service worker actif, et zéro violation WCAG 2.1 A/AA.
