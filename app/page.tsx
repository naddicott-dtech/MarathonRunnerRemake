"use client";
import { controlLimit, SWEAT_NAMES, effortHint } from "../src/simulation";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ACTION_NAMES, DEFAULT_CONFIG, PACE_NAMES, applyAction, initialGame, startGame, status, step } from "../src/simulation";
import type { Action, Game } from "../src/simulation";
import { advanceProgress, emptyProgress, progressLabel, readProgress, writeProgress } from "../src/progress";

const SIMULATED_DT = 1.2;
const FINISH_DISTANCE = DEFAULT_CONFIG.finishDistance;
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

function ActionButton({ action, game, act, active = false, children }: { action: Action; game: Game; act: (action: Action) => void; active?: boolean; children: ReactNode }) {
  const limit = controlLimit(game, action);
  const remaining = game.cooldowns[action] || 0;
  const cooldownLabel = remaining > 0 ? `${Math.ceil(remaining / DEFAULT_CONFIG.classroomSpeed)}s` : "";
  return <button className={`control-button ${active ? "active-effect" : ""}`} disabled={game.phase !== "running" || remaining > 1e-9 || !!limit} onClick={() => act(action)} aria-label={ACTION_NAMES[action]} aria-describedby={action === "banana" ? "banana-supply" : undefined} title={limit ? `${ACTION_NAMES[action]}: ${limit}` : undefined}><span>{children}</span>{(limit || remaining > 1e-9) && <small>{limit || cooldownLabel}</small>}</button>;
}

function Vital({ name, label, value, unit, min, max, safeMin, safeMax, showRanges }: { name: "glucose" | "oxygen" | "temperature" | "sodium"; label: string; value: number; unit: string; min: number; max: number; safeMin: number; safeMax: number; showRanges: boolean }) {
  const currentStatus = status(name, value);
  const position = Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
  const safeLeft = (safeMin - min) / (max - min) * 100;
  const safeWidth = (safeMax - safeMin) / (max - min) * 100;
  const precision = name === "temperature" ? 1 : 0;
  return <article className={`vital ${currentStatus}`} aria-label={`${label}: ${value.toFixed(precision)} ${unit}`}>
    <div className="vital-top"><div><span>{label}</span><small>{currentStatus}</small></div><strong>{value.toFixed(precision)} <i>{unit}</i></strong></div>
    <div className="vital-bar"><span className="safe-range" style={{ left: `${safeLeft}%`, width: `${safeWidth}%` }} /><b style={{ left: `${position}%` }} /></div>
    <div className="bar-labels">{showRanges ? <><span>{min}</span><span>normal {safeMin}–{safeMax}</span>{name !== "oxygen" && <span>{max}</span>}</> : <><span>low</span><span>normal band</span>{name !== "oxygen" && <span>high</span>}</>}</div>
  </article>;
}

function Dialog({ open, dialogRef, className, label, onClose, children }: { open: boolean; dialogRef: React.RefObject<HTMLDialogElement | null>; className: string; label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [dialogRef, onClose, open]);
  return <dialog ref={dialogRef} className={className} aria-label={label}>{children}</dialog>;
}

