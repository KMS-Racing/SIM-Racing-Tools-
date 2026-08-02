# F1 25 & F1 26 – Live-Dashboard 🏁

Funktioniert mit **F1 25 und F1 26** – das Programm erkennt automatisch,
welches Spiel gerade sendet, und zeigt es oben an ("F1 25" / "F1 26").

Zeigt dir **während des Fahrens** live im Browser an: aktuelle Rundenzeit,
letzte/beste Runde, welche Reifen du hast, die **Abnutzung pro Reifen in %**,
Reifen-Temperaturen, Sprit + Reichweite, **ERS-Akku & Modus, DRS, Gang,
Bremstemperaturen, Sprit-Gemisch, Wetter, Sektorzeiten, Streckenflaggen &
Strafen** – und wertet automatisch **Konstanz** und **Reifen-Abbau** aus.

Dazu ein **vorausschauender Renningenieur** mit Live-Ansagen (Text und
optional gesprochen): Live-Delta zur Bestrunde, vorhergesagtes
Boxenstopp-Fenster, Sprit bis zur Zielflagge, Pace-Trend, Abbau-Kosten,
Stint-Zusammenfassung, Regen-/Flaggen-/Strafen-Warnungen, heiße Bremsen –
und er beantwortet auf Zuruf Fragen zu **Reifen, Box, Sprit, Temperatur,
Bremsen, ERS, DRS, Wetter, Sektoren, Position, Pace, Strafe** oder gibt auf
„Strategie" den kompletten Plan. Alles **kostenlos & offline**.

