# 🏁 Sim-Racing-Tools

Kleine Werkzeuge fürs Sim Racing – gebaut für F1 25/26 & Co.
Zwei Teile:

## 📓 Renn-Tagebuch (`renn-tagebuch/`)
Eine Web-App zum Festhalten deiner Rennen (Spiel, Strecke, Auto, Notiz) und
Eintippen der Rundenzeiten. Wertet automatisch aus:
- **Beste Runde & Durchschnitt**
- **Konstanz** – wie gleichmäßig du gefahren bist
- **Reifen-Abbau** – ob die Zeiten im Rennverlauf langsamer werden
- **Verlaufs-Diagramm** der Runden + aufklappbare Liste aller Rundenzeiten
- **Gesamt-Übersicht** (Anzahl Rennen, Runden, Strecken, absolute Bestzeit)
- **Filter & Sortierung** nach Spiel/Strecke, sortiert nach Datum oder Zeit
- **Rennen vergleichen** – zwei Rennen überlagern (Tabelle + Diagramm)
- **Bearbeiten** – Rennen nachträglich ändern
- **Mehrere Zeiten** auf einmal einfügen (aus einem Zeitenblatt kopieren)
- **Backup & Import** – alle Rennen als Datei sichern und wieder laden

Alles wird lokal im Browser gespeichert (localStorage). Einfach
`renn-tagebuch/index.html` im Browser öffnen – keine Installation nötig.

## 🏎️ F1 Live-Dashboard (`f1-live/`)
Zeigt **während des Fahrens** in F1 25/26 live im Browser an: Rundenzeit,
letzte/beste Runde, welche Reifen, **Abnutzung pro Reifen in %**,
Reifen-Temperaturen, Sprit & Reichweite – plus automatische Konstanz- und
Reifen-Abbau-Analyse.

Dazu ein **vorausschauender Renningenieur** mit Live-Ansagen (Text und
optional gesprochen): Live-Delta zur Bestrunde, Boxenstopp-Fenster,
Abbau-Kosten, Sprit-Sparziel und Stint-Zusammenfassung. Dazu eine
Runden-Historie und der Knopf **„Session sichern"**, der die gefahrenen
Runden als Datei exportiert, die das Renn-Tagebuch direkt importieren kann.

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
