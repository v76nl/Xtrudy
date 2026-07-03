window.addEventListener('error', e => document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;top:0;left:0;z-index:9999;background:red;color:white;">ERROR: '+e.message+'</div>'));
window.addEventListener('unhandledrejection', e => document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;top:0;left:0;z-index:9999;background:red;color:white;">REJECTION: '+e.reason+'</div>'));
const oldError = console.error;
console.error = (...args) => {
    document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;top:50px;left:0;z-index:9999;background:orange;color:white;">CONSOLE.ERROR: '+args.join(' ')+'</div>');
    oldError(...args);
};
import { loadFont } from './geometry.ts';
import { initUIFromState, initEvents } from './ui.ts';
import { animate } from './scene.ts';

initUIFromState();
initEvents();
loadFont('sans');
animate();
