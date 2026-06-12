import { Component, inject, signal, effect } from '@angular/core';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ThemeService, Theme } from '../../services/theme.service';
import { LangService } from '../../services/lang.service';
import { ConfigService } from '../../services/config.service';
import { FileService } from '../../services/file.service';
import { ProgressService } from '../../services/progress.service';
import { SyncService } from '../../services/sync.service';
import { GoogleAuthService } from '../../services/google-auth.service';
import { GoogleDriveService } from '../../services/google-drive.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterModule, MatIconModule],
  template: `
    @if (!isViewerRoute()) {
    <nav class="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 pointer-events-none">
      <div class="relative mx-auto w-[90%] sm:max-w-sm pointer-events-auto nav-bar-wrapper">
        
        @if(syncService.needsPermission()) {
           <div class="absolute bottom-full mb-20 left-0 right-0 bg-rose-500 text-white backdrop-blur-xl border border-rose-400 rounded-3xl p-3 flex flex-col gap-2 origin-bottom transition-all duration-300 shadow-2xl z-[60]">
               <div class="flex items-start gap-2">
                   <mat-icon class="scale-90 flex-shrink-0">warning</mat-icon>
                   <span class="text-sm font-medium leading-tight">La sincronización periódica requiere permisos de lectura.</span>
               </div>
               <button (click)="syncService.requestSyncPermission()" class="mt-1 w-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold py-2 rounded-xl transition-colors text-center border-none cursor-pointer">
                   Conceder Permisos
               </button>
           </div>
        }

        <div class="absolute bottom-full mb-4 left-0 right-0 bg-white/90 dark:bg-black/80 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-3xl p-4 sm:p-5 flex flex-col gap-4 origin-bottom transition-all duration-300"
             [class.opacity-0]="!settingsOpen()"
             [class.pointer-events-none]="!settingsOpen()"
             [class.translate-y-4]="!settingsOpen()"
             [class.scale-95]="!settingsOpen()"
             [class.opacity-100]="settingsOpen()"
             [class.pointer-events-auto]="settingsOpen()"
             [class.translate-y-0]="settingsOpen()"
             [class.scale-100]="settingsOpen()"
             [class.shadow-2xl]="settingsOpen()">
            <!-- Theme Setting -->
            <div class="flex items-center justify-between">
               <div class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <div class="p-2 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                     <mat-icon class="scale-90">palette</mat-icon>
                  </div>
                  <span class="text-sm font-medium">{{ lang.t('Theme') }}</span>
               </div>
               <button (click)="cycleTheme()" class="flex items-center justify-center min-w-16 gap-1.5 px-3 py-2 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors text-slate-800 dark:text-slate-200">
                  <mat-icon class="scale-75 -mr-1">{{ themeIcon() }}</mat-icon>
                  <span class="text-xs font-medium">{{ themeText() }}</span>
               </button>
            </div>
            
            <!-- Scale Setting -->
            <div class="flex items-center justify-between">
               <div class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <div class="p-2 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                     <mat-icon class="scale-90">format_size</mat-icon>
                  </div>
                  <span class="text-sm font-medium">{{ lang.t('Scale') }}</span>
               </div>
               <button (click)="cycleScale()" class="flex items-center justify-center min-w-16 gap-1.5 px-3 py-2 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors text-slate-800 dark:text-slate-200">
                  <span class="text-xs font-medium">{{ config.scale() }}%</span>
               </button>
            </div>
            
            <!-- Next File Setting -->
            <div class="flex items-center justify-between">
               <div class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <div class="p-2 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                     <mat-icon class="scale-90">skip_next</mat-icon>
                  </div>
                  <span class="text-sm font-medium">{{ lang.t('Next File') }}</span>
               </div>
               <button (click)="config.cycleNextFileBehavior()" class="flex items-center justify-center min-w-16 gap-1.5 px-3 py-2 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors text-slate-800 dark:text-slate-200">
                  <span class="text-xs font-medium">{{ nextFileText() }}</span>
               </button>
            </div>

            <!-- Google Drive Setting -->
            <div class="flex flex-col border-t border-slate-100 dark:border-white/5 pt-4 mt-2 transition-all">
               <div class="flex items-center justify-between">
                   <div class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                      <div class="p-2 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                         <mat-icon class="scale-90 text-blue-500">cloud</mat-icon>
                      </div>
                      <div class="flex flex-col">
                         <span class="text-sm font-medium">Google Drive</span>
                         <span class="text-[10px] text-slate-500 dark:text-slate-400">
                            @if(authService.user()) {
                               {{ authService.user()?.email }}
                            } @else {
                               {{ lang.t('Drive Not Connected') }}
                            }
                         </span>
                      </div>
                   </div>
                   @if(authService.user()) {
                     <button (click)="authService.signOut()" class="flex items-center justify-center min-w-16 gap-1.5 px-3 py-2 rounded-full bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors text-red-600 dark:text-red-400">
                        <span class="text-xs font-medium">{{ lang.t('Drive Log Out') }}</span>
                     </button>
                   } @else {
                     <button (click)="authService.signIn()" [disabled]="authService.isLoggingIn()" class="flex items-center justify-center min-w-16 gap-1.5 px-3 py-2 rounded-full bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors text-blue-600 dark:text-blue-400 disabled:opacity-50">
                        @if(authService.isLoggingIn()) {
                          <mat-icon class="scale-75 animate-spin">refresh</mat-icon>
                        }
                        <span class="text-xs font-medium">{{ lang.t('Drive Connect') }}</span>
                     </button>
                   }
               </div>

               <!-- Drive Control Panel -->
               @if(authService.user()) {
                   <div class="w-full relative mt-2 flex flex-col items-center">
                       <!-- Toggle Button -->
                       <button (click)="drivePanelOpen.set(!drivePanelOpen())" 
                               class="w-16 h-4 mt-1 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                           <mat-icon class="text-[16px] w-[16px] h-[16px] flex items-center justify-center text-slate-500 dark:text-slate-400">
                               {{ drivePanelOpen() ? 'expand_more' : 'expand_less' }}
                           </mat-icon>
                       </button>

                       <div class="w-full overflow-hidden transition-all duration-300 ease-in-out" 
                            [class.max-h-0]="!drivePanelOpen()" 
                            [class.opacity-0]="!drivePanelOpen()" 
                            [class.max-h-64]="drivePanelOpen()" 
                            [class.opacity-100]="drivePanelOpen()">
                           <div class="p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl flex flex-col gap-3 mt-1">
                               <!-- Import Toggle -->
                               <div class="flex items-center justify-between">
                                   <div class="flex flex-col">
                                      <span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                          <mat-icon class="scale-75 text-emerald-500">download</mat-icon> {{ lang.t('Drive Import') }}
                                      </span>
                                      <span class="text-[10px] text-slate-500 dark:text-slate-400">{{ lang.t('Drive Import Desc') }}</span>
                                      @if(importProgress()) {
                                          <span class="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">{{ importProgress() }}</span>
                                      }
                                   </div>
                                   <button (click)="toggleImport()" [class.bg-emerald-500]="driveImporting()" [class.bg-slate-300]="!driveImporting()" [class.dark:bg-white/20]="!driveImporting()" class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out">
                                      <span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" [class.translate-x-4]="driveImporting()" [class.translate-x-0]="!driveImporting()"></span>
                                   </button>
                               </div>
                               <div class="w-full h-px bg-slate-200 dark:bg-white/10"></div>
                               <!-- Export Toggle -->
                               <div class="flex items-center justify-between">
                                   <div class="flex flex-col">
                                      <span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                          <mat-icon class="scale-75 text-amber-500">upload</mat-icon> {{ lang.t('Drive Export') }}
                                      </span>
                                      <span class="text-[10px] text-slate-500 dark:text-slate-400">{{ lang.t('Drive Export Desc') }}</span>
                                      @if(exportProgress()) {
                                          <span class="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">{{ exportProgress() }}</span>
                                      }
                                   </div>
                                   <button (click)="toggleExport()" [class.bg-amber-500]="driveExporting()" [class.bg-slate-300]="!driveExporting()" [class.dark:bg-white/20]="!driveExporting()" class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out">
                                      <span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" [class.translate-x-4]="driveExporting()" [class.translate-x-0]="!driveExporting()"></span>
                                   </button>
                               </div>
                           </div>
                       </div>
                   </div>
               }
            </div>

            <!-- Sync Setting -->
            <div class="flex items-center justify-between">
               <div class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <div class="p-2 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-blue-500">
                     <mat-icon class="scale-90 animate-spin" style="animation-duration: 4s;">sync</mat-icon>
                  </div>
                  <span class="text-sm font-medium">{{ lang.t('Sync') }}</span>
               </div>
               <button (click)="syncModalOpen.set(true); settingsOpen.set(false)" class="flex items-center justify-center min-w-16 gap-1.5 px-3 py-2 rounded-full bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors text-blue-600 dark:text-blue-400">
                  <span class="text-xs font-medium">{{ lang.t('Open') }}</span>
               </button>
            </div>
          </div>

        <div class="bg-white/70 dark:bg-black/30 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-full shadow-2xl flex justify-around items-center p-2">
          <a routerLink="/recents"
             routerLinkActive="bg-white dark:bg-white/10 text-slate-900 dark:text-white scale-110 shadow-md dark:shadow-none"
             (click)="settingsOpen.set(false)"
             class="flex flex-col items-center justify-center w-14 sm:w-16 h-12 rounded-full transition-all duration-300 text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5">
            <mat-icon [class.scale-90]="true">history</mat-icon>
            <span class="text-[9px] sm:text-[10px] mt-0.5 font-medium">{{ lang.t('Recents') }}</span>
          </a>

          <a routerLink="/"
             routerLinkActive="bg-white dark:bg-white/10 text-slate-900 dark:text-white scale-110 shadow-md dark:shadow-none"
             [routerLinkActiveOptions]="{exact: true}"
             (click)="settingsOpen.set(false)"
             class="flex flex-col items-center justify-center w-14 sm:w-16 h-12 rounded-full transition-all duration-300 text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5">
            <mat-icon [class.scale-90]="true">home</mat-icon>
            <span class="text-[9px] sm:text-[10px] mt-0.5 font-medium">{{ lang.t('Home') }}</span>
          </a>

          <button (click)="reportModalOpen.set(true); settingsOpen.set(false)"
             class="flex flex-col items-center justify-center w-14 sm:w-16 h-12 rounded-full transition-all duration-300 text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5">
            <mat-icon [class.scale-90]="true">bug_report</mat-icon>
            <span class="text-[9px] sm:text-[10px] mt-0.5 font-medium">{{ lang.t('Report') }}</span>
          </button>
          
          <button (click)="settingsOpen.set(!settingsOpen())"
             [class.bg-white]="settingsOpen()" [class.dark:bg-white/10]="settingsOpen()"
             [class.text-slate-900]="settingsOpen()" [class.dark:text-white]="settingsOpen()"
             [class.shadow-md]="settingsOpen()" [class.dark:shadow-none]="settingsOpen()"
             [class.scale-110]="settingsOpen()"
             class="flex flex-col items-center justify-center w-14 sm:w-16 h-12 rounded-full transition-all duration-300 ease-out text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5">
            <div class="relative w-6 h-6 flex items-center justify-center overflow-visible">
              <mat-icon [class.rotate-180]="settingsOpen()" [class.scale-110]="settingsOpen()" class="transition-all duration-300 ease-out transform scale-90 origin-center absolute">settings</mat-icon>
            </div>
            <span class="text-[9px] sm:text-[10px] mt-0.5 font-medium">{{ lang.t('Settings') }}</span>
          </button>
          
          <a href="https://privacy-policy-page-vexreaders.vercel.app" target="_blank" referrerpolicy="no-referrer"
             class="flex flex-col items-center justify-center w-14 sm:w-16 h-12 rounded-full transition-all duration-300 text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5">
            <mat-icon [class.scale-90]="true">help_outline</mat-icon>
            <span class="text-[9px] sm:text-[10px] mt-0.5 font-medium">Legal</span>
          </a>
        </div>
      </div>
    </nav>
    }

    <!-- Report Problem Modal -->
    @if (reportModalOpen()) {
        <div class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity pointer-events-auto" (click)="reportModalOpen.set(false)">
            <div class="bg-white dark:bg-[#111] p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-md w-full flex flex-col items-center text-center gap-6 relative" (click)="$event.stopPropagation()">
                <button (click)="reportModalOpen.set(false)" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center">
                    <mat-icon>close</mat-icon>
                </button>
                <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
                    <svg class="w-8 h-8 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor">
                        <!-- WhatsApp SVG -->
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                    </svg>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">{{ lang.t('Report Problem') }}</h3>
                    <p class="text-sm text-slate-600 dark:text-slate-400">{{ lang.t('Report Problem Desc') }}</p>
                </div>
                
                <a href="https://walink.co/v5dhyx" target="_blank" referrerpolicy="no-referrer" class="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white transition-colors shadow-lg hover:shadow-green-500/30 text-[15px] font-medium flex items-center justify-center gap-3">
                    <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                </a>
            </div>
        </div>
    }

    <!-- Sync Settings Modal -->
    @if (syncModalOpen()) {
        <div class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity pointer-events-auto" (click)="syncModalOpen.set(false)">
            <div class="bg-white dark:bg-[#111] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-lg w-full flex flex-col gap-6 relative" (click)="$event.stopPropagation()">
                <button (click)="syncModalOpen.set(false)" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center">
                    <mat-icon>close</mat-icon>
                </button>
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400"
                        [class.animate-pulse]="syncService.isLoading()">
                        <mat-icon class="animate-spin" style="animation-duration: 3s;">sync</mat-icon>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-slate-900 dark:text-white">{{ lang.t('Sync') }}</h3>
                        <p class="text-sm text-slate-600 dark:text-slate-400">{{ lang.t('Sync Desc') }}</p>
                    </div>
                </div>

                <div class="space-y-6 flex-1 overflow-y-auto max-h-[60vh] pr-2">
                    <!-- Individual Sync -->
                    <div class="p-4 rounded-2xl border transition-all"
                         [class.opacity-50]="syncService.totalIntervalIndex() > 0"
                         [class.pointer-events-none]="syncService.totalIntervalIndex() > 0"
                         [class.bg-slate-50]="syncService.totalIntervalIndex() === 0"
                         [class.dark:bg-white/5]="syncService.totalIntervalIndex() === 0"
                         [class.border-slate-100]="syncService.totalIntervalIndex() === 0"
                         [class.dark:border-white/10]="syncService.totalIntervalIndex() === 0">
                       <h4 class="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
                          <mat-icon class="scale-75 text-blue-500">folder_open</mat-icon>
                          {{ lang.t('Sync Individual') }}
                       </h4>
                       <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">{{ lang.t('Sync Individual Desc') }}</p>
                       
                       <div class="flex flex-col gap-3">
                           <button (click)="syncService.startIndividualSync()" [disabled]="syncService.totalIntervalIndex() > 0 || syncService.isLoading()" class="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-[#222] border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors text-sm font-medium disabled:opacity-50">
                               @if(syncService.isLoading() && syncService.totalIntervalIndex() === 0) {
                                 <mat-icon class="scale-90 animate-spin">refresh</mat-icon>
                               } @else {
                                 <mat-icon class="scale-90">folder_shared</mat-icon>
                               }
                               {{ lang.t('Sync Now') }}
                           </button>
                           
                           <div class="flex items-center justify-between mt-2">
                               <span class="text-xs font-medium text-slate-600 dark:text-slate-400">{{ lang.t('Sync Periodic') }}:</span>
                               <button (click)="syncService.cycleIndividualInterval()" [disabled]="syncService.totalIntervalIndex() > 0" class="text-xs font-medium bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-white/20 transition-colors disabled:opacity-50">
                                   {{ individualIntervalText() }}
                               </button>
                           </div>
                       </div>
                    </div>

                    <!-- Total Sync -->
                    <div class="p-4 rounded-2xl border transition-all"
                         [class.opacity-50]="syncService.individualIntervalIndex() > 0"
                         [class.pointer-events-none]="syncService.individualIntervalIndex() > 0"
                         [class.bg-slate-50]="syncService.individualIntervalIndex() === 0"
                         [class.dark:bg-white/5]="syncService.individualIntervalIndex() === 0"
                         [class.border-slate-100]="syncService.individualIntervalIndex() === 0"
                         [class.dark:border-white/10]="syncService.individualIntervalIndex() === 0">
                       <h4 class="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
                          <mat-icon class="scale-75 text-purple-500">storage</mat-icon>
                          {{ lang.t('Sync Total') }}
                       </h4>
                       <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">{{ lang.t('Sync Total Desc') }}</p>
                       
                       <div class="flex flex-col gap-3">
                           <button (click)="syncService.startTotalSync()" [disabled]="syncService.individualIntervalIndex() > 0 || syncService.isLoading()" class="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-[#222] border border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors text-sm font-medium disabled:opacity-50">
                               @if(syncService.isLoading() && syncService.individualIntervalIndex() === 0) {
                                 <mat-icon class="scale-90 animate-spin">refresh</mat-icon>
                               } @else {
                                 <mat-icon class="scale-90">published_with_changes</mat-icon>
                               }
                               {{ lang.t('Sync Now') }}
                           </button>
                           
                           <div class="flex items-center justify-between mt-2">
                               <span class="text-xs font-medium text-slate-600 dark:text-slate-400">{{ lang.t('Sync Periodic') }}:</span>
                               <button (click)="syncService.cycleTotalInterval()" [disabled]="syncService.individualIntervalIndex() > 0" class="text-xs font-medium bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-white/20 transition-colors disabled:opacity-50">
                                   {{ totalIntervalText() }}
                               </button>
                           </div>
                       </div>
                    </div>
                </div>
            </div>
        </div>
    }
  `
})
export class NavComponent {
  themeService = inject(ThemeService);
  lang = inject(LangService);
  config = inject(ConfigService);
  syncService = inject(SyncService);
  authService = inject(GoogleAuthService);
  driveService = inject(GoogleDriveService);
  fileService = inject(FileService);
  progressService = inject(ProgressService);
  router = inject(Router);
  settingsOpen = signal(false);
  reportModalOpen = signal(false);
  syncModalOpen = signal(false);

