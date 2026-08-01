'use strict';

// =====================================================================
//  Brücken-Programm: F1 25  ->  Browser
// ---------------------------------------------------------------------
//  1. Hört per UDP auf die Telemetrie von F1 25 (Port 20777).
//  2. Liest die Werte deines Autos heraus (siehe f1parser.js).
//  3. Liefert das Live-Dashboard aus und schiebt die Daten ~10x pro
//     Sekunde per "Server-Sent Events" (SSE) in den Browser.
//
//  Start:            node server.js
//  Mit Debug-Infos:  node server.js --debug
//  Demo (ohne Spiel): node server.js --demo
// =====================================================================

const dgram = require('dgram');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { parse } = require('./f1parser');

const UDP_PORT = 20777;   // Muss zum Port in den F1-25-Einstellungen passen
const WEB_PORT = 3000;    // Hier öffnest du die App im Browser
const DEBUG    = process.argv.includes('--debug');
const DEMO     = process.argv.includes('--demo');   // simulierte Telemetrie ohne Spiel

const zustand = {};          // aktueller Live-Zustand deines Autos
let letzteRundenNr = null;   // um eine frisch beendete Runde zu erkennen
const fertigeRunden = [];    // abgeschlossene Rundenzeiten (ms) dieser Session

// Alle verbundenen Browser-Fenster (SSE-Verbindungen)
const clients = new Set();

// --------------------------------------------------------------
// UDP: Telemetrie vom Spiel empfangen
// --------------------------------------------------------------
const udp = dgram.createSocket('udp4');

// Erkennt eine frisch beendete Runde (Rundennummer springt hoch) und
// legt die Zeit in fertigeRunden ab. Wird von UDP und Demo genutzt.
function erkenneRunde() {
  if (typeof zustand.lapNum !== 'number') return;
  if (letzteRundenNr === null) {
    letzteRundenNr = zustand.lapNum;
  } else if (zustand.lapNum > letzteRundenNr) {
    if (zustand.lastLapMs > 0) {
      fertigeRunden.push(zustand.lastLapMs);
      if (DEBUG) console.log('🏁 Runde fertig:', (zustand.lastLapMs / 1000).toFixed(3), 's');
    }
    letzteRundenNr = zustand.lapNum;
  }
}

udp.on('message', (msg) => {
  try {
    parse(msg, zustand);
    erkenneRunde();
  } catch (e) {
    if (DEBUG) console.error('Parse-Fehler:', e.message);
  }
});

udp.on('listening', () => {
  console.log(`✅ Höre auf F1-Telemetrie an UDP-Port ${UDP_PORT}`);
});

udp.on('error', (e) => {
  console.error('UDP-Fehler:', e.message);
});

// Im Demo-Modus brauchen wir keinen UDP-Port (die Daten kommen simuliert)
if (!DEMO) udp.bind(UDP_PORT);

// --------------------------------------------------------------
// Daten ~10x pro Sekunde an alle Browser schicken (schont die Leitung)
// --------------------------------------------------------------
setInterval(() => {
  if (clients.size === 0) return;
  const daten = JSON.stringify({ ...zustand, fertigeRunden });
  for (const res of clients) {
    res.write(`data: ${daten}\n\n`);
  }
}, 100);

// Debug-Übersicht alle 2 Sekunden – zeigt, ob die Werte plausibel sind
if (DEBUG) {
  setInterval(() => {
    if (!zustand.packetFormat) {
      console.log('… noch keine Daten. Läuft F1 25 und ist die Telemetrie an?');
      return;
    }
    const r = zustand.reifenAbnutzung || {};
    console.log(
      `F1 ${zustand.gameYear ?? '?'} (Format ${zustand.packetFormat}) | Reifen ${zustand.reifen ? zustand.reifen.name : '?'} ` +
      `(Alter ${zustand.reifenAlter ?? '?'}) | Abnutzung FL ${fmt(r.FL)} FR ${fmt(r.FR)} RL ${fmt(r.RL)} RR ${fmt(r.RR)} | ` +
      `Sprit ${zustand.fuelInTank != null ? zustand.fuelInTank.toFixed(1) + 'kg' : '?'} | ` +
      `letzte Runde ${zustand.lastLapMs ? (zustand.lastLapMs / 1000).toFixed(3) + 's' : '?'}`
    );
  }, 2000);
}
function fmt(v) { return v == null ? '?' : v.toFixed(1) + '%'; }

