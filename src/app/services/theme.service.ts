import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  currentTheme = signal<Theme>('system');

  constructor() {
    this.initTheme();
  }

  initTheme() {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved) {
      this.currentTheme.set(saved);
      this.applyTheme(saved);
    } else {
      this.applyTheme('system');
    }

    // Listen for system changes if system is selected
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.currentTheme() === 'system') {
        this.applyTheme('system');
      }
    });
  }

  setTheme(theme: Theme) {
    this.currentTheme.set(theme);
    localStorage.setItem('theme', theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: Theme) {
    const root = window.document.documentElement;
    let isDark = false;

    if (theme === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = theme === 'dark';
    }

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}
