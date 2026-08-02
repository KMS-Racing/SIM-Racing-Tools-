'use strict';

// =====================================================================
//  F1 25 / F1 26 UDP-Telemetrie – Parser
// ---------------------------------------------------------------------
//  F1 verschickt laufend kleine Daten-Pakete ("Packets") per UDP.
//  Jedes Paket hat einen 29 Byte langen Kopf (Header) und danach die
//  eigentlichen Daten – meistens für ALLE 22 Autos hintereinander.
//
//  Wir lesen nur die Daten DEINES Autos. Welches das ist, steht im
//  Header (playerCarIndex). Damit springen wir an die richtige Stelle.
//
//  WICHTIG – mehrere Spiel-Jahre:
//  Jedes F1-Spiel schreibt im Header sein "packetFormat" (z.B. 2025 oder
//  2026). Die Byte-Positionen können sich zwischen den Jahren leicht
//  unterscheiden. Deshalb hat unten JEDES Jahr seine eigene Tabelle
//  (LAYOUTS). Für F1 26 nehmen wir bis auf Weiteres dieselbe Tabelle wie
//  F1 25 – sollte ein Wert unsinnig sein, wird NUR die 2026-Tabelle
//  angepasst (siehe Debug-Modus in server.js).
// =====================================================================

const HEADER_SIZE = 29;

// ---- Positions-Tabellen je Spiel-Jahr -------------------------------
// size            = Größe eines Auto-Blocks in diesem Paket (Bytes)
// die übrigen Zahlen sind Offsets INNERHALB eines Auto-Blocks
// (session-Offsets sind relativ zum Header-Ende).
const LAYOUT_25 = {
  lapData:   { size: 57, lastLapMs: 0, currentLapMs: 4,
               s1ms: 8, s1min: 10, s2ms: 11, s2min: 13,
               gapFrontMs: 14, gapFrontMin: 16, gapLeaderMs: 17, gapLeaderMin: 19,
               lapDistance: 20, position: 32, lapNum: 33,
               pitStatus: 34, invalid: 37, penalties: 38 },
  telemetry: { size: 60, speed: 0, gear: 15, rpm: 16, drs: 18,
               brakesTempStart: 22, surfaceTempStart: 30 },
  status:    { size: 55, fuelMix: 2, fuelInTank: 5, fuelRemainingLaps: 13,
               drsAllowed: 22, visualCompound: 26, tyresAge: 27,
               fiaFlags: 28, ersStore: 37, ersMode: 41 },
  damage:    { size: 42, tyresWearStart: 0, brakesDmgStart: 20,
               flWing: 24, frWing: 25, rearWing: 26, floor: 27, diffuser: 28,
               sidepod: 29, gearbox: 32, engine: 33 },
  session:   { weather: 0, trackTemp: 1, airTemp: 2, totalLaps: 3,
               numMarshalZones: 18, marshalZonesStart: 19, forecastCountRel: 126, forecastStart: 127 },
};

// F1 26: vorerst identisch zu F1 25 (Basis-Annahme, bei Bedarf hier anpassen)
const LAYOUT_26 = JSON.parse(JSON.stringify(LAYOUT_25));

const LAYOUTS = {
  2024: LAYOUT_25,   // F1 24 nutzt (fast) dasselbe Layout
  2025: LAYOUT_25,
  2026: LAYOUT_26,
};

// Wählt die passende Tabelle; unbekannte Formate -> F1-25-Basis
function layoutFuer(packetFormat) {
  return LAYOUTS[packetFormat] || LAYOUT_25;
}

// Reifen-Mischung (visualTyreCompound) -> lesbarer Name + Farbe
const REIFEN = {
  16: { name: 'Soft',   farbe: '#ff5f57' },
  17: { name: 'Medium', farbe: '#e3b341' },
  18: { name: 'Hard',   farbe: '#e0e0e0' },
  7:  { name: 'Inter',  farbe: '#3fb950' },
  8:  { name: 'Wet',    farbe: '#4a9eff' },
};

// weitere Klartext-Tabellen für die neuen Werte
const WETTER  = ['Klar', 'Leicht bewölkt', 'Bedeckt', 'Leichter Regen', 'Starker Regen', 'Gewitter'];
const GEMISCH = ['Mager', 'Standard', 'Fett', 'Maximal'];
const ERS_MODE = ['Aus', 'Mittel', 'Hotlap', 'Überholen'];
const FIA_FLAGGE = { 1: 'grün', 2: 'blau', 3: 'gelb', 4: 'rot' };  // -1/0 = keine
const ERS_MAX = 4000000;   // ERS-Speicher max. 4 MJ (F1)

