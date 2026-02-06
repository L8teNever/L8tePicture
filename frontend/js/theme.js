/**
 * P.I.X.I. Theme Engine
 * Dynamic Material You Color Generation
 */

class ThemeEngine {
    constructor() {
        this.root = document.documentElement;
        this.currentPalette = null;
    }

    /**
     * Extract dominant color from an image and apply as theme
     * @param {HTMLImageElement} img 
     */
    async applyThemeFromImage(img) {
        try {
            const dominantColor = await this.getDominantColor(img);
            const palette = this.generatePalette(dominantColor);
            this.applyPalette(palette);
        } catch (error) {
            console.error('Theme generation failed:', error);
        }
    }

    /**
     * Get dominant color using a canvas
     */
    async getDominantColor(img) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 50; // Small size for performance
            canvas.height = 50;

            context.drawImage(img, 0, 0, 50, 50);
            const data = context.getImageData(0, 0, 50, 50).data;

            let r = 0, g = 0, b = 0, count = 0;

            for (let i = 0; i < data.length; i += 4) {
                // Ignore very dark or very light pixels
                const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                if (brightness > 30 && brightness < 220) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }
            }

            if (count === 0) return { r: 103, g: 80, b: 164 }; // Default Material Purple

            resolve({
                r: Math.floor(r / count),
                g: Math.floor(g / count),
                b: Math.floor(b / count)
            });
        });
    }

    /**
     * Generate MD3 Palette based on an RGB color
     */
    generatePalette(rgb) {
        const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);

        // Ensure some saturation
        const s = Math.max(hsv.s, 0.3);
        const v = hsv.v;

        return {
            primary: this.hsvToRgb(hsv.h, s, v * 0.8),
            onPrimary: { r: 255, g: 255, b: 255 },
            primaryContainer: this.hsvToRgb(hsv.h, s * 0.4, v * 0.9),
            onPrimaryContainer: this.hsvToRgb(hsv.h, s, v * 0.3),
            surface: { r: 28, g: 27, b: 31 }, // Keep surfaces dark for gallery
            onSurface: { r: 230, g: 225, b: 229 },
            outline: this.hsvToRgb(hsv.h, s * 0.2, 0.6)
        };
    }

    /**
     * Apply palette to CSS variables
     */
    applyPalette(palette) {
        const toRGBStr = (color) => `${color.r}, ${color.g}, ${color.b}`;
        const toHex = (color) => {
            const f = (n) => n.toString(16).padStart(2, '0');
            return `#${f(color.r)}${f(color.g)}${f(color.b)}`;
        };

        this.root.style.setProperty('--md-sys-color-primary', toHex(palette.primary));
        this.root.style.setProperty('--md-sys-color-on-primary', toHex(palette.onPrimary));
        this.root.style.setProperty('--md-sys-color-primary-container', toHex(palette.primaryContainer));
        this.root.style.setProperty('--md-sys-color-on-primary-container', toHex(palette.onPrimaryContainer));

        // Update meta theme color
        document.querySelector('meta[name="theme-color"]').setAttribute('content', toHex(palette.primary));
    }

    // Helper functions
    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h, s, v };
    }

    hsvToRgb(h, s, v) {
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return { r: Math.floor(r * 255), g: Math.floor(g * 255), b: Math.floor(b * 255) };
    }
}

window.themeEngine = new ThemeEngine();
