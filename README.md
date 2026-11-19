# Porto Veloce

A Windows x64 desktop driving game set in a fictional coastal city. Drive the Lamborghini Aventador LP 700-4 along the waterfront, explore the old town and office district, or run the nine-gate Harbor Sprint.

## Play

Extract the complete folder. Open `PortoVeloce.exe` to play from that location. To install the project in `D:\Projects\Games\PortoVeloce`, run `Install-to-D.cmd`. The installer opens the game after copying and stops if a destination folder already exists.

The app uses .NET Framework 4.8, Microsoft Edge WebView2 Runtime, and a WebGL 2 graphics driver. The models, maps, sound generator and rendering libraries ship in the folder. Gameplay runs offline. WebView2 Runtime is available from https://developer.microsoft.com/microsoft-edge/webview2/.

## A1 coastal highway

Choose **Highway** on the main menu to start on the A1. From free drive, follow Lungomare north or south past the last intersection to enter the divided highway. The A1 runs around the inland hills and returns to the other end of the waterfront. The west interchange connects the northbound carriageway to the central east-west street. Follow **Porto Veloce · Uscita Ovest** to return to the city. The minimap zooms out with speed on the highway, and R recovers the car in a nearby lane.

## Explore the region

The A1 has two one-way turnaround flyovers. Follow the **U-TURN / Inversione** signs, leave on the right, cross over the highway and merge onto the opposite carriageway. The ramps return to the highway itself; the long west city-link bridge and connecting avenue have been removed.

- **North turnaround:** changes northbound travel to southbound. From Porto Veloce's west entrance, join A1 North, take this turnaround, then follow **Exit 2 / Bellacosta** or **Exit 3 / Valdoro**.
- **South turnaround:** changes southbound travel to northbound, for returning toward Porto Veloce's west exit or reversing your route.

Use the region map to see both loops, or choose either turnaround in the free-drive start selector. Recovery preserves the elevated road, and highway traffic passes underneath. The deck uses a continuous surface and slope-aligned barriers.

- **Bellacosta**: courtyard housing, the covered market and Piazza del Sole, a fountain, municipal hall and clock tower, neighborhood parks, and a service station.
- **Valdoro**: offices and apartments, a central station with a stationary regional train, platforms, warehouse yards, parks, parking areas, and a service station.

The towns add 28 named streets (20.16 km of street centerlines), local traffic, bus shelters, shops, crossings and street lighting. Press **Tab while driving** or choose **Region map** from either menu to see the road network. Free drive also offers a **Start in** selector for all three cities. Recovery stays within the town you are exploring. Parking forecourts use paved-road grip.

The stations and bus shelters are scenery; public transport and pedestrian simulation are not implemented. The next realism priorities are pedestrians at crossings, working signals with traffic yielding, curved residential streets, and a day/night cycle with lit shops.

Run `node tests/region.test.mjs` to validate paved surfaces, vehicle clearance, town recovery, traffic spawn positions and scene geometry without a graphics driver. Verified with Node 25.

## Autodromo Riviera

Choose **Track day → Enter Autodromo Riviera** for the starting grid, or drive there via **A1 / Porto Ovest** and follow the Autodromo signs on the west connector. Free drive also includes a circuit starting location. The region map and minimap show the circuit in coral.

The 2.97 km, 15 m wide circuit has a 420 m main straight, sweeping corners, an S-section, red/white kerbs, runoff, barriers, braking boards, a covered grandstand, timing tower and garage paddock. A separate pit lane joins the track at both ends; the paddock connects to the public access road. The pit speed sign is advisory; pit servicing and race opponents are not implemented.

Cross the chequered line in the forward direction to start an unlimited hotlap session. The HUD shows current, last and locally saved best lap times. Complete all three intermediate checkpoints in order. Red/white curbs, painted runoff, gravel and pit pavement are legal surfaces. Touching grass with a tire or contacting a wall invalidates the attempt. Pit travel does not award circuit checkpoints; reverse driving, teleporting and recovery cannot produce a valid lap. Cross the start line again to begin a fresh lap. Pausing or opening the map freezes timing. **R** recovers the car to a nearby circuit, pit or access lane.

Validation: `node tests/region.test.mjs` checks track, pit and access clearance and drives a complete timed lap through the actual physics simulation. `node tests/lap-timer.test.mjs` checks valid laps and shortcut/reverse/recovery rejection.

## Driving

The car starts in first gear. Accelerate with W and upshift with X near the redline. Tap M for automatic shifts. Press N or B to select neutral or reverse at any speed. Neutral lets the car coast. If you select reverse while rolling forward, applying throttle slows the car and then backs it up.

| Action | Keyboard | Standard Xbox-style gamepad |
| --- | --- | --- |
| Accelerate / brake | W / S or up / down | RT / LT |
| Steer | A / D or left / right | Left stick |
| Upshift / downshift | X / Z | RB / LB |
| Neutral / reverse | N / B | Paddle through N |
| Hold clutch / free-rev | Shift | — |
| Handbrake | Space | A |
| Automatic / manual | M | — |
| Cycle chase, driver, bumper cameras | C | Y |
| Look behind | Hold V | — |
| Recover and repair | R | — |
| Pause | Esc | Start |
| Controls / fullscreen | H / F11 | — |

In the city, free-drive recovery places the car in a northbound lane. Recovering during Harbor Sprint restarts the timer and returns the car to the start. The minimap shows the sprint route. Translucent lime gates mark each checkpoint. Personal best, sound and transmission preferences are saved locally.

## Simulation and project

The 120 Hz planar rigid-body simulation models engine torque, final drive and gear ratios, aerodynamic drag, braking, lateral tire slip, yaw inertia and surface grip. Speed-sensitive steering, extra rear grip and yaw damping help the car settle after a quick steering correction. The handbrake releases rear grip and disengages the stability assist while held. A shift interrupts drive torque. Downshift protection rejects a gear that would over-rev the engine. Collisions deform exterior panels locally and reduce available drive torque. The simplified model omits chassis soft bodies, suspension travel and component detachment.

The stereo engine sound is synthesized from alternating cylinder-bank pulses, damped resonators and a short exhaust reflection delay. RPM, throttle, shifts, tire slip and vehicle speed drive the sound.

The `game` folder contains the editable JavaScript, shaders, interface and assets. `Desktop.cs` hosts the renderer in a Windows desktop window. `Build.cmd` recompiles the host executable. Changes to JavaScript need no build step. Close the game before rebuilding the executable. Third-party asset sources appear in `CREDITS.md`.
"# PortoVeloce" 
"# PortoVeloce" 