// Sektorzeit aus "Minuten-Teil" + "Millisekunden-Teil" zusammensetzen
function sektorMs(buf, o, msOff, minOff) {
  const ms  = buf.readUInt16LE(o + msOff);
  const min = buf.readUInt8(o + minOff);
  const wert = min * 60000 + ms;
  return wert > 0 ? wert : null;
}

// Zeit-Abstand (zu Vordermann / Führendem) aus ms- + Minuten-Teil (Sekunden)
function abstandSek(buf, o, msOff, minOff) {
  const ms  = buf.readUInt16LE(o + msOff);
  const min = buf.readUInt8(o + minOff);
  return (min * 60000 + ms) / 1000;
}

// Liest den Kopf (Header) eines jeden Pakets
function parseHeader(buf) {
  return {
    packetFormat:   buf.readUInt16LE(0),  // z.B. 2025 oder 2026
    gameYear:       buf.readUInt8(2),      // letzte zwei Ziffern, z.B. 25 oder 26
    packetId:       buf.readUInt8(6),      // welche Art Paket
    playerCarIndex: buf.readUInt8(27),     // welches Auto ist deins
  };
}

// F1 speichert 4er-Reifenwerte in der Reihenfolge: RL, RR, FL, FR.
// Wir machen daraus ein handliches Objekt {FL, FR, RL, RR}.
function vierRaeder(werte) {
  return { RL: werte[0], RR: werte[1], FL: werte[2], FR: werte[3] };
}

