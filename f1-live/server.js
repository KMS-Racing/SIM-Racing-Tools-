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
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { parse } = require('./f1parser');

const UDP_PORT = 20777;   // Muss zum Port in den F1-25-Einstellungen passen
const WEB_PORT = 3000;    // Hier öffnest du die App im Browser
const DEBUG    = process.argv.includes('--debug');
const DEMO     = process.argv.includes('--demo');   // simulierte Telemetrie ohne Spiel

// "Chef PRO": der echte KI-Renningenieur (Claude).
// Der Schlüssel bleibt HIER auf deinem PC (nie im Browser). Setze ihn vor dem
// Start:  Windows:  set ANTHROPIC_API_KEY=sk-ant-...   dann  node server.js
//         Mac/Linux: ANTHROPIC_API_KEY=sk-ant-... node server.js
const API_KEY    = process.env.ANTHROPIC_API_KEY || '';
const CHEF_MODEL = process.env.CHEF_MODEL || 'claude-opus-5';   // per CHEF_MODEL änderbar

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
    const b = zustand.bremsTemp || {};
    console.log(
      `F1 ${zustand.gameYear ?? '?'} (Format ${zustand.packetFormat}) | Reifen ${zustand.reifen ? zustand.reifen.name : '?'} ` +
      `(Alter ${zustand.reifenAlter ?? '?'}) | Abnutzung FL ${fmt(r.FL)} FR ${fmt(r.FR)} RL ${fmt(r.RL)} RR ${fmt(r.RR)} | ` +
      `Sprit ${zustand.fuelInTank != null ? zustand.fuelInTank.toFixed(1) + 'kg' : '?'} (${zustand.fuelMix ?? '?'}) | ` +
      `ERS ${zustand.ersProzent != null ? zustand.ersProzent + '%' : '?'} (${zustand.ersModus ?? '?'}) | ` +
      `DRS ${zustand.drsErlaubt ? 'frei' : 'zu'}${zustand.drsOffen ? '/offen' : ''} | ` +
      `Gang ${zustand.gang ?? '?'} | Bremse max ${b.FL != null ? Math.max(b.FL, b.FR, b.RL, b.RR) + '°' : '?'} | ` +
      `Wetter ${zustand.wetter ?? '?'}${zustand.fiaFlagge ? ' | Flagge ' + zustand.fiaFlagge : ''}${zustand.strafenSek ? ' | +' + zustand.strafenSek + 's' : ''} | ` +
      `S1 ${zustand.sektor1Ms ? (zustand.sektor1Ms / 1000).toFixed(3) : '?'} S2 ${zustand.sektor2Ms ? (zustand.sektor2Ms / 1000).toFixed(3) : '?'} | ` +
      `Schaden ${schadenText(zustand.schaden)} | Gap vorne ${zustand.gapVorne != null ? zustand.gapVorne.toFixed(1) + 's' : '?'} | ` +
      `Vorhersage ${zustand.wetterVorhersage ? zustand.wetterVorhersage.map(s => s.minuten + 'min ' + s.regen + '%').slice(0, 3).join(', ') : '?'} | ` +
      `letzte Runde ${zustand.lastLapMs ? (zustand.lastLapMs / 1000).toFixed(3) + 's' : '?'}`
    );
  }, 2000);
}
function fmt(v) { return v == null ? '?' : v.toFixed(1) + '%'; }
function schadenText(s) {
  if (!s) return '?';
  let key = null, w = -1;
  Object.keys(s).forEach(k => { if (s[k] > w) { w = s[k]; key = k; } });
  return w > 0 ? key + ' ' + w + '%' : 'heil';
}

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
  zustand.fuelMix = 'Standard';
  const WETTER_DEMO = ['Klar', 'Leicht bewölkt', 'Bedeckt', 'Leichter Regen'];

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
    // neue Werte simulieren
    zustand.gang       = Math.max(1, Math.min(8, Math.round(2 + zustand.speed / 45)));
    zustand.rpm        = 9000 + Math.round(Math.sin(anteil * Math.PI * 6) * 2500);
    zustand.ersProzent = Math.round(50 + Math.sin(lapMs / 4000) * 45);
    zustand.ersModus   = zustand.ersProzent > 70 ? 'Überholen' : 'Mittel';
    zustand.drsErlaubt = anteil > 0.4 && anteil < 0.6;
    zustand.drsOffen   = zustand.drsErlaubt && zustand.speed > 250;
    zustand.bremsTemp  = { FL: 380 + Math.round(Math.sin(anteil * 11) * 220), FR: 390 + Math.round(Math.cos(anteil * 11) * 220), RL: 320 + Math.round(Math.sin(anteil * 9) * 180), RR: 330 + Math.round(Math.cos(anteil * 9) * 180) };
    zustand.wetter     = WETTER_DEMO[Math.min(WETTER_DEMO.length - 1, Math.floor(lapNum / 6))];
    zustand.sektor1Ms  = 28000 + Math.round(Math.sin(lapNum) * 300);
    zustand.sektor2Ms  = 31000 + Math.round(Math.cos(lapNum) * 300);
    zustand.fiaFlagge  = (lapNum === 7) ? 'gelb' : null;
    zustand.strafenSek = (lapNum >= 10) ? 5 : 0;
    zustand.gapVorne    = +(1.2 + Math.sin(lapNum) * 0.8).toFixed(1);
    zustand.gapFuehrend = +(3 + lapNum * 0.4).toFixed(1);
    zustand.schaden = { flWing: Math.min(60, lapNum * 2), frWing: 0, heckWing: 0, boden: Math.min(20, lapNum), diffusor: 0, sidepod: 0, getriebe: 0, motor: Math.min(15, Math.floor(lapNum / 2)) };
    // Regen-Vorhersage: ab Rennmitte zieht Regen auf
    zustand.wetterVorhersage = [
      { minuten: 0,  wetter: 'Klar',           regen: 5 },
      { minuten: 5,  wetter: 'Leicht bewölkt', regen: lapNum > 8 ? 45 : 15 },
      { minuten: 15, wetter: 'Leichter Regen', regen: lapNum > 8 ? 70 : 25 },
    ];

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
// CHEF PRO – der echte KI-Renningenieur (Claude-API)
// ---------------------------------------------------------------------
//  Baut einen kompakten Schnappschuss deiner Telemetrie, schickt ihn mit
//  deiner Frage an die Claude-API und gibt die Antwort zurück. So redest du
//  praktisch live mit einem echten KI-Ingenieur, der deine Daten sieht.
//  Ohne Zusatzpakete – nur das eingebaute "https" von Node.
// --------------------------------------------------------------
function schnappschuss() {
  const r = zustand.reifenAbnutzung || {};
  const t = zustand.reifenTemp || {};
  const beste = fertigeRunden.length ? Math.min(...fertigeRunden) : null;
  const s = (ms) => (ms == null ? null : +(ms / 1000).toFixed(3));
  return {
    spiel: zustand.gameYear ? 'F1 ' + zustand.gameYear : null,
    reifen: zustand.reifen ? zustand.reifen.name : null,
    reifenAlterRunden: zustand.reifenAlter ?? null,
    abnutzungProzent: (r.FL != null) ? { FL: r.FL, FR: r.FR, RL: r.RL, RR: r.RR } : null,
    reifenTempC: (t.FL != null) ? { FL: t.FL, FR: t.FR, RL: t.RL, RR: t.RR } : null,
    spritKg: zustand.fuelInTank ?? null,
    spritReichweiteRunden: zustand.fuelRemainingLaps ?? null,
    aktuelleRunde: zustand.lapNum ?? null,
    rennrunden: zustand.totalLaps ?? null,
    position: zustand.position ?? null,
    letzteRundeS: s(zustand.lastLapMs),
    besteRundeS: s(beste),
    letzteRundenS: fertigeRunden.slice(-8).map(s),
    sektor1S: s(zustand.sektor1Ms),
    sektor2S: s(zustand.sektor2Ms),
    ersAkkuProzent: zustand.ersProzent ?? null,
    ersModus: zustand.ersModus ?? null,
    drsErlaubt: zustand.drsErlaubt ?? null,
    bremsenC: zustand.bremsTemp || null,
    spritGemisch: zustand.fuelMix ?? null,
    wetter: zustand.wetter ?? null,
    wetterVorhersage: zustand.wetterVorhersage || null,
    streckenflagge: zustand.fiaFlagge ?? null,
    zeitstrafeSek: zustand.strafenSek ?? null,
    schadenProzent: zustand.schaden || null,
    abstandVorneS: zustand.gapVorne ?? null,
    abstandFuehrendS: zustand.gapFuehrend ?? null,
    asphaltC: zustand.trackTemp ?? null,
    luftC: zustand.airTemp ?? null,
  };
}

