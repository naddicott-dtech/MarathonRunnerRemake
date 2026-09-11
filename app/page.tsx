"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Pace = 0 | 1 | 2 | 3 | 4;
type Phase = "ready" | "running" | "collapsed" | "finished";
type VitalName = "glucose" | "oxygen" | "temperature" | "sodium";

type Game = {
  phase: Phase;
  time: number;
  distance: number;
  pace: Pace;
  glucose: number;
  oxygen: number;
  temperature: number;
  sodium: number;
  plasmaVolume: number;
  heartRate: number;
  breathingRate: number;
  insulin: number;
  glucagon: number;
  glycogen: number;
  gutWater: number;
  gutElectrolyte: number;
  bananaTime: number;
  sweatTime: number;
  shiverTime: number;
  cooldowns: Record<string, number>;
  lastAction: string;
  cause: string;
};

const FINISH_DISTANCE = 40_000;
const CLASSROOM_SPEED = 12;
const PACE_NAMES = ["Resting", "Jogging", "Running", "Collapsed", "Sprinting"] as const;
const SPEEDS = [0, 2, 5, 0, 9];
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const initialGame = (): Game => ({
  phase: "ready",
  time: 0,
  distance: 0,
  pace: 0,
  glucose: 90,
  oxygen: 98,
  temperature: 37,
  sodium: 140,
  plasmaVolume: 3,
  heartRate: 60,
  breathingRate: 12,
  insulin: 10,
  glucagon: 75,
  glycogen: 200,
  gutWater: 0,
  gutElectrolyte: 0,
  bananaTime: 0,
  sweatTime: 0,
  shiverTime: 0,
  cooldowns: {},
  lastAction: "Press Start Race to begin.",
  cause: "",
});

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const COOLDOWNS: Record<string, number> = {
  breatheUp: .5, breatheDown: .5, heartUp: .5, heartDown: .5,
  water: 3, electrolyte: 3, sweat: 5, shiver: 5,
  paceUp: 1, paceDown: 1, banana: 60, glucagon: 5, insulin: 5,
};

const ACTION_NAMES: Record<string, string> = {
  breatheUp: "Breathe faster", breatheDown: "Breathe slower",
  heartUp: "Increase heart rate", heartDown: "Decrease heart rate",
  water: "Drink water", electrolyte: "Drink electrolyte water",
  sweat: "Sweat", shiver: "Shiver", paceUp: "Run faster", paceDown: "Run slower",
  banana: "Eat banana", glucagon: "Glucagon", insulin: "Insulin",
};

function status(name: VitalName, value: number) {
  if (name === "glucose") return value < 54 || value >= 250 ? "danger" : value < 70 || value > 180 ? "warning" : "normal";
  if (name === "oxygen") return value <= 88 ? "danger" : value < 95 ? "warning" : "normal";
  if (name === "temperature") return value < 35 || value >= 40 ? "danger" : value < 36 || value >= 38.5 ? "warning" : "normal";
  return value < 125 || value > 155 ? "danger" : value < 135 || value > 145 ? "warning" : "normal";
}

