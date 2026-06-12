import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type UiScale = '60' | '70' | '80' | '90' | '100';
export type NextFileStrategy = 'suggest' | 'auto' | 'off';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private platformId = inject(PLATFORM_ID);
  
  scale = signal<UiScale>('60');
  nextFileBehavior = signal<NextFileStrategy>('suggest');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedScale = localStorage.getItem('uiScale') as UiScale;
      if (savedScale && ['60', '70', '80', '90', '100'].includes(savedScale)) {
        this.scale.set(savedScale);
      }
      
      const savedNextFile = localStorage.getItem('nextFileBehavior') as NextFileStrategy;
      if (savedNextFile && ['suggest', 'auto', 'off'].includes(savedNextFile)) {
        this.nextFileBehavior.set(savedNextFile);
      }

      effect(() => {
        const currentScale = this.scale();
        localStorage.setItem('uiScale', currentScale);
        
        const currentNext = this.nextFileBehavior();
        localStorage.setItem('nextFileBehavior', currentNext);
        
        this.applyScale();
      });

      window.addEventListener('resize', () => {
         this.applyScale();
      });
    }
  }

  cycleScale() {
     const current = this.scale();
     if (current === '60') this.scale.set('70');
     else if (current === '70') this.scale.set('80');
     else if (current === '80') this.scale.set('90');
     else if (current === '90') this.scale.set('100');
     else this.scale.set('60');
  }

  cycleNextFileBehavior() {
     const current = this.nextFileBehavior();
     if (current === 'suggest') this.nextFileBehavior.set('auto');
     else if (current === 'auto') this.nextFileBehavior.set('off');
     else this.nextFileBehavior.set('suggest');
  }

  private applyScale() {
     if (!isPlatformBrowser(this.platformId)) return;
     
     const baseWidth = 390;
     const winWidth = window.innerWidth;
     // auto scale between 95% and 115% based on screen size ratio to 390px
     const autoScale = Math.min(1.15, Math.max(0.95, winWidth / baseWidth));
     
     let userMultiplier = 0.6;
     switch(this.scale()) {
         case '60': userMultiplier = 0.60; break;
         case '70': userMultiplier = 0.70; break;
         case '80': userMultiplier = 0.80; break;
         case '90': userMultiplier = 0.90; break;
         case '100': userMultiplier = 1.0; break;
     }
     
     const finalScale = autoScale * userMultiplier;
     
     // Update root scaling factors
     document.documentElement.style.setProperty('--ui-scale', finalScale.toString());
     document.documentElement.style.fontSize = `calc(16px * ${finalScale})`;
  }
}
