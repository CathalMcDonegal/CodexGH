# Sincronització i seguretat amb Firebase — Codex GH 3.0

La configuració del projecte (`firebase-config.js`) ja està feta. Aquesta guia recull el que cal tenir al panell de Firebase.

## 1. Regles de Firestore (obligatori revisar-les abans de publicar)
**Build → Firestore Database → Regles** → enganxa-ho i prem **Publica**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function owner(uid) { return request.auth != null && request.auth.uid == uid; }
    function valid() {
      let d = request.resource.data;
      return d.keys().hasOnly(['j','m','d']) && d.m is number
          && d.j is string && d.j.size() < 200000 && d.d in [0,1];
    }
    // Codex GH (dades pròpies, separades de l'app antiga)
    match /codex/{uid}/{col}/{docId} {
      allow read, delete: if owner(uid) && col in ['dades', 'anys', 'dies', 'judicis'];
      allow create: if owner(uid) && col in ['dades', 'anys', 'dies', 'judicis'] && valid();
      // Una escriptura més antiga que la que ja hi ha al núvol es rebutja.
      allow update: if owner(uid) && col in ['dades', 'anys', 'dies', 'judicis'] && valid() && request.resource.data.m >= resource.data.m;
    }
    // ⚠️ Si encara fas servir l'app antiga (Registre Horari) al mateix projecte, MANTÉN també les seves regles:
    match /usuaris/{uid}/{document=**} {
      allow read, write: if owner(uid);
    }
  }
}
```
Amb les regles antigues l'app també funciona, però sense la protecció contra escriptures velles.

## 1b. Separada de l'app antiga
Codex GH comparteix l'origen web (`cathalmcdonegal.github.io`) amb l'app antiga, per això:
- Guarda les dades locals amb noms propis (`codexGH…`) i **no veu** les de l'altra app.
- Fa servir una app Firebase amb nom propi: **no hereta la sessió** de l'altra app i cal iniciar sessió/registrar-se.
- Al núvol escriu a l'arrel `codex/{uid}/…`, no a `usuaris/…`: les dades són buides i independents.
- Els comptes (correu/contrasenya) sí que són els mateixos si uses el mateix projecte Firebase. Si vols comptes **totalment separats**, crea un projecte Firebase nou i enganxa'n la configuració a `firebase-config.js`.

## 2. Com sincronitza (3.0)
Les dades ja no són un sol document: cada dia, cada judici, la configuració i cada any antic són documents independents
(`codex/{uid}/dies/2026_2026-03-05`, `judicis/…`, `anys/…`, `dades/config`), cadascun amb un segell de modificació `m`.
- Edites **dies diferents** en dos dispositius → es **fusionen**.
- Edites **el mateix dia** → guanya l'última modificació (i es guarda una còpia local de l'estat que se sobreescriu).
- Els esborrats es propaguen amb «tombstones».
- Configuració (totals, torns, festius, any actiu) i judicis editats: l'últim canvi guanya (un judici editat es tracta com a judici nou + esborrat de l'antic).
- La primera vegada, les dades del document únic de la 2.3 (`dades/estat`) es migren automàticament a l'estructura nova.
- Sense connexió es treballa en local i es puja tot en tornar-la.

## 3. Límit important: ús en un únic telèfon

La preferència del projecte és ús personal des d'un únic telèfon Android, sense ordinador ni altres usuaris. **La versió actual encara no ho pot imposar tècnicament.** El compte Firebase està protegit per UID, però qualsevol dispositiu on s'iniciï sessió amb les mateixes credencials pot accedir a les dades d'aquell compte. El bloqueig visual de l'escriptori i un identificador guardat a `localStorage` no són mesures de seguretat.

Per fer complir de debò un únic dispositiu cal un servei de backend que registri i autoritzi el dispositiu, i que validi cada operació de sincronització. Per a Android, cal valorar Play Integrity/attestació i App Check, amb procediment segur de canvi de telèfon i recuperació. No s'ha d'activar una regla que bloquegi dispositius fins que existeixi aquest backend i s'hagi provat la recuperació: es podria perdre l'accés a les còpies del núvol.

Fins que això estigui implementat, no comparteixis les credencials ni iniciïs sessió en cap altre dispositiu.

## 4. Seguretat addicional (recomanat, al panell de Google/Firebase)
1. **Restringeix l'API key**: Google Cloud Console → APIs i serveis → Credencials → la clau «Browser key» → *Restriccions d'aplicació* → **Llocs web (HTTP referrers)** → afegeix `https://cathalmcdonegal.github.io/*`.
2. **App Check** (Firebase → Build → App Check): registra l'app web amb reCAPTCHA v3/Enterprise i, quan funcioni, activa-hi *Enforce* per a Firestore i Authentication.
3. **Authentication → Configuració → Dominis autoritzats**: `cathalmcdonegal.github.io`.
4. **Authentication → Configuració → Política de contrasenya**: exigeix 8+ caràcters. L'app ja demana 8 en crear el compte i envia un correu de verificació (no s'obliga a verificar-lo; si ho vols, afegeix `request.auth.token.email_verified == true` a `owner()`).
5. Plantilles de correu en català: Authentication → Plantilles.

## 5. Eliminar un compte
Des de l'app: **Més → Compte i sincronització → Eliminar compte i dades** (demana la contrasenya, esborra tots els documents i el compte).