function tick(previous: Game, dt: number): Game {
  if (previous.phase !== "running") return previous;
  const next: Game = { ...previous, cooldowns: { ...previous.cooldowns } };
  next.time += dt * 2; // retained from the original
  next.distance = Math.min(FINISH_DISTANCE, next.distance + SPEEDS[next.pace] * CLASSROOM_SPEED * dt);
  next.bananaTime = Math.max(0, next.bananaTime - dt);
  next.sweatTime = Math.max(0, next.sweatTime - dt);
  next.shiverTime = Math.max(0, next.shiverTime - dt);
  for (const key of Object.keys(next.cooldowns)) next.cooldowns[key] = Math.max(0, next.cooldowns[key] - dt);

  // Same exposed breathing/heart loop, with exercise targets that keep a healthy runner near 95–100% SpO2.
  const desiredHeart = [60, 105, 145, 60, 175][next.pace];
  const desiredBreathing = [12, 16, 20, 12, 24][next.pace];
  const heartShortfall = Math.max(0, desiredHeart - next.heartRate) / 100;
  const breathingShortfall = Math.max(0, desiredBreathing - next.breathingRate) / 18;
  const oxygenTarget = clamp(98 - heartShortfall * 10 - breathingShortfall * 12, 84, 99);
  next.oxygen += (oxygenTarget - next.oxygen) * .09 * dt;

  // Corrected glucose loop: basal hormones balance rather than both applying their full level every frame.
  const exerciseUse = [0.005, 0.025, 0.055, 0, 0.095][next.pace];
  const insulinEffect = Math.max(0, next.insulin - 10) * .008;
  const glucagonEffect = Math.max(0, next.glucagon - 50) * .0035;
  const bananaEffect = next.bananaTime > 0 ? 1.2 : 0;
  next.glucose += (-exerciseUse - insulinEffect + glucagonEffect + bananaEffect) * dt;
  next.glycogen = Math.max(0, next.glycogen - exerciseUse * .08 * dt);

  let insulinTarget = 10;
  let glucagonTarget = 50;
  if (next.glucose > 110) insulinTarget = clamp(10 + (next.glucose - 110) * .15, 2, 25);
  if (next.glucose < 75) glucagonTarget = clamp(50 + (75 - next.glucose) * .5, 50, 150);
  next.insulin += (insulinTarget - next.insulin) * .08 * dt;
  next.glucagon += (glucagonTarget - next.glucagon) * .08 * dt;

  // Original mass-balance idea retained; fixed normal range and compressed to match the shortened race.
  const absorptionRate = .693 / (600 / CLASSROOM_SPEED);
  const plainAbsorbed = next.gutWater * absorptionRate * dt;
  const electrolyteAbsorbed = next.gutElectrolyte * absorptionRate * dt;
  next.gutWater -= plainAbsorbed;
  next.gutElectrolyte -= electrolyteAbsorbed;
  let sodiumMass = next.sodium * next.plasmaVolume + electrolyteAbsorbed * 138;
  next.plasmaVolume += plainAbsorbed + electrolyteAbsorbed;
  const baseSweat = [0.05, 0.5, 1, 0, 1.2][next.pace];
  const sweatLph = baseSweat + (next.sweatTime > 0 ? .5 : 0);
  const sweatLoss = sweatLph / 3600 * CLASSROOM_SPEED * dt;
  sodiumMass -= sweatLoss * 55;
  next.plasmaVolume = Math.max(2.2, next.plasmaVolume - sweatLoss);
  next.sodium = sodiumMass / next.plasmaVolume;

  // Fixed the original double-delta heat calculation; rates are applied once per tick.
  const heatPerHour = [1, 2, 3, 0, 6][next.pace];
  const shiverHeat = next.shiverTime > 0 ? 5 : 0;
  const passiveLoss = Math.max(0, next.temperature - 36) * 1.1;
  // Corrected cooling: the old coefficient made the sweat action nearly invisible.
  const evaporativeLoss = sweatLph * 3.2;
  next.temperature += (heatPerHour + shiverHeat - passiveLoss - evaporativeLoss) / 3600 * CLASSROOM_SPEED * dt;

  next.glucose = clamp(next.glucose, 35, 300);
  next.oxygen = clamp(next.oxygen, 80, 100);
  next.temperature = clamp(next.temperature, 30, 45);
  next.sodium = clamp(next.sodium, 118, 165);

  if (next.glucose < 54) { next.phase = "collapsed"; next.cause = "Serious hypoglycemia (below 54 mg/dL)"; }
  else if (next.glucose >= 250) { next.phase = "collapsed"; next.cause = "Glucose reached 250 mg/dL — stop and check ketones"; }
  else if (next.oxygen <= 88) { next.phase = "collapsed"; next.cause = "Oxygen saturation reached 88%"; }
  else if (next.temperature < 35) { next.phase = "collapsed"; next.cause = "Core temperature fell below 35°C"; }
  else if (next.temperature >= 40) { next.phase = "collapsed"; next.cause = "Core temperature reached 40°C"; }
  else if (next.sodium < 125 || next.sodium > 155 || next.plasmaVolume <= 2.25) { next.phase = "collapsed"; next.cause = "Dangerous fluid/electrolyte imbalance"; }
  else if (next.distance >= FINISH_DISTANCE) next.phase = "finished";
  return next;
}

