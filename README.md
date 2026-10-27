# Footy Volume

A playful volume control: kick a rugby ball to set the volume, with an optional puppy chasing after it.

Built with TypeScript, Vite, Three.js, and Rapier 3D. Runs entirely in the browser without a backend or API keys.

## Getting started

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev
```

## How to play

- Choose **Original** for power and elevation controls, or **Contact aim** to choose where to strike the ball.
- Drag and release to kick. The ball's final position determines the volume.
- Replay solo or with a puppy.
- Use the speaker button to play a sample at the selected volume. This does not change your device volume.

## Commands

```sh
npm run lint     # Check the source with ESLint
npm run build    # Type-check and build into dist/
npm run preview  # Preview the production build
```

Deploy `dist/` to any static hosting service. Add `?embed` to the URL for the embedded layout.
