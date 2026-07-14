# Karriere-Modus

Ein optionaler **Extra-Modus** neben solo/local/remote/room: eine persistente, gegen die
Uhr laufende Trader-Karriere. Bewusst **vollständig isoliert** — er berührt weder die
deterministische Fairness der Duell-Modi noch den Bestrekord noch die Ergebnis-Vergleiche und
hat eine eigene Persistenz.

## Kernidee

- **Alles steht auf dem Spiel:** der angesparte Kontostand *ist* das Handelskapital. Gewinne
  compounden, Verluste schrumpfen ihn. Fällt das Vermögen unter `CAREER_MIN` (500 $), gibt es
  einen Bailout auf `CAREER_START` (10.000 $) — die gekauften Trophäen bleiben (einziger sicherer
  Hafen).
- **Echtzeit / Idle:** der Markt läuft nach **Weltzeit durchgehend weiter**, auch wenn die App zu
  ist. Beim Zurückkommen ist er weitergelaufen; die Positionen sind neu bewertet.
- **Nur Kosmetik:** vom Gewinn kauft man rein optische Angeber-Objekte (`CAREER_ITEMS`), die in
  einer Vitrine landen. Kein Balance-Einfluss.
- **Sammel-Ziel:** Vermögens-Meilensteine (`CAREER_RANKS`, reine Text-Titel) + Trophäen-Sammlung.

## Der endlose Markt (engine.js, rein & testbar)

`genMarket` liefert nur endliche Arrays, also ist die Karriere-Zeitachse in **Epochen** von
`CAREER_EPOCH_TICKS` (~1 h) geschnitten. Drei pure Funktionen bauen daraus einen nahtlosen
Endlos-Markt, allein aus `(careerSeed, Epoche)` — nach beliebiger Auszeit exakt reproduzierbar:

- `epochSeed(careerSeed, e)` — deterministischer Sub-Seed je Epoche (Avalanche-Mix).
- `careerCarry(careerSeed, upto, epochTicks, cache?)` — **Carry-Faktoren** je Aktie am Beginn von
  Epoche `upto` = Produkt der relativen Bewegungen aller früheren Epochen. Optional ab einem
  gecachten `{carry, epoch}` fortsetzen, sodass nach langer Auszeit nur die *neuen* Epochen
  simuliert werden.
- `careerMarket(careerSeed, e, carry, epochTicks)` — der Effektivmarkt der Epoche `e`: ein
  `genMarket`-Lauf, dessen Aktien-Pfade × `carry`, danach MKT/ACT aus den **übertragenen**
  Bestandteilen neu abgeleitet (`addEtfPath`/`addActivePath`). So startet Epoche `e` exakt dort,
  wo `e-1` endete → glaubwürdige, stufenlose Kurve.

Bewiesen in `career.test.js` (Determinismus, Epochen-Kontinuität inkl. Index, Carry-Cache-Äquivalenz).

## Persistenz (`trading-duell-career`)

`{ seed, anchor, cash, pos, owned[], peakNet, carry, carryEpoch, lastTotal, busted }` — alles in
try/catch (wie die übrige Persistenz). Positionen + Cash überleben Sessions; der Markt wird aus
`seed`+`anchor`+`Date.now()` rekonstruiert. `carry`/`carryEpoch` cachen den Epochen-Übertrag.

**Downtime-Regel (gegen Idle-Exploits):** Beim Catch-up über Weltzeit werden Positionen nur *neu
bewertet* — es werden KEINE Dividenden/Kosten je übersprungenem Tick nachgebucht. Dividenden laufen
nur, während man aktiv zuschaut (der normale `processTick`).

## Ablauf & Integration (game.js)

- **Einstieg:** eigener Button `#careerBtn` auf dem Start-Screen → `openCareer()` (Hub). Erster
  Start legt die Karriere an (`freshCareer`); danach wird sie fortgesetzt.
- **Hub** (`#careerScreen`): großer Kontostand, Rang, Vermögen/Bestwert, Shop (`renderCareer`/
  `buyCareerItem`), Vitrine. `#careerTradeBtn` → `enterCareerMarket()`; `#careerBackBtn` → Start-Screen.
- **Markt:** `mode="career"` ist über `wallClock()` weltzeit-getrieben (kein Pause-Button, Popups
  blockieren nicht). Der Tick-Zweig in `tick()` bestimmt den Epochen-Offset aus der Weltuhr, baut bei
  Epochenwechsel den Markt neu auf (`careerSyncToNow`), zieht kleine Lücken glatt mit Events nach und
  übernimmt große Sprünge still. `START_CASH` = Vermögen beim Betreten (livePnl = Session-Gewinn).
  `saveCareerPortfolio()` persistiert Cash/Positionen laufend.
- **Verlassen:** `#endSandboxBtn` ist im Karriere-Modus mit „Zurück zur Karriere" belegt →
  `leaveCareerToHub()` (Portfolio sichern, Hub öffnen). **Kein `endRound`/Ergebnis-Screen** — die
  Karriere endet nie.
- **Isolation:** von `updateRecord`/`appendGameHistory`/`saveSnapshot` ausgenommen; kein Snapshot-Resume.

## Tests

`node career.test.js` (Endlos-Markt-Primitive) zusätzlich zu `worker.test.js` und `e2e.test.js`.
UI/Ablauf per Chromium-Smoke-Test verifiziert (Hub, Kauf, Markt betreten, Idle-Epochenwechsel).

## Bewusst offen (Folge-Iterationen)

Reiche „während du weg warst"-Zusammenfassung, Perks, Zeit-/Volatilitäts-Skalierung, Animationen,
Netto-Vermögen teilen, Dividenden als echtes Idle-Einkommen.
