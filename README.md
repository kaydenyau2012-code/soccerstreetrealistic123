# Street Soccer 3D — Multiplayer project

This package keeps the original game in `index.html` and adds the Socket.IO server it expects.

## Deploy on Render

1. Extract this ZIP and put the contents in a GitHub repository.
2. In Render, create **New + → Web Service** (not Static Site).
3. Connect the repository.
4. Use:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
5. Deploy. Open the `https://...onrender.com` service URL.

The game is served by the same service as its multiplayer server, so its existing
`location.origin` server setting points to the correct Socket.IO endpoint.

## Run locally

Install Node.js 18 or newer, open a terminal in this folder, then run:

```bash
npm install
npm start
```

Open http://localhost:3000

## Notes

- Keep the service running while players use multiplayer.
- Use the Web Service URL, not a Render Static Site URL.
- Multiplayer rooms are in memory; restarting the server closes active rooms.
- The original HTML/game content is included unchanged.
