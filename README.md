# Codex GH 2.14.0 · Gestió horària

Aplicació web progressiva per registrar jornades, controlar el còmput anual, planificar torns i serveis, gestionar judicis i permisos, i consultar els saldos personals.

## Regles de còmput

- **Període anual:** de l'1 de febrer al 31 de gener. L'objectiu general inicial és de 1.580 hores efectives.
- **Còmput general:** hores de treball reals + assumptes personals + Dies Blaus + baixa − torn Festa. Vacances, GNP, ús d'acumulades i hores extres no s'hi sumen.
- **Matí:** base de 7,5 h; el torn ordinari 07:00–15:00 computa 8 h al general i genera 0,5 h d'acumulades abans d'aplicar el coeficient.
- **Altres torns:** les hores que superen la base del torn generen acumulades.
- **Coeficients d'acumulades:** perllongament diürn feiner ×1,25; nocturn (22:00–06:00) ×1,50; diürn en dissabte, diumenge o festiu ×1,75. El càlcul es fa minut a minut si el perllongament travessa franges.
- **Exemple:** 14:30 previst → 15:15 real = 45 min ×1,25 = 56 min 15 s d'acumulades.
- **Guàrdies nit/dia:** saldo = objectiu configurat − hores reals − hores planificades. El valor per defecte és 175,5 h, però es conserva el valor personalitzat. En iniciar un any nou s'aplica aquest valor preestablert; quan es torna a un any històric, es recupera el seu valor desat.
- **Hores nocturnes:** es compta la franja 22:00–06:00. Les guàrdies diürnes de cap de setmana o festiu també descompten del comptador.
- **Festius ordinaris:** a efectes de coeficient i guàrdia diürna, es tracten com un diumenge.
- **Festius especials de cobrament:** tenen finestres pròpies a 14 €/h o 24 €/h. Les franges 06:00–06:30 que s'estenen fins a l'endemà són de **24,5 hores**, no de 30 minuts. El cobrament especial exigeix almenys 3 hores efectivament treballades dins la finestra i és incompatible amb el cobrament com a hores extraordinàries.
- **Setmana:** les hores computables setmanals segueixen la mateixa regla que el còmput general anual; s'hi inclouen AP, Dies Blaus i baixa i no s'hi inclouen vacances ni GNP.

## Registrar una jornada

1. Obre un dia al calendari o a la setmana i selecciona el tipus de registre.
2. En un registre de treball, selecciona el torn i comprova entrada i sortida.
3. Si la sortida és l'endemà i l'hora final és igual o posterior a l'hora d'entrada (per exemple, 06:00–06:30 = 24,5 h), marca **Sortida l'endemà**.
4. Les hores es calculen automàticament. No es permet desar una entrada i sortida iguals sense marcar la sortida l'endemà.
5. Desa el registre. Les acumulades ponderades i els pagaments especials s'actualitzen automàticament.

## Planificació de torns

- Crea un perfil Q5, Q3, 7x7, Investigació o personalitzat.
- Defineix escamot, seqüència, data de referència, unitat de rotació i fase.
- Un canvi puntual substitueix el torn base del dia.
- Un servei addicional s'afegeix sense substituir el torn base.
- L'app rebutja serveis duplicats o amb solapament horari, inclosos els que creuen la mitjanit i coincideixen amb el dia següent.
- La planificació no entra al còmput general fins que es registra la jornada real; les guàrdies previstes sí que descompten del comptador Guardies nit/dia.
- Quan ja hi ha un registre real per a una data, les previsions d'aquell dia deixen de descomptar-se.

## Pantalles i funcions

- **Inici:** saldo i progrés anual, comptadors, registre del dia, pròxims judicis i accions pendents.
- **Calendari:** vista mensual, resum mensual, selecció múltiple i accés als registres.
- **Setmana:** set dies, hores computables i referència de 37,5 h.
- **Judicis:** agenda, cerca, estats pendent/suspès/celebrat/cobrat i observacions.
- **Permisos:** catàleg informatiu de llicències, permisos i reduccions.
- **Més / Configuració:** objectius, bosses, guàrdies, torns, colors, tema, notificacions, perfils i planificació.
- **Anàlisi anual:** resum mensual, gràfic, previsió orientativa i simulador de torns.
- **Còpies i exportacions:** JSON complet, CSV i PDF/Imprimir.
- **PWA i sincronització:** instal·lació, ús offline i sincronització opcional amb Firebase quan està configurada.

## Proves de regressió

Executa des de la carpeta del projecte:

```bash
node test-merge.js
node test-calc.js
node test-planning.js
node test-sync.js
```

- `test-calc.js`: còmput anual, migracions, canvi d'any, coeficients, finestres especials de 24,5 h i coherència setmanal.
- `test-planning.js`: serveis duplicats, solapaments i torns que creuen la mitjanit.
- `test-merge.js` i `test-sync.js`: fusió i sincronització entre dispositius.

## Fitxers principals

| Fitxer | Responsabilitat |
|---|---|
| `index.html` | Interfície, formularis i estils |
| `app.js` | Estat, registres, còmput, calendari, judicis, permisos i exportacions |
| `payroll.js` | Guàrdies, coeficients i pagaments especials |
| `shift-profiles.js` | Perfils, cicles i serveis planificats |
| `home.js` | Resum inicial i accions pendents |
| `sync.js` / `merge.js` | Sincronització i fusió |
| `sw.js` / `manifest.json` | PWA, memòria cau i instal·lació |

Les regles efectives de Firebase s'han de revisar al projecte Firebase; el repositori no pot confirmar per si sol quines regles hi ha desplegades.