// --------------------------------------------------------------
// DEMO-Modus: simulierte Telemetrie, damit man das Dashboard auch
// ohne laufendes Spiel live in Aktion sehen kann.
// --------------------------------------------------------------
if (DEMO) {
  const LAP_LEN   = 5000;   // Streckenlänge (Meter)
  const BASE_LAP  = 91000;  // Basis-Rundenzeit (ms)
  const TOTAL     = 20;     // Renndistanz
  const TICK      = 100;    // ms zwischen Updates
  const SPEED     = 6;      // Zeitraffer: 6x schneller als echt (fürs Zuschauen)

  let lapNum = 1, lapMs = 0, wear = 2, fuelLaps = 21;

  zustand.demo = true;
  zustand.packetFormat = 2025;
  zustand.gameYear = 25;
  zustand.totalLaps = TOTAL;
  zustand.reifen = { name: 'Soft', farbe: '#ff5f57' };
  zustand.trackTemp = 42;
  zustand.airTemp = 27;
  zustand.position = 4;

  // Ziel-Rundenzeit: leichter Abbau + etwas Rauschen (deterministisch)
  const zielFuer = (n) => BASE_LAP + (n - 1) * 260 + Math.round(Math.sin(n * 1.7) * 110);

  setInterval(() => {
    const ziel = zielFuer(lapNum);
    lapMs += TICK * SPEED;
    const anteil = Math.min(1, lapMs / ziel);

    zustand.currentLapMs      = lapMs;
    zustand.lapDistance       = LAP_LEN * anteil;
    zustand.lapNum            = lapNum;
    zustand.speed             = 200 + Math.round(Math.sin(anteil * Math.PI * 6) * 80);
    zustand.reifenAlter       = lapNum - 1;
    zustand.reifenAbnutzung   = { FL: +(wear * 1.10).toFixed(1), FR: +(wear * 1.04).toFixed(1), RL: +wear.toFixed(1), RR: +(wear * 1.02).toFixed(1) };
    zustand.reifenTemp        = { FL: 96 + Math.round(Math.sin(anteil * 9) * 8), FR: 97 + Math.round(Math.cos(anteil * 9) * 8), RL: 92 + Math.round(Math.sin(anteil * 7) * 6), RR: 93 + Math.round(Math.cos(anteil * 7) * 6) };
    zustand.fuelRemainingLaps = +fuelLaps.toFixed(1);
    zustand.fuelInTank        = +(fuelLaps * 2.3).toFixed(1);

    if (lapMs >= ziel) {
      zustand.lastLapMs = ziel;   // fertige Runde
      lapNum++;
      lapMs = 0;
      wear += 4.2;                // Reifenverschleiß pro Runde
      fuelLaps -= 1.05;           // Spritverbrauch pro Runde
      if (lapNum > TOTAL) {       // Rennen vorbei -> neu starten
        lapNum = 1; wear = 2; fuelLaps = 21; letzteRundenNr = null; fertigeRunden.length = 0;
      }
    }
    erkenneRunde();
  }, TICK);
}

// --------------------------------------------------------------
// HTTP: Dashboard ausliefern + Live-Stream (SSE)
// --------------------------------------------------------------
const server = http.createServer((req, res) => {
  if (req.url === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('\n');
    clients.add(res);
    // Sofort den aktuellen Stand schicken, damit die Seite nicht leer ist
    res.write(`data: ${JSON.stringify({ ...zustand, fertigeRunden })}\n\n`);
    req.on('close', () => clients.delete(res));
    return;
  }

  // Alles andere: das Dashboard (index.html) ausliefern
  const datei = path.join(__dirname, 'public', 'index.html');
  fs.readFile(datei, (err, inhalt) => {
    if (err) { res.writeHead(500); res.end('Dashboard nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(inhalt);
  });
});

server.listen(WEB_PORT, () => {
  console.log(`✅ Dashboard offen unter:  http://localhost:${WEB_PORT}`);
  if (DEMO)  console.log('🎮 DEMO-Modus an – simulierte Fahrt, kein Spiel nötig.');
  if (DEBUG) console.log('🔧 Debug-Modus an – zeigt empfangene Werte im Terminal.');
  console.log('   (Zum Beenden: Strg + C)');
});