function ActionButton({ action, game, act, active = false, children }: { action: string; game: Game; act: (action: string) => void; active?: boolean; children: React.ReactNode }) {
  const remaining = game.cooldowns[action] || 0;
  return <button className={`control-button ${active ? "active-effect" : ""}`} disabled={game.phase !== "running" || remaining > 0} onClick={() => act(action)} aria-label={ACTION_NAMES[action]}><span>{children}</span>{remaining > 0 && <small>{active ? "COOLING" : `${Math.ceil(remaining)}s`}</small>}</button>;
}

function Vital({ name, label, value, unit, min, max, safeMin, safeMax }: { name: VitalName; label: string; value: number; unit: string; min: number; max: number; safeMin: number; safeMax: number }) {
  const currentStatus = status(name, value);
  const position = clamp((value - min) / (max - min) * 100, 0, 100);
  const safeLeft = (safeMin - min) / (max - min) * 100;
  const safeWidth = (safeMax - safeMin) / (max - min) * 100;
  return <article className={`vital ${currentStatus}`} aria-label={`${label}: ${value.toFixed(name === "temperature" ? 1 : 0)} ${unit}`}>
    <div className="vital-top"><div><span>{label}</span><small>{currentStatus}</small></div><strong>{value.toFixed(name === "temperature" ? 1 : 0)} <i>{unit}</i></strong></div>
    <div className="vital-bar"><span className="safe-range" style={{ left: `${safeLeft}%`, width: `${safeWidth}%` }} /><b style={{ left: `${position}%` }} /></div>
    <div className="bar-labels"><span>{min}</span><span>normal {safeMin}–{safeMax}</span><span>{max}</span></div>
  </article>;
}

