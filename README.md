# Porto Veloce

A Windows x64 desktop driving game set in a fictional coastal city. Drive the Lamborghini Aventador LP 700-4 along the waterfront, explore the old town and office district, or run the nine-gate Harbor Sprint.

## Play

Extract the complete folder. Open `PortoVeloce.exe` to play from that location. To install the project in `D:\Projects\Games\PortoVeloce`, run `Install-to-D.cmd`. The installer opens the game after copying and stops if a destination folder already exists.

The app uses .NET Framework 4.8, Microsoft Edge WebView2 Runtime, and a WebGL 2 graphics driver. The models, maps, sound generator and rendering libraries ship in the folder. Gameplay runs offline. WebView2 Runtime is available from https://developer.microsoft.com/microsoft-edge/webview2/.

## A1 coastal highway

Choose **Highway** on the main menu to start on the A1. From free drive, follow Lungomare north or south past the last intersection to enter the divided highway. The A1 runs around the inland hills and returns to the other end of the waterfront. The west interchange connects the northbound carriageway to the city along the central east-west street. Follow the signs for **Centro città** to exit. The minimap zooms out with speed on the highway, and R recovers the car in a nearby lane.

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
