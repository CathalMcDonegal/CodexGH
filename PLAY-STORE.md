# Guia: publicar Codex GH a Google Play

## Fitxers d’aquest paquet

| Fitxer | Ús |
|--------|-----|
| `privacitat.html` | Política de privadesa (actualitzada: compte Firebase, sincronització i eliminació del compte) |
| `assetlinks.json` | Verificació TWA (cal omplir el SHA-256 i publicar-lo a `/.well-known/assetlinks.json` del domini) |
| `.nojekyll` | Perquè GitHub Pages serveixi carpetes amb punt (`.well-known`) |
| `manifest.json` | Manifest PWA (icones `any` i `maskable`) |
| `index.html` / `app.js` / `sync.js` / `sw.js`… | App |

URL pública prevista (GitHub Pages del projecte):

- App: `https://cathalmcdonegal.github.io/Registre-Horari/`
- Privadesa: `https://cathalmcdonegal.github.io/Registre-Horari/privacitat.html`

## Pas 1 — Puja els fitxers al GitHub

1. Puja tot el contingut d’aquest paquet al repo `Registre-Horari` (tot al mateix nivell, inclòs `.nojekyll`).
2. **assetlinks.json**: Android el demana a l’arrel del **domini**: `https://cathalmcdonegal.github.io/.well-known/assetlinks.json`.
   Això només funciona amb un repo *user site* anomenat `cathalmcdonegal.github.io` (crea-hi la carpeta `.well-known` amb `assetlinks.json` i el fitxer `.nojekyll`).
   Amb només el repo de projecte no es pot verificar la TWA (Bubblewrap/PWA Builder t’ho dirà).

## Pas 2 — Icones
Ja hi ha `icon-192.png`, `icon-512.png` i `icon-512-maskable.png` (zona segura per a icones adaptatives d’Android).
**Revisa que tinguis drets sobre la il·lustració de la icona**: Google Play rebutja apps que usen personatges o obres de tercers.

## Pas 3 — Compte Google Play

1. https://play.google.com/console → pagar **25 USD** (únic).
2. Crear app → nom **Codex GH**, idioma predeterminat **català**.

## Pas 4 — Generar l’AAB (Android App Bundle)

### Opció recomanada: PWA Builder
1. https://www.pwabuilder.com
2. Introdueix: `https://cathalmcdonegal.github.io/Registre-Horari/`
3. Package → Android → descarrega el projecte / AAB
4. Anota el **package name** (p.ex. `cat.mossos.registrehorari`) i el **SHA-256**

### Opció tècnica: Bubblewrap
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://cathalmcdonegal.github.io/Registre-Horari/manifest.json
bubblewrap build
```

## Pas 5 — Completar assetlinks.json

1. A Play Console → la teva app → **Configuració → Integritat de l’app → Signatura de l’app**
2. Copia l’empremta **SHA-256** de la clau de **signatura de l’app** (Play App Signing), no només la d’upload.
3. Enganxa-la a `assetlinks.json` (substitueix el text `SUBSTITUEIX_...`).
4. Assegura’t que `package_name` coincideix amb el de l’AAB.
5. Puja el fitxer i comprova a l’navegador que retorna JSON (codi 200).

## Pas 6 — Fitxa de Play Console

- **Descripció curta** (80 caràcters): p.ex. «Registre d’hores personal per a Mossos. 1580 h, nits, vacances i sincronització.»
- **Descripció completa**: funcionalitats + que les dades són locals i, si inicies sessió, es sincronitzen al teu compte
- **Política de privadesa**: URL de `privacitat.html`
- **Captures**: mínim 2 pantalles de mòbil (fes captures des del Chrome del mòbil)
- **Icona**: 512×512
- **Categoria**: Productivitat
- **Públic**: 18+ o segons el que indiquis (no orientada a menors)

## Secció «Seguretat de les dades» (Data safety) i eliminació de compte
- Dades recollides: **adreça de correu** (informació personal) i **contingut de l’usuari** (registres, notes, judicis). Finalitat: funcionalitat de l’app. No es comparteixen. Xifrades en trànsit.
- Eliminació: indica que l’usuari pot eliminar el compte i les dades **dins l’app** (Més → Compte i sincronització → Eliminar compte i dades). Play també demana una URL web d’eliminació: pots usar la de `privacitat.html` (apartat 8).

## Pas 7 — Enviar a revisió

Completa el qüestionari de contingut, països i preu (gratuïta). Envia a revisió.

## Notes

- Actualitzar només el codi a GitHub Pages actualitza el contingut de la TWA sense nova versió a Play (URL fixa).
- Canvis al package nadiu (nom, permisos) sí que requereixen nou AAB a Play.
- iOS / App Store és un procés a part (Apple Developer, ~99 USD/any).