// Hauptfunktion: nimmt ein Paket (buf) und schreibt die Werte deines
// Autos in das übergebene "zustand"-Objekt.
function parse(buf, zustand) {
  if (buf.length < HEADER_SIZE) return zustand;

  const h = parseHeader(buf);
  const L = layoutFuer(h.packetFormat);
  const idx = h.playerCarIndex;
  zustand.packetFormat = h.packetFormat;
  zustand.gameYear = h.gameYear;

  // Startposition der Daten deines Autos im jeweiligen Paket
  const start = (stride) => HEADER_SIZE + idx * stride;

  switch (h.packetId) {

    case 2: { // ---- Lap Data: Rundenzeiten, Position, Sektoren, Strafen ----
      const f = L.lapData;
      const o = start(f.size);
      if (buf.length < o + f.size) break;
      zustand.lastLapMs    = buf.readUInt32LE(o + f.lastLapMs);
      zustand.currentLapMs = buf.readUInt32LE(o + f.currentLapMs);
      zustand.lapDistance  = buf.readFloatLE(o + f.lapDistance); // Meter seit Start/Ziel
      zustand.position     = buf.readUInt8(o + f.position);
      zustand.lapNum       = buf.readUInt8(o + f.lapNum);
      zustand.sektor1Ms    = sektorMs(buf, o, f.s1ms, f.s1min);  // letzte S1-Zeit (ms)
      zustand.sektor2Ms    = sektorMs(buf, o, f.s2ms, f.s2min);  // letzte S2-Zeit (ms)
      zustand.pitStatus    = buf.readUInt8(o + f.pitStatus);     // 0 Strecke, 1 Boxeneinfahrt, 2 in Box
      zustand.rundeUngueltig = buf.readUInt8(o + f.invalid) === 1;
      zustand.strafenSek   = buf.readUInt8(o + f.penalties);     // Sekunden Zeitstrafe
      zustand.gapVorne     = abstandSek(buf, o, f.gapFrontMs, f.gapFrontMin);  // Sek. zum Vordermann
      zustand.gapFuehrend  = abstandSek(buf, o, f.gapLeaderMs, f.gapLeaderMin); // Sek. zum Führenden
      break;
    }

    case 6: { // ---- Car Telemetry: Tempo, Gang, DRS, Reifen- & Bremstemp. ----
      const f = L.telemetry;
      const o = start(f.size);
      if (buf.length < o + f.size) break;
      zustand.speed = buf.readUInt16LE(o + f.speed); // km/h
      zustand.gang  = buf.readInt8(o + f.gear);      // -1 R, 0 N, 1..8
      zustand.rpm   = buf.readUInt16LE(o + f.rpm);   // Motordrehzahl
      zustand.drsOffen = buf.readUInt8(o + f.drs) === 1;
      const oberflaeche = [0, 1, 2, 3].map(i => buf.readUInt8(o + f.surfaceTempStart + i));
      zustand.reifenTemp = vierRaeder(oberflaeche); // °C an der Reifenoberfläche
      const bremsen = [0, 1, 2, 3].map(i => buf.readUInt16LE(o + f.brakesTempStart + i * 2));
      zustand.bremsTemp = vierRaeder(bremsen);      // °C an den Bremsen
      break;
    }

    case 7: { // ---- Car Status: Reifen, Sprit, ERS, DRS-Freigabe, Flagge ----
      const f = L.status;
      const o = start(f.size);
      if (buf.length < o + f.size) break;
      zustand.fuelMix           = GEMISCH[buf.readUInt8(o + f.fuelMix)] || null; // Sprit-Gemisch
      zustand.fuelInTank        = buf.readFloatLE(o + f.fuelInTank);        // kg Sprit im Tank
      zustand.fuelRemainingLaps = buf.readFloatLE(o + f.fuelRemainingLaps); // Reichweite in Runden
      zustand.drsErlaubt        = buf.readUInt8(o + f.drsAllowed) === 1;    // DRS aktivierbar?
      const visual = buf.readUInt8(o + f.visualCompound);                   // Reifen-Mischung
      zustand.reifen      = REIFEN[visual] || { name: '—', farbe: '#888' };
      zustand.reifenAlter = buf.readUInt8(o + f.tyresAge);                  // Runden auf dem Reifen
      const flagge = buf.readInt8(o + f.fiaFlags);
      zustand.fiaFlagge   = FIA_FLAGGE[flagge] || null;                     // Streckenflagge
      const ers = buf.readFloatLE(o + f.ersStore);                          // Joule im ERS-Speicher
      zustand.ersProzent  = Math.max(0, Math.min(100, Math.round(ers / ERS_MAX * 100)));
      zustand.ersModus    = ERS_MODE[buf.readUInt8(o + f.ersMode)] || null; // Einsatz-Modus
      break;
    }

    case 10: { // ---- Car Damage: Reifen-Abnutzung + Schaden am Auto ----
      const f = L.damage;
      const o = start(f.size);
      if (buf.length < o + f.size) break;
      const wear = [0, 1, 2, 3].map(i => buf.readFloatLE(o + f.tyresWearStart + i * 4)); // % pro Reifen
      zustand.reifenAbnutzung = vierRaeder(wear);
      const bremsSchaden = [0, 1, 2, 3].map(i => buf.readUInt8(o + f.brakesDmgStart + i)); // % pro Bremse
      zustand.bremsSchaden = vierRaeder(bremsSchaden);
      zustand.schaden = {        // Schaden in % (0 = heil)
        flWing:   buf.readUInt8(o + f.flWing),
        frWing:   buf.readUInt8(o + f.frWing),
        heckWing: buf.readUInt8(o + f.rearWing),
        boden:    buf.readUInt8(o + f.floor),
        diffusor: buf.readUInt8(o + f.diffuser),
        sidepod:  buf.readUInt8(o + f.sidepod),
        getriebe: buf.readUInt8(o + f.gearbox),
        motor:    buf.readUInt8(o + f.engine),
      };
      break;
    }

    case 1: { // ---- Session: Wetter, Strecken- & Lufttemperatur ----
      const f = L.session;
      if (buf.length < HEADER_SIZE + 4) break;
      zustand.wetter    = WETTER[buf.readUInt8(HEADER_SIZE + f.weather)] || null; // aktuelles Wetter
      zustand.trackTemp = buf.readInt8(HEADER_SIZE + f.trackTemp); // °C Asphalt
      zustand.airTemp   = buf.readInt8(HEADER_SIZE + f.airTemp);   // °C Luft
      zustand.totalLaps = buf.readUInt8(HEADER_SIZE + f.totalLaps);

      // Wetter-Vorhersage: kommende Zeitfenster mit Regenwahrscheinlichkeit.
      // Vorsichtig gelesen und geprüft – bei unplausiblen Werten ignoriert.
      const cOff = HEADER_SIZE + f.forecastCountRel;
      if (buf.length > cOff) {
        const n = buf.readUInt8(cOff);
        if (n > 0 && n <= 64) {
          const liste = [];
          for (let i = 0; i < Math.min(n, 16); i++) {
            const so = HEADER_SIZE + f.forecastStart + i * 8;
            if (buf.length < so + 8) break;
            const minuten = buf.readUInt8(so + 1);   // Minuten voraus
            const wetterIdx = buf.readUInt8(so + 2);
            const regen = buf.readUInt8(so + 7);     // Regen-Wahrscheinlichkeit %
            if (wetterIdx <= 5 && regen <= 100 && minuten <= 120) {
              liste.push({ minuten, wetter: WETTER[wetterIdx] || null, regen });
            }
          }
          if (liste.length) zustand.wetterVorhersage = liste;
        }
      }
      break;
    }
  }

  return zustand;
}

module.exports = { parse, HEADER_SIZE, LAYOUTS };
