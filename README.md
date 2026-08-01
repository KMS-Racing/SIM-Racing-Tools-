# 🏁 Sim-Racing-Tools

Kleine Werkzeuge fürs Sim Racing – gebaut für F1 25/26 & Co.
Zwei Teile:

## 📓 Renn-Tagebuch (`renn-tagebuch/`)
Eine Web-App zum Festhalten deiner Rennen (Spiel, Strecke, Auto, Notiz) und
Eintippen der Rundenzeiten. Wertet automatisch aus:
- **Beste Runde & Durchschnitt**
- **Konstanz** – wie gleichmäßig du gefahren bist
- **Reifen-Abbau** – ob die Zeiten im Rennverlauf langsamer werden
- kleines **Verlaufs-Diagramm** der Runden
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
Abbau-Kosten, Sprit-Sparziel und Stint-Zusammenfassung.

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