Und – wenn du willst – **🧠 Chef PRO**: ein *echter KI-Renningenieur* (Claude),
mit dem du wie mit einer Person redest. Er sieht dabei deine Live-Telemetrie
und gibt dir echte Strategie. Optional, braucht deinen eigenen Schlüssel –
[siehe unten](#5-chef-pro--der-echte-ki-renningenieur-optional).

Läuft komplett lokal auf deinem PC. Es werden **keine Zusatz-Pakete** gebraucht,
nur Node.js.

---

## 1. Voraussetzung: Node.js
Falls noch nicht installiert: [nodejs.org](https://nodejs.org) → die „LTS"-Version
installieren. Kurz prüfen (im Terminal / in der Eingabeaufforderung):

```
node --version
```
Wenn eine Versionsnummer kommt (z.B. `v20.x`), passt alles.

---

## 2. Telemetrie in F1 25 / F1 26 einschalten
Im Spiel:

**Einstellungen → Telemetrie-Einstellungen** und dort:

| Einstellung            | Wert                                    |
|------------------------|-----------------------------------------|
| UDP-Telemetrie         | **AN**                                  |
| UDP-Broadcast-Modus    | AUS                                     |
| UDP-IP-Adresse         | **127.0.0.1**                           |
| UDP-Port               | **20777**                               |
| UDP-Senderate          | 20 oder 30 Hz                           |
| UDP-Format             | **passend zum Spiel** (F1 26 → 2026, F1 25 → 2025) |

> Das Programm versteht beide Formate automatisch. Stell das UDP-Format am
> besten auf dein Spiel-Jahr; falls eine Auswahl fehlt, nimm das nächsthöhere.

> `127.0.0.1` bedeutet „dieser PC" – das Spiel schickt die Daten an dein
> eigenes Gerät, wo dieses Programm läuft.

---

## 🎮 Erstmal ohne Spiel ausprobieren (Demo-Modus)
Willst du das Dashboard einfach mal in Aktion sehen, ohne F1 zu starten?

```
node server.js --demo
```
Dann **http://localhost:3000** öffnen – es läuft eine simulierte Fahrt mit
Rundenzeiten, Reifenverschleiß, Sprit und allen Renningenieur-Ansagen.
Ideal zum Angucken und um „🔊 Funk an" zu testen.

---

## 3. Starten (mit echtem Spiel)
Im Ordner `f1-live/` ein Terminal öffnen und:

```
node server.js
```

Du solltest sehen:
```
✅ Höre auf F1-Telemetrie an UDP-Port 20777
✅ Dashboard offen unter:  http://localhost:3000
```

Dann im Browser **http://localhost:3000** öffnen und ein Rennen / eine
Trainingssession in F1 25 starten. Die Werte füllen sich live. 🏎️

### Runden automatisch ins Renn-Tagebuch
Der Server liefert auch das Renn-Tagebuch aus – unter
**http://localhost:3000/tagebuch**. Weil beide Seiten dann über dieselbe
Adresse laufen, teilen sie sich den Browser-Speicher:

1. Im Dashboard **„🔄 Auto ins Tagebuch: an"** klicken.
2. Über **„Tagebuch öffnen ↗"** das Tagebuch öffnen.

Ab dann landet jede gefahrene Runde **automatisch** als Session-Rennen im
Tagebuch – es aktualisiert sich sogar live, ohne Datei-Export/Import. Die
Strecke kannst du im Tagebuch per „bearbeiten" nachtragen.

---

## 4. Wenn Werte komisch aussehen: Debug-Modus
Weil die genauen Daten-Positionen je F1-Ausgabe leicht anders sein können,
gibt es einen Kontroll-Modus:

```
node server.js --debug
```

Dann zeigt das Terminal alle 2 Sekunden, was ankommt – z.B.:
```
F1 25 (Format 2025) | Reifen Soft (Alter 3) | Abnutzung FL 12.4% FR 11.8% RL 9.2% RR 9.6% | Sprit 78.5kg (Standard) | ERS 64% (Mittel) | DRS zu | Gang 6 | Bremse max 430° | Wetter Klar | S1 28.301 S2 31.204 | letzte Runde 91.234s
```
Sehen die Zahlen plausibel aus (Reifen 0–100 %, Sprit ~0–110 kg, ERS 0–100 %,
Bremsen ~100–1000 °C, Runde/Sektoren als sinnvolle Zeit), passt alles. Falls
ein Wert bei **F1 26** unsinnig ist, sag Bescheid – dann justieren wir die
betroffene Position nur in der 2026-Tabelle (`f1parser.js`).

---

## 5. Chef PRO – der echte KI-Renningenieur (optional)
Der normale Renningenieur rechnet mit festen Regeln direkt auf deinem PC –
blitzschnell und ohne alles Weitere. **Chef PRO** geht einen Schritt weiter:
Deine Frage geht zusammen mit einem Schnappschuss deiner Live-Daten (Reifen,
Abnutzung, Temperaturen, Sprit, Runden, Position …) an **Claude** – die
Antwort wird dir vorgelesen. So redest du praktisch **live mit einem echten
KI-Ingenieur, der deine Telemetrie sieht**.

Was du brauchst:

1. Einen eigenen **Claude-API-Schlüssel** von
   [console.anthropic.com](https://console.anthropic.com) (kostet nach
   Verbrauch – meist nur Cent pro Frage).
2. Den Schlüssel **vor dem Start** setzen. Dein Schlüssel bleibt dabei immer
   auf deinem PC (der Server nutzt ihn, der Browser sieht ihn nie):

   **Windows (Eingabeaufforderung):**
   ```
   set ANTHROPIC_API_KEY=sk-ant-dein-schluessel
   node server.js
   ```
   **Mac / Linux:**
   ```
   ANTHROPIC_API_KEY=sk-ant-dein-schluessel node server.js
   ```

3. Im Dashboard **„🧠 Chef PRO"** anklicken. Dann fragst du ihn genauso wie
   den normalen Ingenieur – per Taste **T** ins Mikrofon, mit „Ohren an" +
   Name, oder du **tippst deine Frage** ins Feld „Chef fragen" (klappt in
   jedem Browser, auch ohne Mikrofon).

Gut zu wissen:
- Ohne Schlüssel bleibt der Knopf grau – der normale Ingenieur läuft ganz
  normal weiter. Chef PRO ist rein zusätzlich.
- Standard-Modell ist `claude-opus-5`. Willst du ein anderes (z.B. schneller),
  setz vor dem Start zusätzlich `CHEF_MODEL`, z.B.
  `set CHEF_MODEL=claude-sonnet-5`.
- Chef PRO braucht Internet und antwortet in ein paar Sekunden (er „denkt"
  kurz). Die schnellen Reflex-Ansagen macht weiterhin der lokale Ingenieur.

---

## Was ist was?
| Datei              | Aufgabe                                                        |
|--------------------|----------------------------------------------------------------|
| `server.js`        | Empfängt die Telemetrie (UDP) und liefert das Dashboard aus.   |
| `f1parser.js`      | Liest die Werte deines Autos aus den Daten-Paketen heraus.     |
| `public/index.html`| Das Dashboard, das du im Browser siehst.                       |

---

## Nur PC
Telemetrie senden können nur die **PC-Versionen** von F1 25 (und iRacing).
Auf Konsole gibt es das leider nicht.
