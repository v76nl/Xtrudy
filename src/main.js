import { loadFont } from './geometry.js';
import { initUIFromState, initEvents } from './ui.js';
import { animate } from './scene.js';

initUIFromState();
initEvents();
loadFont('sans');
animate();
