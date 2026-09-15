# Manual Homeostasis: rebalance notes

This is a classroom model, not a clinical predictor. The player takes over the corrective responses represented by the controls. Basal physiology continues. Real healthy runners do not need to consciously release glucagon or adjust their heart rate.

## Learning and pacing

- An ordinary managed race should last approximately 8–12 active classroom minutes.
- Sustained sprinting uses a finite effort reserve and eventually forces a slowdown. It also raises heat and fuel demand. A high heart-rate setting does not make sprinting sustainable forever.
- A warning is an opportunity to observe a trend and intervene; not every temporary excursion is a failed run.
- Current measurements, colored normal bands, and qualitative warnings remain visible. Numeric reference ranges are earned after a failed run or 900 cumulative active classroom seconds without a dangerous vital, while moving. The explicit Pause/Resume control freezes the race, actions, cooldowns, and animation. Paused, hidden-page, idle, and terminal time do not count. Losing focus while the page remains visible does not itself pause the race. Progress is saved on this browser and survives restarting a race.
- The reference unlock is a learning aid, not an anti-cheat system. Source code contains the thresholds. A shared classroom browser also shares its saved progress.

## Model boundaries

**Clock.** The engine receives simulated seconds. The browser advances 1.2 simulated seconds per 0.1 active classroom seconds, with no background catch-up. Distance and physiological rates share that clock. Interface cooldowns are defined in classroom seconds and converted once. A headless run uses identical steps without waiting; accelerated CPU execution never earns browser learning progress.

**Oxygen.** Ventilation affects saturation. Circulation, saturation, and hydration jointly affect oxygen delivery. Poor delivery can exhaust the effort reserve without pretending that heart rate directly changes arterial oxygen saturation. High saturation does not cause failure.

**Fuel.** Liver glycogen supplies the effective glucose pool; muscle glycogen supports exercise. Glucagon mobilizes finite liver glycogen. Food enters through a delayed gut compartment. Hormone effects decay toward basal values rather than automatically correcting the player's glucose. The concentration conversion represents calibrated buffering, not literal blood volume. The model omits gluconeogenesis, fat oxidation, and full insulin physiology. Sprint reserve is a teaching abstraction, not a measured anaerobic-energy store.

**Fluids.** Absorbed drinks enter a body-water pool with a Na-equivalent exchangeable-solute proxy. Sweat and urine remove water and solute. Plasma volume is only a derived estimate, not the entire water reservoir. Drinking 250 mL no longer dumps that entire amount into a 3 L plasma bucket. Sports drink contains 25 mmol/L sodium, remains hypotonic, and cannot prevent dilution if intake persistently exceeds losses. Renal clearance is limited and reduced during harder exercise; this approximates exercise-related water retention without a kidney simulator.

**Heat.** Heat generation rises with pace. Sweat is a persistent, manually selected level, not a five-second button-mashing effect. Humidity caps evaporative cooling; all produced sweat still costs fluid. Dehydration impairs sweat supply and circulation. There is no default cold-collapse or high-glucose-collapse route. Extreme glucose still receives a warning. Outdoor temperature and humidity are configurable in the engine.

**Failure.** The severe boundaries are explicit classroom rules: low oxygen, low glucose, heat emergency, low/high sodium, severe dehydration, or exhausted reserve with inadequate oxygen delivery. Heat stroke in real patients requires more than a temperature reading; the UI calls the endpoint a heat emergency. If multiple failures occur in one step they are all retained. Ordinary fatigue forces a slower pace rather than being labeled a medical collapse.

## Research informing the direction

### Explaining collapse near the finish

Fuel depletion, inadequate oxygen delivery, exertional heat illness, and exercise-associated hyponatremia are useful teaching pathways, but they are not an exhaustive or equally common explanation of real runner collapse. Accumulated strain can make late-race problems plausible; the engine does not add a special failure trigger when the finish becomes visible.

