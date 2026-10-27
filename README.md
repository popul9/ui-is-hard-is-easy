# Footy Volume

A playful volume control: kick a rugby ball to set the volume, with an optional puppy chasing after it.

Built with TypeScript, Vite, Three.js, and Rapier 3D. Runs entirely in the browser without a backend or API keys.

## Why this exists

After I wrote “UI is Hard,” a friend introduced me to the Worst UI Challenge: deliberately making a terrible volume control. This game was my excuse to stop chasing efficiency and make something playfully awkward instead—setting the volume by kicking a footy.

The physics were inspired by Pro Jank Footy, which I saw at a game expo. Its unusual ball movement and 3D physics presented through a 2D view stuck with me. Even with an intentionally awkward interface, I wanted the player's actions to stay in their control.

Read the story: [UI is Hard is Easy](https://heejun.net/developer/ui-is-hard-is-easy/).

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
