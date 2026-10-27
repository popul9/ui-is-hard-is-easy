# Footy Volume

All this, just to turn the volume up.

Kick a footy, watch where it lands, and live with the volume you get. Bring a puppy into the next round if that sounds too straightforward.

## From “UI is Hard” to this

I wrote a post called “UI is Hard.” A friend responded by showing me the Worst UI Challenge, where people invent deliberately terrible volume controls.

I usually think about how to make an interface more efficient. This was an excuse to send that instinct in the opposite direction. What if adjusting the volume required a well-placed kick?

The title [UI is Hard is Easy](https://heejun.net/developer/ui-is-hard-is-easy/) is a playful reply to that earlier post, with a nod to Richard P. Gabriel’s “Worse is Better is Worse.”

## A footy game that stayed with me

Earlier that year, I saw Pro Jank Footy at a game expo. Its odd ball movement caught my attention, so I asked the developer about it: a 3D engine underneath, presented through a 2D filter.

That idea stayed with me until this little experiment gave me somewhere to use it.

## Awkward, on purpose

Making something inefficient doesn't mean abandoning every UX value. I still wanted the player's actions to matter, even when the outcome was hard to predict.

And yes, there's a puppy. You can play solo, or invite a little more chaos.

## Give it a kick

Drag and release to kick. Try **Original** for power and elevation controls, or **Contact aim** to choose where your foot meets the ball. The final position sets the volume; the speaker button lets you hear it. Your device volume stays as it is.

The game is playable in the [original blog post](https://heejun.net/developer/ui-is-hard-is-easy/), alongside the full story.

## Run locally

With Node.js 22.12 or later:

```sh
npm install
npm run dev
```

Made with TypeScript, Vite, Three.js, and Rapier 3D.
