# Manual Homeostasis: rebalance notes

This is a classroom model, not a clinical predictor. The player takes over the corrective responses represented by the controls. Basal physiology continues. Real healthy runners do not need to consciously release glucagon or adjust their heart rate.

## Learning and pacing

- An ordinary managed race should last approximately 8–14 active classroom minutes.
- Sprinting is always selectable during an active race after the pace cooldown. It raises heat and fuel demand; there is no stamina gate or automatic fuel-related slowdown. Students can deliberately push the runner out of homeostasis.
- A warning is an opportunity to observe a trend and intervene; not every temporary excursion is a failed run.
- Current measurements, colored normal bands, and qualitative warnings remain visible. Numeric reference ranges are earned after a failed run or 900 cumulative active classroom seconds without a dangerous vital, while moving. The explicit Pause/Resume control freezes the race, actions, cooldowns, and animation. Paused, hidden-page, idle, and terminal time do not count. Losing focus while the page remains visible does not itself pause the race. Progress is saved on this browser and survives restarting a race.
- The reference unlock is a learning aid, not an anti-cheat system. Source code contains the thresholds. A shared classroom browser also shares its saved progress.

## Model boundaries

**Clock.** The engine receives simulated seconds. The browser advances 1.2 simulated seconds per 0.1 active classroom seconds, with no background catch-up. Distance and physiological rates share that clock. Interface cooldowns are defined in classroom seconds and converted once. A headless run uses identical steps without waiting; accelerated CPU execution never earns browser learning progress.

**Oxygen.** Ventilation affects saturation. Heart rate does not directly change arterial saturation. High saturation does not cause failure. Oxygen delivery and exercise reserve have been removed from the engine, UI, and progress eligibility.

**Fuel and control matching.** Liver glycogen supplies the effective glucose pool; muscle glycogen remains a tracked store but does not lock pace or trigger collapse. Glucagon mobilizes finite liver glycogen. Food enters through a delayed gut compartment. Each race starts with three bananas (25 g carbohydrate each); accepted eating consumes one immediately, and the existing 45-classroom-second cooldown still applies. Empty inventory blocks eating in the shared engine and displays “Out of bananas.” Restart replenishes the allowance. This is an explicit game-resource limit, not a physiological limit on eating. Hormone effects decay toward basal values rather than automatically correcting glucose. The concentration conversion represents calibrated buffering, not literal blood volume. The model omits gluconeogenesis, fat oxidation, and full insulin physiology.

Heart and breathing work require energy: see [cardiac oxygen demand](https://cvphysiology.com/cad/cad003) and [respiratory muscle energetics](https://pmc.ncbi.nlm.nih.gov/articles/PMC4933622/). These sources do **not** establish the game's glucose coefficients. A direct blood-glucose penalty for mismatched controls is an explicit teaching abstraction, not a clinical prediction or a claim that these muscles use only glucose. Low heart rate is represented as inefficient fuel use; it does not introduce another hidden oxygen meter.

Pace needs (rest/jog/run/sprint) are 60/105/140/180 beats/min and 12/20/26/34 breaths/min. These are gameplay targets, not exercise prescriptions. A tolerance of 10 beats/min and 2 breaths/min avoids a single exact optimum. Extra glucose-pool consumption per simulated second is 0.00006 × excess beats/min plus 0.0003 × excess breaths/min plus 0.000075 × deficient beats/min, outside those tolerances. The existing pool-to-concentration factor is 2. Matching hints use the same pace targets. Lowering pace requires readjusting controls; maximal settings are not always efficient.

**Fluids.** Absorbed drinks enter a body-water pool with a Na-equivalent exchangeable-solute proxy. Sweat and urine remove water and solute. Plasma volume is only a derived estimate, not the entire water reservoir. Drinking 250 mL no longer dumps that entire amount into a 3 L plasma bucket. Sports drink contains 25 mmol/L sodium, remains hypotonic, and cannot prevent dilution if intake persistently exceeds losses. Renal clearance is limited and reduced during harder exercise; this approximates exercise-related water retention without a kidney simulator.

**Heat.** Heat generation rises with pace. Sweat is a persistent, manually selected level: A little, Moderate, Heavy, Out of every pore. The lowest setting still produces basal sweat; these labels describe the selected effort, not measured output when dehydration limits production. Humidity caps evaporative cooling; all produced sweat still costs fluid. Dehydration impairs sweat supply. There is no default cold-collapse or high-glucose-collapse route. Extreme glucose still receives a warning. Outdoor temperature and humidity are configurable in the engine. The default course changes on the shared simulated clock, ramping each transition over 120 simulated seconds (10 classroom seconds):

| Classroom time | Temperature | Humidity | Condition |
| --- | ---: | ---: | --- |
| Start | 36°C | 60% | Warm start |
| 2:30 | 40°C | 85% | Hot, humid stretch |
| 7:30 | 32°C | 35% | Cooler, drier air |
| 9:10 | 38°C | 75% | Heat and humidity return |
| 10:50 | 34°C | 50% | Milder conditions |

These compressed changes represent different course conditions, not a meteorological forecast. They use offsets from configured initial conditions; `weatherChanges: []` gives a controlled constant-weather experiment. The [CDC explanation of heat exchange](https://www.cdc.gov/yellow-book/hcp/environmental-hazards-risks/heat-and-cold-illness-in-travelers.html) supports the direction of hotter air and higher humidity reducing cooling; event timing, heat coefficients, and threshold severity are gameplay choices. Weather cannot advance while the simulation is paused, hidden, in help, or terminal.

**Failure.** The severe boundaries are explicit classroom rules: low oxygen, low glucose, heat emergency at 40°C, low/high sodium, or severe dehydration. Heat stroke in real patients requires more than a temperature reading; the UI calls the endpoint a heat emergency. If multiple failures occur in one step they are all retained. Depleted muscle fuel does not itself cause loss of consciousness.

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
