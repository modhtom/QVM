import { router } from './router.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded. Initializing router...');
  await router.init();
});