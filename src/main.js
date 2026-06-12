import { Game } from './Game.js';

const canvas = document.getElementById('game-canvas');
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const loaderText = document.getElementById('loader-text');

async function boot() {
  try {
    await Game.create(canvas, (pct, path) => {
      const name = path.split('/').pop();
      loaderBar.style.width = `${Math.round(pct * 100)}%`;
      loaderText.textContent = `Loading ${name}…`;
    });
    loader.classList.add('hidden');
  } catch (err) {
    loaderText.textContent = `Failed to start: ${err.message}`;
    console.error(err);
  }
}

boot();
