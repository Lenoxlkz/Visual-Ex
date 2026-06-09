import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { ConfigService } from './services/config.service';
import { WelcomeModalComponent } from './components/ui/welcome-modal.component';
import { NavComponent } from './components/ui/nav.component';

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
      </div>
    </div>
  `
})
export class App {
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