const CHEF_SYSTEM =
  'Du bist mein Renningenieur am Boxenfunk in einem F1-Rennen (Sim Racing, F1 25/26). ' +
  'Du sprichst Deutsch, ruhig, knapp und konkret wie echter Boxenfunk, hoechstens ein bis zwei Saetze. ' +
  'Du bekommst als JSON die aktuelle Telemetrie meines Autos. Nutze sie fuer echte Strategie: ' +
  'Reifenverschleiss und Boxenstopp-Fenster, Sprit sparen oder pushen, Reifentemperaturen und Fenster, ' +
  'Konstanz und Pace im Vergleich zur Bestrunde. Erfinde keine Zahlen, die nicht im JSON stehen; ' +
  'fehlt etwas, sag es kurz. Keine Listen, keine Sonderzeichen, kein Markdown, nur gesprochener Text, ' +
  'weil deine Antwort direkt vorgelesen wird. Duze mich.';

// Fragt Claude und liefert die Antwort als Text (Promise).
function frageClaude(frage) {
  return new Promise((resolve, reject) => {
    if (!API_KEY) { reject(new Error('kein API-Schluessel gesetzt')); return; }
    const koerper = JSON.stringify({
      model: CHEF_MODEL,
      max_tokens: 300,
      system: CHEF_SYSTEM,
      messages: [{
        role: 'user',
        content: 'Aktuelle Telemetrie (JSON):\n' + JSON.stringify(schnappschuss()) +
                 '\n\nMeine Frage: ' + frage,
      }],
    });
    const anfrage = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-length': Buffer.byteLength(koerper),
      },
    }, (resp) => {
      let body = '';
      resp.on('data', (c) => body += c);
      resp.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (j.error) { reject(new Error(j.error.message || 'API-Fehler')); return; }
          const text = (j.content || [])
            .filter(c => c.type === 'text').map(c => c.text).join(' ').trim();
          resolve(text || 'Ich habe gerade keine Antwort.');
        } catch (e) { reject(new Error('Antwort nicht lesbar')); }
      });
    });
    anfrage.on('error', reject);
    anfrage.write(koerper);
    anfrage.end();
  });
}

