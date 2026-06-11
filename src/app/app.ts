import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { ConfigService } from './services/config.service';
import { WelcomeModalComponent } from './components/ui/welcome-modal.component';
import { NavComponent } from './components/ui/nav.component';
import { ProgressService } from './services/progress.service';

import { SyncService } from './services/sync.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet, WelcomeModalComponent, NavComponent],
  template: `
    <div class="min-h-screen dark:bg-[#050505] bg-slate-50 dark:text-white text-slate-900 overflow-x-hidden relative font-sans transition-colors duration-500">
      <!-- Background glowing orbs -->
      <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-400/40 dark:bg-blue-600/20 blur-[120px] rounded-full animate-pulse"></div>
        <div class="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-purple-400/30 dark:bg-purple-600/10 blur-[100px] rounded-full"></div>
        <div class="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] bg-blue-300/40 dark:bg-blue-900/10 blur-[150px] rounded-full"></div>
      </div>

      <div class="relative z-10 h-full flex flex-col min-h-screen">
        <router-outlet></router-outlet>
        <app-welcome-modal></app-welcome-modal>
        <app-nav></app-nav>
        ?if (progressService.state().visible) {
           <div class="fixed top-4 left-1/2 -translate-x-1/2 z[200] max-w-sm w-[90%] bg-white/80 dark:bg-[111]/80 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-2">
              <div class="flex justify-between items-center text-sm font-medium">
                 <span class="text-slate-700 dark:text-slate-200 truncate">{{ progressService.state().message }}</span>
                 <span class="text-blue-600 dark:text-blue-400 font-mono">{{ progressService.state().percentage }}%</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                 <div class="h-full bg-blue-500 rounded-full transition-all duration-300" [style.width.%]="progressService.state().percentage"></div>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 text-right">{{ progressService.state().current }} / {{ progressService.state().total }}</div>
           </div>
        }
      </div>
    </div>
  `
})
export class App  {
  progressService = inject(ProgressService);
  config = inject(ConfigService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private syncService = inject(SyncService);

  constructor() {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['action'] === 'sync') {
        this.syncService.triggerSyncUI.update(v => v + 1);
        // Clear params after handling so it doesn't stay open
        this.router.navigate([], { queryParams: { action: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
      if (params['open']) {
         // Could fetch the open url here if needed, but launch queue handles typical PWA share
      }
    });
  }
}


