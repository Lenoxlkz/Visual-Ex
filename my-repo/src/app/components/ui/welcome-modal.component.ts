import { Component, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { LangService } from '../../services/lang.service';
import { MatIconModule } from '@angular/material/icon';
import { GlassCardComponent } from './glass-card.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-welcome-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, GlassCardComponent, FormsModule],
  template: `
    @if(isVisible()) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
         <app-glass-card [className]="'max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden'">
            <div class="p-6 sm:p-8 flex flex-col gap-6 overflow-y-auto">
               <div class="flex items-center justify-center shrink-0">
                  <mat-icon class="text-6xl text-blue-500 animate-bounce">menu_book</mat-icon>
               </div>
               
               <div class="text-center space-y-2 shrink-0">
                  <h2 class="text-2xl font-bold font-display">{{ lang.t('Welcome Title') }}</h2>
                  <p class="text-slate-500 dark:text-slate-400 text-sm">{{ lang.t('Welcome Desc') }}</p>
               </div>
   
               <div class="space-y-4 shrink-0">
                  <div class="flex items-start gap-3 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-200">
                     <div class="text-2xl shrink-0">📚</div>
                     <p class="text-[13px] sm:text-sm mt-0.5" [innerHTML]="lang.t('Welcome Feature 1')"></p>
                  </div>
                  <div class="flex items-start gap-3 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-200">
                     <div class="text-2xl shrink-0">🔄</div>
                     <p class="text-[13px] sm:text-sm mt-0.5" [innerHTML]="lang.t('Welcome Feature 2')"></p>
                  </div>
                  <div class="flex items-start gap-3 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-200">
                     <div class="text-2xl shrink-0">📖</div>
                     <p class="text-[13px] sm:text-sm mt-0.5" [innerHTML]="lang.t('Welcome Feature 3')"></p>
                  </div>
                  <div class="flex items-start gap-3 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-200">
                     <div class="text-2xl shrink-0">📁</div>
                     <p class="text-[13px] sm:text-sm mt-0.5" [innerHTML]="lang.t('Welcome Feature 4')"></p>
                  </div>
                  <div class="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400/90 leading-relaxed bg-amber-50 dark:bg-amber-500/10 p-2 sm:p-3 rounded-lg border border-amber-200/50 dark:border-amber-500/20" [innerHTML]="lang.t('Welcome Attention')">
                  </div>
               </div>
   
               <div class="flex flex-col gap-4 mt-auto pt-2 shrink-0">
                  <div class="flex items-center gap-2 cursor-pointer select-none" (click)="toggleDontShow()">
                     <div class="w-5 h-5 rounded flex items-center justify-center border transition-colors"
                          [class.bg-blue-600]="dontShowAgain" [class.border-blue-600]="dontShowAgain"
                          [class.bg-white]="!dontShowAgain" [class.dark:bg-white/10]="!dontShowAgain" [class.border-slate-300]="!dontShowAgain" [class.dark:border-white/20]="!dontShowAgain">
                        @if (dontShowAgain) {
                           <mat-icon class="text-white scale-75">check</mat-icon>
                        }
                     </div>
                     <span class="text-sm text-slate-600 dark:text-slate-400 select-none">{{ lang.t('Dont Show Again') }}</span>
                  </div>
      
                  <button (click)="close()" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all hover:scale-[1.02] active:scale-95 shadow-lg hover:shadow-blue-600/30">
                     {{ lang.t('Continue') }}
                  </button>
               </div>
            </div>
         </app-glass-card>
      </div>
    }
  `
})
export class WelcomeModalComponent {
   lang = inject(LangService);
   platformId = inject(PLATFORM_ID);
   
   isVisible = signal(false);
   dontShowAgain: boolean = false;

   constructor() {
      if (isPlatformBrowser(this.platformId)) {
         setTimeout(() => {
            const hide = localStorage.getItem('hideWelcome');
            if (hide !== 'true') {
               this.isVisible.set(true);
            }
         }, 100);
      }
   }

   toggleDontShow() {
      this.dontShowAgain = !this.dontShowAgain;
   }

   close() {
      if (this.dontShowAgain) {
         localStorage.setItem('hideWelcome', 'true');
      }
      this.isVisible.set(false);
   }
}
