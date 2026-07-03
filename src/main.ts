import { loadFont } from './geometry.ts';
import { initUIFromState, initEvents } from './ui.ts';
import { animate } from './scene.ts';

initUIFromState();
initEvents();
loadFont('sans');
animate();
