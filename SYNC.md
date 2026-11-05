# Sincronització amb Firebase

La configuració del projecte (`firebase-config.js`) ja està feta. Aquesta guia recull el que cal tenir al panell de Firebase.

## 1. Regles de Firestore (OBLIGATORI actualitzar-les a la 2.4)
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
      allow read, delete: if owner(uid);
      allow create: if owner(uid) && valid();
      // Una escriptura més antiga que la que ja hi ha al núvol es rebutja.
      allow update: if owner(uid) && valid() && request.resource.data.m >= resource.data.m;
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

## 2. Com sincronitza (2.4)
Les dades ja no són un sol document: cada dia, cada judici, la configuració i cada any antic són documents independents
(`codex/{uid}/dies/2026_2026-03-05`, `judicis/…`, `anys/…`, `dades/config`), cadascun amb un segell de modificació `m`.
- Edites **dies diferents** en dos dispositius → es **fusionen**.
- Edites **el mateix dia** → guanya l'última modificació (i es guarda una còpia local de l'estat que se sobreescriu).
- Els esborrats es propaguen amb «tombstones».
- Configuració (totals, torns, festius, any actiu) i judicis editats: l'últim canvi guanya (un judici editat es tracta com a judici nou + esborrat de l'antic).
- La primera vegada, les dades del document únic de la 2.3 (`dades/estat`) es migren automàticament a l'estructura nova.
- Sense connexió es treballa en local i es puja tot en tornar-la.

## 3. Seguretat addicional (recomanat, al panell de Google/Firebase)
1. **Restringeix l'API key**: Google Cloud Console → APIs i serveis → Credencials → la clau «Browser key» → *Restriccions d'aplicació* → **Llocs web (HTTP referrers)** → afegeix `https://cathalmcdonegal.github.io/*`.
2. **App Check** (Firebase → Build → App Check): registra l'app web amb reCAPTCHA v3/Enterprise i, quan funcioni, activa-hi *Enforce* per a Firestore i Authentication.
3. **Authentication → Configuració → Dominis autoritzats**: `cathalmcdonegal.github.io`.
4. **Authentication → Configuració → Política de contrasenya**: exigeix 8+ caràcters. L'app ja demana 8 en crear el compte i envia un correu de verificació (no s'obliga a verificar-lo; si ho vols, afegeix `request.auth.token.email_verified == true` a `owner()`).
5. Plantilles de correu en català: Authentication → Plantilles.

## 4. Eliminar un compte
Des de l'app: **Més → Compte i sincronització → Eliminar compte i dades** (demana la contrasenya, esborra tots els documents i el compte).