export default function Home() {
  const [session, setSession] = useState(() => ({
    game: initialGame(),
    progress: typeof window === "undefined" ? emptyProgress() : readProgress(),
  }));
  const [showScience, setShowScience] = useState(false);
  const [paused, setPaused] = useState(false);
  const [runnerFrame, setRunnerFrame] = useState(1);
  const { game, progress } = session;
  const scienceDialogRef = useRef<HTMLDialogElement>(null);
  const resultDialogRef = useRef<HTMLDialogElement>(null);
  const lastProgressWrite = useRef(0);
  const lastPersistedProgress = useRef(progress);
  const currentProgress = useRef(progress);

  useEffect(() => {
    currentProgress.current = progress;
    const now = Date.now();
    const justUnlocked = !lastPersistedProgress.current.rangesEarned && progress.rangesEarned;
    if (now - lastProgressWrite.current < 1000 && !justUnlocked) return;
    writeProgress(progress);
    lastProgressWrite.current = now;
    lastPersistedProgress.current = progress;
  }, [progress]);

  useEffect(() => {
    const flush = () => writeProgress(currentProgress.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || showScience || paused) return;
      setSession((currentSession) => {
        const current = currentSession.game;
        if (current.phase !== "running") return currentSession;
        const next = step(current, SIMULATED_DT);
        const updated = advanceProgress(currentSession.progress, current, next);
        return { game: next, progress: updated };
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [showScience, paused]);

  useEffect(() => {
    for (const animation of ["idle", "walk", "run", "dead"]) for (let frame = 1; frame <= 15; frame += 1) {
      const image = new Image();
      image.src = assetUrl(`runner/${animation}-${String(frame).padStart(2, "0")}.webp`);
    }
  }, []);

  useEffect(() => {
    if (paused || showScience) return;
    const interval = game.phase === "collapsed" ? 85 : game.pace === 0 ? 180 : game.pace === 1 ? 95 : game.pace === 2 ? 72 : 55;
    const timer = window.setInterval(() => setRunnerFrame((frame) => frame % 15 + 1), interval);
    return () => window.clearInterval(timer);
  }, [game.pace, game.phase, paused, showScience]);

  const act = useCallback((action: Action) => {
    if (!paused && !showScience) setSession((current) => ({ ...current, game: applyAction(current.game, action) }));
  }, [paused, showScience]);
  const restart = useCallback(() => {
    setPaused(false);
    setSession((current) => ({ ...current, game: initialGame() }));
  }, []);

  const alert = useMemo(() => {
    if (paused) return "Race paused — resume when you are ready. Vitals and learning time are frozen.";
    const warning = (["glucose", "oxygen", "temperature", "sodium"] as const).find((name) => status(name, game[name]) !== "normal");
    if (warning === "glucose") return "Glucose needs attention — consider fuel or hormone control.";
    if (warning === "oxygen") return "Blood oxygen is low — increase ventilation or reduce pace.";
    if (warning === "temperature" && game.hydration < -2 && game.sweatLevel > 0) return "Dehydration is limiting sweat output — replace fluid and reduce pace.";
    if (warning === "temperature" && game.weather.humidity >= 50 && game.sweatLevel >= 3) return "Humidity limits evaporation — more sweat may not add cooling. Reduce pace.";
    if (warning === "temperature") return "Heat balance needs attention — slow down or cool the runner.";
    if (warning === "sodium") return "Sodium is drifting — match fluid intake to losses.";
    if (game.hydration < -3) return "Water balance is falling — fluid loss is outpacing intake.";
    if (game.hydration > 1) return "Water balance is positive — repeated drinking can dilute sodium.";
    return game.lastAction;
  }, [game, paused]);

  const runnerAnimation = game.phase === "collapsed" ? "dead" : game.pace === 0 ? "idle" : game.pace === 1 ? "walk" : "run";
  const hydrationDisplay = Math.abs(game.hydration) < 0.05 ? 0 : game.hydration;
  const rangesText = progress.rangesEarned ? "Normal reference ranges are unlocked. Use them to explain why a run succeeds or fails." : `Numeric reference bounds are hidden while you learn them. The green band is your guide. ${progressLabel(progress)}; a failed run unlocks the reference card.`;

  return <main className="app-shell">
    <header className="game-header">
      <div className="game-title"><span>H</span><div><strong>HOMEOSTASIS</strong><small>MARATHON</small></div></div>
      <div className="conditions"><span>Outdoor <b>{game.weather.temperature.toFixed(0)}°C</b></span><span>Humidity <b>{game.weather.humidity.toFixed(0)}%</b></span><span>Classroom speed <b>12×</b></span></div>
      <div className="header-actions"><button disabled={game.phase !== "running"} onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button><button onClick={() => setShowScience(true)}>Science &amp; help</button><button onClick={restart}>Restart</button></div>
    </header>

    <div className="game-grid">
      <aside className="controls-panel" aria-label="Runner controls">
        <fieldset className="controls-fieldset" disabled={paused}><div className="panel-heading"><span>CONTROLS</span><strong>Run the feedback loops</strong></div>
        <section className="pace-controls"><h2><span>START HERE</span> Pace</h2><div className="button-pair"><ActionButton action="paceUp" game={game} act={act}>Run faster <b>↑</b></ActionButton><ActionButton action="paceDown" game={game} act={act}>Run slower <b>↓</b></ActionButton></div></section>
        <section><h2>Breathing</h2><div className="button-pair"><ActionButton action="breatheUp" game={game} act={act}>Breathe faster <b>+</b></ActionButton><ActionButton action="breatheDown" game={game} act={act}>Breathe slower <b>−</b></ActionButton></div><p><span>{game.breathingRate}</span> breaths/min</p><p className="control-hint">{effortHint(game, "breathing")}</p></section>
        <section><h2>Heart rate</h2><div className="button-pair"><ActionButton action="heartUp" game={game} act={act}>Increase <b>+</b></ActionButton><ActionButton action="heartDown" game={game} act={act}>Decrease <b>−</b></ActionButton></div><p><span>{game.heartRate}</span> beats/min</p><p className="control-hint">{effortHint(game, "heart")}</p></section>
        <section><h2>Fluid &amp; temperature</h2><div className="button-pair"><ActionButton action="water" game={game} act={act}>Drink water</ActionButton><ActionButton action="electrolyte" game={game} act={act}>Electrolyte water</ActionButton><ActionButton action="sweat" game={game} act={act} active={game.sweatLevel > 0}>Sweat <b>+</b></ActionButton><ActionButton action="sweatDown" game={game} act={act}>Relax sweat <b>−</b></ActionButton></div><p className="control-hint">Sweating: {SWEAT_NAMES[game.sweatLevel]}</p></section>
        <section><h2>Blood glucose</h2><div className="button-pair three"><ActionButton action="banana" game={game} act={act}>Eat banana</ActionButton><ActionButton action="glucagon" game={game} act={act}>Glucagon ↑</ActionButton><ActionButton action="insulin" game={game} act={act}>Insulin ↓</ActionButton></div><p id="banana-supply" className="control-hint" role="status">{game.bananasRemaining === 0 ? "Out of bananas" : `${game.bananasRemaining} banana${game.bananasRemaining === 1 ? "" : "s"} left this race`}</p><p className="hormone-readouts"><span>{game.insulin.toFixed(0)}</span> insulin · <span>{game.glucagon.toFixed(0)}</span> glucagon</p></section>
      </fieldset></aside>

      <section className="race-panel" aria-label="Race view">
        <div className="weather-notice" role="status"><strong>{game.weather.label} · {game.weather.temperature.toFixed(0)}°C · {game.weather.humidity.toFixed(0)}% humidity</strong><span>{game.weather.hint}</span></div>
        <div className="race-stats"><div><span>TIME</span><strong>{game.time.toFixed(1)} s</strong></div><div><span>DISTANCE</span><strong>{game.distance.toFixed(0)} m</strong></div></div>
        <div className="progress"><div style={{ width: `${game.distance / FINISH_DISTANCE * 100}%` }} /><span>{(game.distance / 1000).toFixed(1)} km</span><b>40 km</b></div>
        <div className="scene"><div className="sun" />{/* Scenery follows distance, so speed and all simulation pauses stay in sync. */}
          <div className="horizon" aria-hidden="true" style={{ backgroundPositionX: `${-game.distance * .9}px` }} /><div className="road-line one" /><div className="road-line two" />
          <div className={`original-runner pace-${game.pace} ${game.phase}`} aria-label={`Runner is ${paused ? "paused" : (PACE_NAMES[game.pace] || "paused").toLowerCase()}`}><img src={assetUrl(`runner/${runnerAnimation}-${String(runnerFrame).padStart(2, "0")}.webp`)} alt="" /></div>
          {paused && <button className="start-race" onClick={() => setPaused(false)}>PAUSED · RESUME</button>}
          {game.phase === "ready" && <button className="start-race" onClick={() => setSession((current) => ({ ...current, game: startGame(current.game) }))}>START RACE <b>→</b></button>}
        </div>
        <div className={`status-strip ${!paused && alert !== game.lastAction ? "attention" : ""}`}><i /><div><span>{paused ? "PAUSED" : alert !== game.lastAction ? "CHECK VITALS" : "LAST ACTION"}</span><strong>{alert}</strong></div></div>
        <div className="pace-display"><span>CURRENT PACE</span><div>{[0, 1, 2, 4].map((pace) => <b key={pace} className={game.pace === pace ? "active" : ""}>{PACE_NAMES[pace]}</b>)}</div></div>
        <div className="secondary-readouts"><span>Hydration balance <b>{hydrationDisplay >= 0 ? "+" : ""}{hydrationDisplay.toFixed(1)}%</b></span><span>Food <b>{game.gutCarbs > 1 ? "Digesting" : "None pending"}</b></span><span>Drink <b>{game.gutWater + game.gutElectrolyte > .05 ? "Absorbing" : "None pending"}</b></span><span>Liver glycogen <b>{game.glycogen.toFixed(0)} g</b></span><span>Muscle glycogen <b>{game.muscleGlycogen.toFixed(0)} g</b></span><span>Sweating <b>{SWEAT_NAMES[game.sweatLevel]}</b></span></div>
      </section>

      <aside className="vitals-panel" aria-label="Vital signs">
        <div className="panel-heading"><span>LIVE VITALS</span><strong>{progress.rangesEarned ? "Reference ranges earned" : "Learn the bands"}</strong></div>
        <p className="range-lock-copy">{rangesText}</p>
        <Vital name="glucose" label="Blood glucose" value={game.glucose} unit="mg/dL" min={40} max={260} safeMin={70} safeMax={180} showRanges={progress.rangesEarned} />
        <Vital name="oxygen" label="Oxygen saturation" value={game.oxygen} unit="%" min={80} max={100} safeMin={95} safeMax={100} showRanges={progress.rangesEarned} />
        <Vital name="temperature" label="Body temperature" value={game.temperature} unit="°C" min={34} max={41} safeMin={36} safeMax={38.5} showRanges={progress.rangesEarned} />
        <Vital name="sodium" label="Plasma sodium" value={game.sodium} unit="mmol/L" min={120} max={160} safeMin={135} safeMax={145} showRanges={progress.rangesEarned} />
        <div className="legend"><span><i className="green" /> normal</span><span><i className="amber" /> warning</span><span><i className="red" /> stop</span></div>
      </aside>
    </div>

    <Dialog open={game.phase === "finished" || game.phase === "collapsed"} dialogRef={resultDialogRef} className={`result-dialog ${game.phase === "finished" ? "success" : ""}`} label={game.phase === "finished" ? "Race finished" : "Runner collapsed"} onClose={() => { if (game.phase !== "running") restart(); }}>
      <span>{game.phase === "finished" ? "FINISH" : "RUNNER COLLAPSED"}</span><h2>{game.phase === "finished" ? "40,000 m complete" : game.cause || "Homeostasis failed"}</h2><p>{game.phase === "finished" ? "You kept the runner's homeostasis loops working through the marathon." : "Review the vital that crossed its emergency boundary, then try again."}</p>{progress.rangesEarned && <p className="earned-reference">Reference ranges earned: glucose 70–180 mg/dL · oxygen 95–100% · temperature 36–38.5°C · sodium 135–145 mmol/L.</p>}<button onClick={restart}>Restart game</button>
    </Dialog>

    <Dialog open={showScience} dialogRef={scienceDialogRef} className="science-dialog" label="Science and help" onClose={() => setShowScience(false)}>
      <button className="close" onClick={() => setShowScience(false)} aria-label="Close">×</button><span>SCIENCE NOTES</span><h2>Manual feedback, simplified model.</h2><p>You control selected corrective responses while the runner is moving. The body continues using fuel, losing water and sodium through sweat, exchanging fluid through the gut, and changing temperature. Pace creates demand; no single button permanently protects a runner. Match heart rate and breathing to effort: excessive settings spend extra glucose, even after slowing down. A heart rate below pace needs also makes fuel use less efficient in this model. These fuel costs are teaching simplifications. You carry three bananas per race; Restart restocks them. Food and drinks take time to absorb; watch the trend before repeating a correction.</p><dl><div><dt>How to play</dt><dd>Watch qualitative status and trends, then decide whether to change pace, breathing, heart rate, sweat, fluids, or glucose controls. Dehydration can limit sweat output, while humid air can make extra sweat less useful for cooling. A warning is a chance to correct course. Use Pause to stop the race and its controls; Resume continues from the same moment. Weather shifts during the race: watch the conditions banner and adjust to changes in cooling. Opening help or hiding the page also pauses the simulation.</dd></div><div><dt>Model boundary</dt><dd>This is a classroom model. Its emergency cutoffs are game rules that make feedback visible; clinical diagnosis also depends on symptoms, rate of change, measurements, and context.</dd></div>{progress.rangesEarned ? <div><dt>Reference ranges</dt><dd>Blood glucose 70–180 mg/dL; oxygen saturation 95–100%; temperature 36–38.5°C; and sodium 135–145 mmol/L. These are teaching reference bands, while the simulation&apos;s emergency cutoffs are game rules.</dd></div> : <div><dt>Earn the ranges</dt><dd>Complete a failed run, or maintain a moving runner without dangerous vitals for about 15 active minutes. The reference card and source links will then appear.</dd></div>}</dl>{progress.rangesEarned && <nav><a href="https://diabetes.org/sites/dpro/files/2025-01/severehypoglycemia2_2024_final.pdf" target="_blank" rel="noreferrer">ADA: hypoglycemia</a><a href="https://medlineplus.gov/lab-tests/pulse-oximetry/" target="_blank" rel="noreferrer">MedlinePlus: SpO₂</a><a href="https://www.medlineplus.gov/ency/article/003481.htm" target="_blank" rel="noreferrer">MedlinePlus: sodium</a><a href="https://medlineplus.gov/hypothermia.html" target="_blank" rel="noreferrer">MedlinePlus: hypothermia</a><a href="https://www.cdc.gov/niosh/heat-stress/about/illnesses.html" target="_blank" rel="noreferrer">CDC: heat illness</a></nav>}
    </Dialog>
  </main>;
}
