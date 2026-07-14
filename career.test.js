/* Test der Karriere-Endlos-Markt-Primitive (engine.js): Determinismus, nahtlose
   Epochen-Kontinuitaet (inkl. abgeleitetem Index) und Carry-Cache-Aequivalenz.
   Braucht nur Node >= 22, keine Abhaengigkeiten. Ausfuehren:  node career.test.js
   data.js/engine.js sind klassische Skripte, die per globalThis publizieren – der
   Loader importiert beide als Seiteneffekt (wie worker.test.js), danach sind
   genMarket/careerMarket/... als globale Bezeichner verfuegbar. */
const fs = require("fs"), os = require("os"), path = require("path"), {pathToFileURL} = require("url");

(async () => {
  const tdir = fs.mkdtempSync(path.join(os.tmpdir(), "spcx-career-"));
  for(const f of ["data.js", "engine.js"]) fs.copyFileSync(path.join(__dirname, f), path.join(tdir, f));
  fs.writeFileSync(path.join(tdir, "loader.mjs"), 'import "./data.js"; import "./engine.js";');
  await import(pathToFileURL(path.join(tdir, "loader.mjs")).href);

  let passed = 0, failed = 0;
  const ok = (cond, name) => { console.log((cond ? "✔ " : "✘ ") + name); cond ? passed++ : failed++; };

  const SEED = 12345, EP = 60;
  const syms = Object.keys(STOCK_DEFS);

  // 1) Determinismus: gleicher Seed + Epoche -> bit-identische Pfade
  const c0 = careerCarry(SEED, 0, EP).carry;
  const a = careerMarket(SEED, 0, c0, EP), b = careerMarket(SEED, 0, c0, EP);
  ok(syms.every(s => a.paths[s].every((v, i) => v === b.paths[s][i])),
     "Determinismus: gleicher Seed+Epoche -> identische Pfade");

  // 2) Kontinuitaet: effektiver Start von Epoche e == effektives Ende von e-1
  let contStk = true, contIdx = true;
  for(let e = 1; e <= 4; e++){
    const prev = careerMarket(SEED, e - 1, careerCarry(SEED, e - 1, EP).carry, EP);
    const cur  = careerMarket(SEED, e,     careerCarry(SEED, e,     EP).carry, EP);
    for(const s of syms){
      const end = prev.paths[s][prev.paths[s].length - 1], start = cur.paths[s][0];
      if(Math.abs(start - end) > Math.abs(end) * 1e-9 + 1e-9) contStk = false;
    }
    for(const s of [ETF_SYM, ETF2_SYM]){
      const end = prev.paths[s][prev.paths[s].length - 1], start = cur.paths[s][0];
      if(Math.abs(start - end) > Math.abs(end) * 1e-6 + 1e-6) contIdx = false;
    }
  }
  ok(contStk, "Kontinuitaet: Aktienkurs startet Epoche e dort, wo e-1 endete");
  ok(contIdx, "Kontinuitaet: auch der abgeleitete Index (MKT/ACT) ist nahtlos");

  // 3) Carry-Cache: Fortsetzung ab einem Zwischenstand == Rechnung von 0
  const full = careerCarry(SEED, 5, EP).carry;
  const cont5 = careerCarry(SEED, 5, EP, careerCarry(SEED, 3, EP)).carry;
  ok(syms.every(s => Math.abs(full[s] - cont5[s]) <= Math.abs(full[s]) * 1e-9),
     "Carry-Cache: Fortsetzung ab Epoche 3 == Rechnung von 0");

  // 4) epochSeed deterministisch und je Epoche verschieden
  ok(epochSeed(SEED, 0) === epochSeed(SEED, 0) && epochSeed(SEED, 0) !== epochSeed(SEED, 1),
     "epochSeed: deterministisch und je Epoche verschieden");

  // 5) Preise bleiben positiv (kein Vorzeichenwechsel durch Carry)
  ok(syms.every(s => a.paths[s].every(v => v > 0)),
     "Effektivkurse bleiben durchweg positiv");

  console.log(failed ? `\n${failed} FEHLER (${passed} ok)` : `\nALLE ${passed} TESTS OK`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("Test-Harness-Fehler:", e); process.exit(1); });
