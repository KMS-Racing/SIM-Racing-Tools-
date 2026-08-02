# 🏁 Sim-Racing-Tools

Kleine Werkzeuge fürs Sim Racing – gebaut für F1 25/26 & Co.
Zwei Teile:

## 📓 Renn-Tagebuch (`renn-tagebuch/`)
Eine Web-App zum Festhalten deiner Rennen (Spiel, Strecke, Auto, Notiz) und
Eintippen der Rundenzeiten. Wertet automatisch aus:
- **Beste, Durchschnitt & Median** (Median ist robust gegen Ausreißer)
- **Konstanz** – wie gleichmäßig du gefahren bist
- **Reifen-Abbau** – ob die Zeiten im Rennverlauf langsamer werden
- **Verlaufs-Diagramm** der Runden + aufklappbare Liste aller Rundenzeiten
- **Gesamt-Übersicht** + **Bestzeiten pro Strecke**
- **Filter, Suche & Sortierung** (Spiel/Strecke/Freitext; Datum oder Zeit)
- **Rennen vergleichen** – zwei Rennen überlagern (Tabelle + Diagramm)
- **Bearbeiten & duplizieren**
- **Mehrere Zeiten einfügen** – ganzen Block/Ergebnis-Tabelle einfügen, wird
  automatisch erkannt (kein Abtippen)
- **Backup (JSON), CSV-Export & Import**

Alles wird lokal im Browser gespeichert (localStorage). Einfach
`renn-tagebuch/index.html` im Browser öffnen – keine Installation nötig.

## 🏎️ F1 Live-Dashboard (`f1-live/`)
Zeigt **während des Fahrens** in F1 25/26 live im Browser an: Rundenzeit,
letzte/beste Runde, welche Reifen, **Abnutzung pro Reifen in %**,
Reifen-Temperaturen, Sprit & Reichweite, **ERS-Akku & Modus, DRS, Gang,
Bremstemperaturen, Sprit-Gemisch, Wetter, Sektorzeiten, Flaggen, Strafen,
Schaden am Auto, Abstände und Regen-Vorhersage** – plus automatische
Konstanz- und Reifen-Abbau-Analyse.

Dazu ein **vorausschauender Renningenieur** mit Live-Ansagen (Text und
optional gesprochen): Live-Delta zur Bestrunde, vorhergesagtes
Boxenstopp-Fenster, Sprit bis zur Zielflagge, Pace-Trend, Abbau-Kosten,
Stint-Zusammenfassung, Regen-/Flaggen-/Strafen-Warnungen und Vergleich mit
einer **Zielzeit**. Auf Zuruf (Sprache oder Tippen) beantwortet er Fragen zu
Reifen, Box, Sprit, Temperatur, Bremsen, ERS, DRS, Wetter, Sektoren, Position,
Pace und Strafen – oder gibt auf „Strategie" den kompletten Plan. Läuft
**kostenlos & offline**. Die Warn-Schwellen (Reifen heiß/kritisch) sind
einstellbar. Reifen-Temperaturen sind nach Fenster farbig (kalt/optimal/heiß).

Optional gibt es **🧠 Chef PRO** – einen *echten KI-Renningenieur* (Claude):
du redest mit ihm wie mit einer Person (tippen oder per Sprache), und er sieht
dabei deine Live-Telemetrie und gibt echte Strategie. Braucht deinen eigenen
Claude-API-Schlüssel; der bleibt lokal auf deinem PC. Anleitung in
[`f1-live/README.md`](f1-live/README.md).

Runden landen per **„🔄 Auto ins Tagebuch"** automatisch im Renn-Tagebuch
(unter `http://localhost:3000/tagebuch`), oder per **„Session sichern"** als
Datei. **„Neue Session"** startet ein frisches Rennen.

Läuft lokal über ein kleines Node.js-Programm (ohne Zusatzpakete).
Anleitung siehe [`f1-live/README.md`](f1-live/README.md).

Kurzstart:
```
cd f1-live
node server.js          # mit echtem Spiel (Telemetrie aktivieren)
node server.js --demo   # ohne Spiel: simulierte Fahrt zum Angucken
```
Dann im Browser **http://localhost:3000** öffnen.

---

*Anfänger-freundlich und komplett auf Deutsch kommentiert.*
