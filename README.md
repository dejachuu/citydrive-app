# City Drive

Drive supercars through real cities in your browser. Streets, buildings, parks and water come live from OpenStreetMap, so you can drive anywhere on Earth.

**Play:** https://dejachuu.github.io/citydrive-app/

## Controls
| Key | Action |
|---|---|
| W / ↑ | Accelerate |
| S / ↓ | Brake / reverse |
| A D / ← → | Steer |
| Space | Handbrake drift |
| Shift | Nitro |
| C | Camera |
| L | Headlights |
| T | Time of day |
| H | Horn |
| R | Reset car to the road |
| Esc | Menu / garage |

Mouse drag looks around and the wheel zooms. Gamepads and touch screens work too.

## Updating
`.\publish.ps1 -Notes "What changed"` bumps `version.txt`, stamps it into `index.html`, pushes to GitHub and creates a release. GitHub Pages serves the new build, and open games reload into it.

`.\serve.ps1` runs it locally at http://localhost:8765.

Map data © OpenStreetMap contributors (ODbL).

The Concept GT uses the "Car Concept" model by Eric Chadwick, © 2024 Darmstadt Graphics Group GmbH, from the Khronos glTF Sample Assets, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Changes: scaled, Khronos logos removed, glass and paint materials changed. It was derived from a public-domain (CC0) model by Unity Fan. Car names are trademarks of their owners. This is a fan project with stylised models.