// --------------------------------------------------------------
// HTTP: Dashboard ausliefern + Live-Stream (SSE)
// --------------------------------------------------------------
const server = http.createServer((req, res) => {
  // Chef PRO: ist ein Schlüssel gesetzt? (Dashboard fragt beim Start)
  if (req.url === '/chef-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ bereit: !!API_KEY, modell: CHEF_MODEL }));
    return;
  }

  // Chef PRO: Frage an den echten KI-Renningenieur (Claude)
  if (req.url === '/chef' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 100000) req.destroy(); });
    req.on('end', () => {
      let frage = '';
      try { frage = String((JSON.parse(body || '{}').frage) || '').slice(0, 500); } catch (e) {}
      if (!frage.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ fehler: 'keine Frage' }));
        return;
      }
      frageClaude(frage).then((antwort) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ antwort }));
      }).catch((e) => {
        if (DEBUG) console.error('Chef-Fehler:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ fehler: e.message }));
      });
    });
    return;
  }

  // Neue Session: gesammelte Runden verwerfen
  if (req.url === '/reset') {
    fertigeRunden.length = 0;
    letzteRundenNr = null;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

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

  // Renn-Tagebuch mit ausliefern – so teilen sich Dashboard und Tagebuch
  // denselben Browser-Speicher (localhost:3000), und die Runden landen
  // automatisch im Tagebuch.
  const url = req.url.split('?')[0];
  const datei = (url === '/tagebuch' || url === '/tagebuch/')
    ? path.join(__dirname, '..', 'renn-tagebuch', 'index.html')
    : path.join(__dirname, 'public', 'index.html');

  fs.readFile(datei, (err, inhalt) => {
    if (err) { res.writeHead(500); res.end('Seite nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(inhalt);
  });
});

server.listen(WEB_PORT, () => {
  console.log(`✅ Dashboard offen unter:  http://localhost:${WEB_PORT}`);
  console.log(`✅ Renn-Tagebuch unter:    http://localhost:${WEB_PORT}/tagebuch`);
  if (DEMO)  console.log('🎮 DEMO-Modus an – simulierte Fahrt, kein Spiel nötig.');
  if (DEBUG) console.log('🔧 Debug-Modus an – zeigt empfangene Werte im Terminal.');
  if (API_KEY) console.log(`🧠 Chef PRO bereit (Modell ${CHEF_MODEL}) – echter KI-Renningenieur an.`);
  else console.log('💡 Chef PRO aus. Für den echten KI-Ingenieur: ANTHROPIC_API_KEY setzen und neu starten.');
  console.log('   (Zum Beenden: Strg + C)');
});
