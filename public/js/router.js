import { initMain } from './main.js';
import { initGlobals } from './globals.js';
import { isLoggedIn } from './auth.js';

const routes = {
  '/': { component: 'mainMenu', title: 'QVM - Home' },
  '/auth': { component: 'authPage', title: 'QVM - Login' },
  '/full-options': { component: 'fullOptions', title: 'QVM - Full Surah' },
  '/part-options': { component: 'partOptions', title: 'QVM - Part Surah' },
  '/full-form': { component: 'fullForm', title: 'QVM - Create Full Video' },
  '/part-form': { component: 'partForm', title: 'QVM - Create Part Video' },
  '/full-custom': { component: 'fullFormCustom', title: 'QVM - Custom Full' },
  '/part-custom': { component: 'partFormCustom', title: 'QVM - Custom Part' },
  '/sync': { component: 'tapToSyncPage', title: 'QVM - Sync Audio' },
  '/preview': { component: 'videoPreview', title: 'QVM - Preview' },
  '/gallery': { component: 'gallery', title: 'QVM - Gallery' },
  '/feedback': { component: 'feedbackPage', title: 'QVM - Feedback' },
};

const layoutComponents = ['shareModal', 'imagePickerOverlay', 'toastNotification'];

class Router {
  constructor() {
    this.appRoot = document.getElementById('app-root');
    this.layoutRoot = document.getElementById('layout-root');
    this.cache = {};
    
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  async loadHtml(id) {
    if (this.cache[id]) return this.cache[id];
    const res = await fetch(`/components/${id}.html`);
    const html = await res.text();
    this.cache[id] = html;
    return html;
  }

  async init() {
    let layoutsHtml = '';
    for (const id of layoutComponents) {
      layoutsHtml += await this.loadHtml(id);
    }
    if (this.layoutRoot) this.layoutRoot.innerHTML = layoutsHtml;

    initGlobals();

    await this.handleRoute();
  }

  async handleRoute() {
    let path = window.location.hash.slice(1);
    if (path && !path.startsWith('/'))
      path = '/' + path;

    if (!path || !routes[path])
      path = '/';
    
    const loggedIn = isLoggedIn();
    if (!loggedIn && path !== '/auth') {
      this.navigate('/auth');
      return;
    }
    if (loggedIn && path === '/auth') {
      this.navigate('/');
      return;
    }
    
    const route = routes[path];
    document.title = route.title;
    const html = await this.loadHtml(route.component);
    if (this.appRoot) {
      this.appRoot.style.opacity = '0';
      
      setTimeout(() => {
        this.appRoot.innerHTML = html;
        this.appRoot.className = `page-container ${route.component}-layout`;
        
        const pageEl = this.appRoot.querySelector('.page');
        if (pageEl) {
            pageEl.classList.add('active');
            pageEl.style.display = 'block';
        }

        initMain();
        
        this.appRoot.style.opacity = '1';
        
        if (route.component === 'gallery' && typeof window.loadVideos === 'function') {
          window.loadVideos();
        }

        if (route.component === 'videoPreview') {
          const vidPath = sessionStorage.getItem('latestVidPath');
          const videoElement = document.getElementById("previewVideo");
          if (vidPath && videoElement) {
            videoElement.src = `/videos/${vidPath}`;
            videoElement.setAttribute('data-filename', vidPath);
          }
        }
        
        if (typeof window.handlePageTour === 'function') {
          window.handlePageTour(route.component);
        }
      }, 150);
    }
  }

  navigate(path) {
    window.location.hash = path;
  }
}

export const router = new Router();