  drivePanelOpen = signal(false);
  driveImporting = signal(false);
  driveExporting = signal(false);
  importProgress = signal('');
  exportProgress = signal('');

  constructor() {
    effect(() => {
       if (this.syncService.triggerSyncUI() > 0) {
          this.syncModalOpen.set(true);
       }
    });
  }

  isViewerRoute = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url.includes('/viewer/'))
    ),
    { initialValue: this.router.url.includes('/viewer/') }
  );

  individualIntervalText() {
    if (this.syncService.totalIntervalIndex() > 0) return this.lang.t('Not Allowed');
    
    const val = this.syncService.syncIntervals[this.syncService.individualIntervalIndex()];
    if (val === 'off') return this.lang.t('Sync Off');
    return this.lang.t(`Sync Interval ${val}`);
  }

  totalIntervalText() {
    if (this.syncService.individualIntervalIndex() > 0) return this.lang.t('Not Allowed');
    
    const val = this.syncService.syncIntervals[this.syncService.totalIntervalIndex()];
    if (val === 'off') return this.lang.t('Sync Off');
    return this.lang.t(`Sync Interval ${val}`);
  }

  themeIcon() {
    const t = this.themeService.currentTheme();
    if (t === 'light') return 'light_mode';
    if (t === 'dark') return 'dark_mode';
    return 'brightness_auto';
  }

  themeText() {
    const t = this.themeService.currentTheme();
    if (t === 'light') return this.lang.t('Theme Light');
    if (t === 'dark') return this.lang.t('Theme Dark');
    return this.lang.t('Theme Auto');
  }

  nextFileText() {
    const b = this.config.nextFileBehavior();
    if (b === 'suggest') return this.lang.t('Next File Suggest');
    if (b === 'auto') return this.lang.t('Next File Auto');
    return this.lang.t('Next File Off');
  }

  cycleTheme() {
    const t = this.themeService.currentTheme();
    if (t === 'system') this.themeService.setTheme('light');
    else if (t === 'light') this.themeService.setTheme('dark');
    else this.themeService.setTheme('system');
  }

  cycleScale() {
     this.config.cycleScale();
  }

  async toggleExport() {
    if (this.driveExporting()) {
       this.driveExporting.set(false);
       this.exportProgress.set(this.lang.t('Drive Canceled'));
       setTimeout(() => { if(this.exportProgress() === this.lang.t('Drive Canceled')) this.exportProgress.set(''); }, 3000);
       return;
    }
    this.driveExporting.set(true);
    this.exportProgress.set(this.lang.t('Drive Preparing'));
    
    try {
       const folderId = await this.driveService.getOrCreateBackupFolder();
       const files = await this.fileService.getFilesByParent('root');
       const allFiles: any[] = [];
       const gatherFiles = async (parentId: string, path: string) => {
          const children = await this.fileService.getFilesByParent(parentId);
          for (const c of children) {
             if (c.type === 'folder' && c.name === 'Google Drive Import') continue;
             if (c.type === 'file') allFiles.push({ ...c, path: path + c.name });
             else if (c.type === 'folder') await gatherFiles(c.id, path + c.name + '/');
          }
       };
       await gatherFiles('root', '');
       
       let count = 0;
       const total = allFiles.length;
       const concurrencyLimit = 15; // Lotes de Peticiones y Paralelismo aumentado a 15
       let currentIndex = 0;

       const exportWorker = async () => {
          while (currentIndex < total && this.driveExporting()) {
             const index = currentIndex++;
             const f = allFiles[index];
             const blob = await this.fileService.getFileContent(f.id);
             if (blob && this.driveExporting()) {
                 await this.driveService.uploadFile(blob, f.path || f.name, folderId);
             }
             count++;
             this.exportProgress.set(`${this.lang.t('Drive Uploading')} ${count}/${total}...`);
          }
       };

       const workers = Array.from({ length: Math.min(concurrencyLimit, total) }, () => exportWorker());
       await Promise.all(workers);
       if (this.driveExporting()) {
          this.exportProgress.set(this.lang.t('Drive Completed'));
          setTimeout(() => { if(this.exportProgress() === this.lang.t('Drive Completed')) this.exportProgress.set(''); }, 3000);
       }
    } catch (e) {
       console.error(e);
       this.exportProgress.set(this.lang.t('Drive Failed Export'));
       setTimeout(() => { if(this.exportProgress() === this.lang.t('Drive Failed Export')) this.exportProgress.set(''); }, 3000);
    } finally {
       this.driveExporting.set(false);
    }
  }

  async toggleImport() {
    if (this.driveImporting()) {
       this.driveImporting.set(false);
       this.importProgress.set(this.lang.t('Drive Canceled'));
       setTimeout(() => { if(this.importProgress() === this.lang.t('Drive Canceled')) this.importProgress.set(''); }, 3000);
       return;
    }
    this.driveImporting.set(true);
    this.importProgress.set(this.lang.t('Drive Searching'));
    
    try {
       const driveFiles = await this.driveService.listFiles();
       const supportedTypes = ['pdf', 'epub', 'docx', 'doc', 'cbr', 'cbz', 'zip', 'rar', 'jpg', 'jpeg', 'png', 'webp'];
       const toImport = driveFiles.filter(f => supportedTypes.some(ext => f.name.toLowerCase().endsWith('.' + ext)));
       
       if (toImport.length === 0) {
           this.importProgress.set(this.lang.t('Drive No Compatible'));
           this.driveImporting.set(false);
           setTimeout(() => { if(this.importProgress() === this.lang.t('Drive No Compatible')) this.importProgress.set(''); }, 3000);
           return;
       }

       const rootFiles = await this.fileService.getFilesByParent('root');
       let gdFolder = rootFiles.find(f => f.type === 'folder' && f.name === 'Google Drive Import');
       let gdFolderId = gdFolder?.id;
       if (!gdFolderId) gdFolderId = await this.fileService.createFolder('Google Drive Import', 'root');
       
       let count = 0;
       const total = toImport.length;
       const concurrencyLimit = 15; // Lotes de Peticiones y Paralelismo aumentado a 15
       let currentIndex = 0;

       const existing = await this.fileService.getFilesByParent(gdFolderId!);
       const existingNames = new Set(existing.map(e => e.name));

       const importWorker = async () => {
          while (currentIndex < total && this.driveImporting()) {
             const index = currentIndex++;
             const f = toImport[index];
             
             if (!existingNames.has(f.name)) {
                 const blob = await this.driveService.downloadFile(f.id);
                 if (this.driveImporting()) {
                     await this.fileService.storeFile(new File([blob], f.name, { type: f.mimeType }), gdFolderId!);
                     existingNames.add(f.name);
                 }
             }
             count++;
             this.importProgress.set(`${this.lang.t('Drive Importing')} ${count}/${total}...`);
          }
       };

       const workers = Array.from({ length: Math.min(concurrencyLimit, total) }, () => importWorker());
       await Promise.all(workers);
       if (this.driveImporting()) {
           this.importProgress.set(this.lang.t('Drive Completed'));
           setTimeout(() => { if(this.importProgress() === this.lang.t('Drive Completed')) this.importProgress.set(''); }, 3000);
       }
    } catch (e) {
       console.error(e);
       this.importProgress.set(this.lang.t('Drive Failed Import'));
       setTimeout(() => { if(this.importProgress() === this.lang.t('Drive Failed Import')) this.importProgress.set(''); }, 3000);
    } finally {
       this.driveImporting.set(false);
    }
  }


}
