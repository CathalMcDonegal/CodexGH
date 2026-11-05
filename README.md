# Codex GH 2.4 (Codex Gestió Horaria)

Càlculs alineats amb el règim de 1580 h efectives dels Mossos d'Esquadra.

## Regles de còmput (una sola implementació: `calc()` a `app.js`)
- **Còmput general (1580 h):** treball + assumptes + dies blaus + baixa − torn festa. Vacances i GNP **no** hi entren.
- **Matí:** marc de **7,5 h (07:00–14:30)**, però per defecte es fan **8 h (07:00–15:00)**: **8 h al general** i **0,5 h a acumulades**. Un matí mai compta menys de 8 h.
- **Altres torns:** les hores per sobre de la base del torn (tarda 7,5 · nit 9 · caps de setmana 12) van a acumulades.
- **Nits:** al bo de nits només les hores **22:00–06:00**; la resta del torn només al general.
- **Vacances / GNP / ús d'acumulades / extres:** només el seu bo o comptador.
- **Assumptes i Dies Blaus:** el seu bo **i** el còmput general.

## Estructura
| Fitxer | Contingut |
|---|---|
| `index.html` | Marcatge i estils |
| `app.js` | Estat, càlculs, vistes, exportacions |
| `home.js` | Pantalla d'inici: pròxims, pendents, cobrament especial |
| `ui.js` | Diàlegs propis (confirmar, avisar, formularis) |
| `merge.js` | Nucli de fusió/sincronització (pur, amb proves) |
| `sync.js` | Firebase: compte + sincronització |
| `sw.js` | Service worker (funciona sense connexió) |
| `test-*.js` | Proves: `node test-merge.js` · `node test-calc.js` · `node test-sync.js` |

## Publicació (GitHub Pages)
Puja **tot el contingut** del zip (incloses les carpetes el fitxer `.nojekyll`). Esborra del repositori els fitxers antics: `sync.js`, `hours-auto.js`, `home-actions.js`, `_sync_trigger.txt`, `icon-512.jpg`, `icons/` i la carpeta `.github/workflows` (el workflow que reescrivia `index.html` ja no fa falta).

## Comptes i sincronització
Veure `SYNC.md` (**cal actualitzar les regles de Firestore**). Sense `firebase-config.js` omplert, l'app funciona només en local i sense pantalla de bloqueig.
