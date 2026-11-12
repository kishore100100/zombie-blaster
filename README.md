# Zombie Blaster

A colourful, cartoon-style 3D arcade zombie shooter that runs in the browser. Soak funny, non-scary zombies with a water blaster, chain combos and grab power-ups.

This is a prototype of Chapter 1, The Outbreak: five connected locations (Abandoned Street, Shopping Mall, Parking Lot, Supermarket and the City Square boss fight). Between locations you visit the Lab to spend coins on blaster upgrades and craft special ammo from goo. It plays with keyboard and mouse, or with touch controls on a phone held sideways.

**Play it:** https://kishore100100.github.io/zombie-blaster/

## Controls

| Key | Action |
|---|---|
| W A S D | Move |
| Mouse | Look |
| Left click | Shoot |
| Right click (hold) | Aim |
| Shift (hold) | Sprint |
| Space | Jump |
| C | Dodge roll |
| R | Reload |
| Q | Super Splash |
| Esc / P | Pause |

On a phone or tablet: drag with the left thumb to move (push far to sprint), drag with the right thumb to look, and use the on-screen Fire, Jump, Dodge, Splash and Reload buttons.

Walk into the glowing gems to collect power-ups: Triple Shot, Rapid Fire, Power Soaker, Mega Freeze, Bubble Storm, Electric Blast and Fresh Water.

Boss tips: jump over the stomp shockwave, step off the purple target circles, and side-step the charge. Something on its back looks important.

## Run it locally

You need [Node.js](https://nodejs.org). Then:

```bash
node server.js
```

and open http://localhost:5173. An internet connection is needed the first time, because Three.js and the font load from a CDN.

## Built with

- [Three.js](https://threejs.org) for rendering
- WebAudio for all sound effects (synthesized, no audio files)

## Asset credits

All art assets are CC0 (public domain). Thank you to the creators:

- Characters: **KayKit Adventurers** and **KayKit Skeletons** by [Kay Lousberg](https://kaylousberg.com)
- Blaster and crates: **Blaster Kit** by [Kenney](https://kenney.nl)
- Buildings: **City Kit (Commercial)** by [Kenney](https://kenney.nl)