export default function Home() {
  const [game, setGame] = useState<Game>(() => initialGame());
  const [showScience, setShowScience] = useState(false);
  const [runnerFrame, setRunnerFrame] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => setGame((current) => tick(current, .1)), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    for (const animation of ["idle", "walk", "run", "dead"]) {
      for (let frame = 1; frame <= 15; frame += 1) {
        const image = new Image();
        image.src = assetUrl(`runner/${animation}-${String(frame).padStart(2, "0")}.webp`);
      }
    }
  }, []);

  useEffect(() => {
    const interval = game.phase === "collapsed" ? 85 : game.pace === 0 ? 180 : game.pace === 1 ? 95 : game.pace === 2 ? 72 : 55;
    const timer = window.setInterval(() => setRunnerFrame((frame) => frame % 15 + 1), interval);
    return () => window.clearInterval(timer);
  }, [game.pace, game.phase]);

  const act = useCallback((action: string) => {
    setGame((current) => {
      if (current.phase !== "running" || (current.cooldowns[action] || 0) > 0) return current;
      const next: Game = { ...current, cooldowns: { ...current.cooldowns, [action]: COOLDOWNS[action] }, lastAction: ACTION_NAMES[action] };
      if (action === "breatheUp") next.breathingRate = Math.min(25, next.breathingRate + 2);
      if (action === "breatheDown") next.breathingRate = Math.max(6, next.breathingRate - 2);
      if (action === "heartUp") next.heartRate = Math.min(200, next.heartRate + 5);
      if (action === "heartDown") next.heartRate = Math.max(40, next.heartRate - 5);
      if (action === "water") next.gutWater += .2;
      if (action === "electrolyte") next.gutElectrolyte += .2;
      if (action === "sweat") next.sweatTime = 60 / CLASSROOM_SPEED;
      if (action === "shiver") next.shiverTime = 120 / CLASSROOM_SPEED;
      if (action === "banana") next.bananaTime = 25;
      if (action === "glucagon") next.glucagon = Math.min(150, next.glucagon + 5);
      if (action === "insulin") next.insulin = Math.min(25, next.insulin + 5);
      if (action === "paceUp") {
        if (next.pace === 0) next.pace = 1;
        else if (next.pace === 1) next.pace = 2;
        else if (next.pace === 2) next.pace = 4;
      }
      if (action === "paceDown") {
        if (next.pace === 4) next.pace = 2;
        else if (next.pace === 2) next.pace = 1;
        else if (next.pace === 1) next.pace = 0;
      }
      if (action === "sweat") next.lastAction = "Sweating active — evaporative cooling is reducing heat gain.";
      return next;
    });
  }, []);

  const alert = useMemo(() => {
    if (status("glucose", game.glucose) !== "normal") return "Blood glucose is outside the normal band.";
    if (status("oxygen", game.oxygen) !== "normal") return "Oxygen saturation is falling.";
    if (status("temperature", game.temperature) !== "normal") return "Core temperature is outside the normal band.";
    if (status("sodium", game.sodium) !== "normal") return "Plasma sodium is outside the normal band.";
    return game.lastAction;
  }, [game]);

  const runnerAnimation = game.phase === "collapsed" ? "dead" : game.pace === 0 ? "idle" : game.pace === 1 ? "walk" : "run";

  return <main className="app-shell">
    <header className="game-header">
      <div className="game-title"><span>H</span><div><strong>HOMEOSTASIS</strong><small>MARATHON</small></div></div>
      <div className="conditions"><span>Outdoor <b>36°C</b></span><span>Humidity <b>60%</b></span><span>Classroom speed <b>12×</b></span></div>
      <div className="header-actions"><button onClick={() => setShowScience(true)}>Science &amp; fixes</button><button onClick={() => setGame(initialGame())}>Restart</button></div>
    </header>

    <div className="game-grid">
      <aside className="controls-panel" aria-label="Runner controls">
        <div className="panel-heading"><span>CONTROLS</span><strong>Run the feedback loops</strong></div>
        <section className="pace-controls"><h2><span>START HERE</span> Pace</h2><div className="button-pair"><ActionButton action="paceUp" game={game} act={act}>Run faster <b>↑</b></ActionButton><ActionButton action="paceDown" game={game} act={act}>Run slower <b>↓</b></ActionButton></div></section>
        <section><h2>Breathing</h2><div className="button-pair"><ActionButton action="breatheUp" game={game} act={act}>Breathe faster <b>+</b></ActionButton><ActionButton action="breatheDown" game={game} act={act}>Breathe slower <b>−</b></ActionButton></div><p><span>{game.breathingRate}</span> breaths/min</p></section>
        <section><h2>Heart rate</h2><div className="button-pair"><ActionButton action="heartUp" game={game} act={act}>Increase <b>+</b></ActionButton><ActionButton action="heartDown" game={game} act={act}>Decrease <b>−</b></ActionButton></div><p><span>{game.heartRate}</span> beats/min</p></section>
        <section><h2>Fluid &amp; temperature</h2><div className="button-pair"><ActionButton action="water" game={game} act={act}>Drink water</ActionButton><ActionButton action="electrolyte" game={game} act={act}>Electrolyte water</ActionButton><ActionButton action="sweat" game={game} act={act} active={game.sweatTime > 0}>Sweat</ActionButton><ActionButton action="shiver" game={game} act={act}>Shiver</ActionButton></div></section>
        <section><h2>Blood glucose</h2><div className="button-pair three"><ActionButton action="banana" game={game} act={act}>Eat banana</ActionButton><ActionButton action="glucagon" game={game} act={act}>Glucagon ↑</ActionButton><ActionButton action="insulin" game={game} act={act}>Insulin ↓</ActionButton></div></section>
      </aside>

      <section className="race-panel" aria-label="Race view">
        <div className="race-stats"><div><span>TIME</span><strong>{game.time.toFixed(1)} s</strong></div><div><span>DISTANCE</span><strong>{game.distance.toFixed(0)} m</strong></div></div>
        <div className="progress"><div style={{ width: `${game.distance / FINISH_DISTANCE * 100}%` }} /><span>{(game.distance / 1000).toFixed(1)} km</span><b>40 km</b></div>
        <div className="scene">
          <div className="sun" />
          <div className="horizon" />
          <div className={`original-runner pace-${game.pace} ${game.phase}`} aria-label={`Runner is ${PACE_NAMES[game.pace].toLowerCase()}`}><img src={assetUrl(`runner/${runnerAnimation}-${String(runnerFrame).padStart(2, "0")}.webp`)} alt="" /></div>
          {game.phase === "ready" && <button className="start-race" onClick={() => setGame((current) => ({ ...current, phase: "running", lastAction: "Race started. Use Run faster to begin moving." }))}>START RACE <b>→</b></button>}
          <div className="finish-flag"><span>40K</span></div>
          <div className="road-line one" /><div className="road-line two" />
        </div>
        <div className={`status-strip ${alert !== game.lastAction ? "attention" : ""}`}><i /><div><span>{alert !== game.lastAction ? "CHECK VITALS" : "LAST ACTION"}</span><strong>{alert}</strong></div></div>
        <div className="pace-display"><span>CURRENT PACE</span><div>{[0,1,2,4].map((pace) => <b key={pace} className={game.pace === pace ? "active" : ""}>{PACE_NAMES[pace]}</b>)}</div></div>
        <div className="secondary-readouts"><span>Insulin <b>{game.insulin.toFixed(0)} µU/mL</b></span><span>Glucagon <b>{game.glucagon.toFixed(0)} pg/mL</b></span><span>Plasma volume <b>{game.plasmaVolume.toFixed(2)} L</b></span><span>Glycogen <b>{game.glycogen.toFixed(0)}</b></span></div>
      </section>

      <aside className="vitals-panel" aria-label="Vital signs">
        <div className="panel-heading"><span>LIVE VITALS</span><strong>Keep values in the green</strong></div>
        <Vital name="glucose" label="Blood glucose" value={game.glucose} unit="mg/dL" min={40} max={260} safeMin={70} safeMax={180} />
        <Vital name="oxygen" label="Oxygen saturation" value={game.oxygen} unit="%" min={80} max={100} safeMin={95} safeMax={100} />
        <Vital name="temperature" label="Body temperature" value={game.temperature} unit="°C" min={34} max={41} safeMin={36} safeMax={38.5} />
        <Vital name="sodium" label="Plasma sodium" value={game.sodium} unit="mmol/L" min={120} max={160} safeMin={135} safeMax={145} />
        <div className="legend"><span><i className="green" /> normal</span><span><i className="amber" /> warning</span><span><i className="red" /> stop</span></div>
      </aside>
    </div>

    {(game.phase === "finished" || game.phase === "collapsed") && <div className="result-overlay"><section role="dialog" aria-modal="true"><span>{game.phase === "finished" ? "FINISH" : "RUNNER COLLAPSED"}</span><h2>{game.phase === "finished" ? "40,000 m complete" : game.cause}</h2><p>{game.phase === "finished" ? "You kept the runner's homeostasis loops working through the marathon." : "Review the vital that crossed its emergency boundary, then try again."}</p><button onClick={() => setGame(initialGame())}>Restart game</button></section></div>}

    {showScience && <div className="science-overlay" onMouseDown={() => setShowScience(false)}><section role="dialog" aria-modal="true" aria-label="Science and bug fixes" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={() => setShowScience(false)} aria-label="Close">×</button><span>SCIENCE NOTES</span><h2>Same game. Corrected boundaries.</h2><p>The controls and feedback loops match the original. The race is only time-compressed. Physiological thresholds are sourced; response rates are simplified for class play.</p><dl><div><dt>Blood glucose</dt><dd>Warning below 70 mg/dL; collapse below 54. The original hormone buttons used <code>max</code> where they needed <code>min</code>, forcing values past their caps. Basal insulin also drained glucose every frame. Both bugs are fixed.</dd></div><div><dt>Other vitals</dt><dd>SpO₂ normal 95–100%, urgent at 88%. Sodium normal 135–145 mmol/L. Hypothermia below 35°C; suspected exertional heat stroke at 40°C with neurological symptoms.</dd></div></dl><nav><a href="https://diabetes.org/sites/dpro/files/2025-01/severehypoglycemia2_2024_final.pdf" target="_blank" rel="noreferrer">ADA: hypoglycemia</a><a href="https://www.cdc.gov/diabetes/treatment/index.html" target="_blank" rel="noreferrer">CDC: glucose targets</a><a href="https://medlineplus.gov/lab-tests/pulse-oximetry/" target="_blank" rel="noreferrer">MedlinePlus: SpO₂</a><a href="https://www.medlineplus.gov/ency/article/003481.htm" target="_blank" rel="noreferrer">MedlinePlus: sodium</a><a href="https://medlineplus.gov/hypothermia.html" target="_blank" rel="noreferrer">MedlinePlus: hypothermia</a><a href="https://www.cdc.gov/niosh/heat-stress/about/illnesses.html" target="_blank" rel="noreferrer">CDC: heat illness</a></nav></section></div>}
  </main>;
}
