/**
 * P.I.X.I. Theme Engine
 */

class ThemeEngine {
    constructor() {
        this.root = document.documentElement;
        this.init();
    }

    init() {
        const savedTheme = localStorage.getItem('pixi-theme');
        if (savedTheme === 'dark') {
            this.setDarkMode(true);
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('pixi-theme')) {
                this.setDarkMode(e.matches);
            }
        });
    }

    toggle() {
        const isDark = document.body.classList.contains('dark');
        this.setDarkMode(!isDark);
    }

    setDarkMode(enabled) {
        document.body.classList.toggle('dark', enabled);
        localStorage.setItem('pixi-theme', enabled ? 'dark' : 'light');
        this.updateIcon(enabled);

        // Update meta theme color
        const themeColor = enabled ? '#141218' : '#FEF7FF';
        document.querySelector('meta[name="theme-color"]').setAttribute('content', themeColor);
    }

    updateIcon(isDark) {
        const icon = document.getElementById('themeIcon');
        if (!icon) return;

        icon.innerHTML = isDark
            ? `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
            : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    }
}

const themeEngine = new ThemeEngine();
window.themeEngine = themeEngine;
