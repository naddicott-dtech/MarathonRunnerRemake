# Homeostasis Marathon Lab

A browser-based biology game in which students manually manage the homeostasis loops that keep a marathon runner alive.

## Run locally

Requires Node.js 20 or newer.

```bash
npm ci
npm run dev
```

Open the local address printed in the terminal.

## Publish with GitHub Pages

1. Create a public repository on GitHub.
2. Push this project to its `main` branch.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Open the **Actions** tab and wait for “Deploy to GitHub Pages” to finish.

The resulting Pages URL is public and requires no ChatGPT account or application installation.

## Commands

- `npm run dev` — start the local development server
- `npm run build` — create the static site in `dist/`
- `npm run preview` — preview the static build locally
- `npm run lint` — check the source code