- Glycogen depletion can cause profound fatigue ("hitting the wall") without loss of consciousness. Severe hypoglycemia is a distinct problem affecting brain function; the game simplifies fuel metabolism. See [endurance fuel modeling](https://pubmed.ncbi.nlm.nih.gov/20975938/).
- Airway smooth muscle contraction narrows the airway; relaxation widens it. Sympathetic activation can promote dilation through smooth muscle relaxation. Trachealis relaxation is not a supported explanation for premature airway closure. See [tracheal anatomy](https://www.ncbi.nlm.nih.gov/books/NBK448070/).
- Exercise-induced bronchoconstriction can occur during or after exertion, particularly in susceptible runners. Airway drying and cooling during heavy ventilation are established mechanisms. The proposed sequence "seeing the finish line, mentally relaxing, then dangerous airway constriction" is not established and is not modeled. See the [American Thoracic Society guideline](https://www.thoracic.org/statements/resources/allergy-asthma/exercise-induced-bronchoconstriction.pdf).
- Ordinary running in ambient air does not produce oxygen toxicity. Hyperventilation can lower carbon dioxide and cause symptoms despite normal oxygen saturation; this is different from excessive blood oxygen. CO2/pH and airway disease are not simulated. See [hyperventilation syndrome](https://www.merckmanuals.com/professional/pulmonary-disorders/symptoms-of-pulmonary-disorders/hyperventilation-syndrome).
- Collapse immediately after stopping has another important explanation: loss of the leg muscle pump while vessels remain dilated can reduce venous return and blood pressure. This post-exercise mechanism is not currently simulated and should be distinguished from collapse while still running. See [World Athletics on exercise-associated collapse](https://worldathletics.org/waendurancemedicine/exercise-associated-collapse).

### Sources for the modeled mechanisms

- [Mortensen et al., exercise oxygen delivery](https://pubmed.ncbi.nlm.nih.gov/15860533/): oxygen delivery is not synonymous with saturation.
- [Powers et al., exercise hypoxemia](https://pubmed.ncbi.nlm.nih.gov/3220070/): arterial desaturation during maximal exercise is not universal in healthy runners.
- [Exercise glucose regulation](https://pubmed.ncbi.nlm.nih.gov/10780953/): normal exercise involves defended glucose and hormonal responses; the manual-feedback premise deliberately changes this.
- [Third International Exercise-Associated Hyponatremia Consensus](https://pubmed.ncbi.nlm.nih.gov/26102445/): overdrinking hypotonic fluid and impaired water clearance are central mechanisms; sports drinks do not eliminate the risk.
- [NATA fluid replacement position statement](https://www.nata.org/sites/default/files/2025-08/fluid_replacement_for_the_physically_active.pdf): hydration and sodium status must be distinguished.
- [Humidity and running study](https://pubmed.ncbi.nlm.nih.gov/28349085/): humidity increases thermal and cardiovascular strain.
- [ACSM exertional heat illness consensus](https://pubmed.ncbi.nlm.nih.gov/37036463/): heat illness assessment is more than crossing a temperature threshold.

These sources inform mechanisms, not every coefficient. Heat/fuel scales, reaction delays, and learning thresholds are gameplay choices. Automated personas can identify dead ends and click burden, but cannot establish whether students find the game fun or learn the exam content.

## Regression strategy

Use a small engine invariant suite plus headless behavioral scenarios. Assertions should check outcomes and broad warning/recovery windows, not freeze every floating-point value. A separate progress suite checks failure unlock, safe active-time accumulation, restart persistence, malformed storage, and the 900-second boundary. Build and lint remain required checks.

Before changing difficulty, run the scenario matrix and compare completion time, failure cause, extreme vitals, accepted actions, and warnings. Keep a managed success, each intended neglect failure, an overdrinking failure, and a timestep-convergence check. Test configuration sweeps through the same engine instead of maintaining a separate approximate simulator.
