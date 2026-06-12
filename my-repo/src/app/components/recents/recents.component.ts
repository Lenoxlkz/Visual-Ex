import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FileService, AppFile } from '../../services/file.service';
import { LangService } from '../../services/lang.service';
import { GlassCardComponent } from '../ui/glass-card.component';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-recents',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, GlassCardComponent],
  template: `
    <div class="px-1 sm:px-2 pb-24 max-w-[100rem] mx-auto w-full flex flex-col h-full min-h-screen space-y-4 sm:space-y-6 pt-12 select-none overflow-x-hidden">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row gap-4 sm:items-center justify-between w-full px-1 sm:px-4">
        <h1 class="text-2xl md:text-3xl font-display font-bold tracking-tight">{{ lang.t('Recents') }}</h1>
      </div>
      
      <p class="text-sm text-slate-500 py-1 px-1 sm:px-4">{{ lang.t('Recents Desc') }}</p>

      <!-- Grid View -->
      @if (files().length === 0) {
         <div class="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-4 mt-20">
            <mat-icon class="text-6xl opacity-50">history</mat-icon>
            <p class="font-medium text-lg text-center">{{ lang.t('Empty Recents') }}</p>
            <p class="text-sm text-center max-w-sm">{{ lang.t('Empty Recents Desc') }}</p>
         </div>
      } @else {
         <div [class]="'grid gap-[2px] px-[2px] w-full ' + (config.scale() === '60' || config.scale() === '70' ? 'grid-cols-4' : 'grid-cols-3')">
            @for (f of files(); track f.id) {
               <!-- Grid Item -->
               <app-glass-card 
                    [className]="'group relative cursor-pointer flex flex-col items-center justify-center p-2 sm:p-4 text-center hover:-translate-y-1 hover:shadow-2xl hover:border-blue-500/50 transition-all select-none w-full h-[14rem]'"
                    (clicked)="openItem(f)">
                  <mat-icon class="text-5xl mb-4" [class.text-amber-400]="f.type === 'folder'" [class.text-blue-400]="f.type === 'file' && f.mimeType?.includes('pdf')" [class.text-emerald-400]="f.type === 'file' && f.mimeType?.includes('image')" [class.text-purple-400]="f.type === 'file' && f.extension?.includes('cb')">
                     {{ getIcon(f) }}
                  </mat-icon>
                  <span class="text-sm font-medium line-clamp-2 w-full">{{ f.name }}</span>
                  @if (f.size) {
                     <span class="text-[10px] text-slate-500 dark:text-slate-400 mt-2">{{ formatSize(f.size) }}</span>
                  }
               </app-glass-card>
            }
         </div>
      }
      
    </div>
  `
})
export class RecentsComponent {
  fileService = inject(FileService);
  lang = inject(LangService);
  router = inject(Router);
  config = inject(ConfigService);
  
  files = signal<AppFile[]>([]);

  constructor() {
     effect(() => {
        this.fileService.filesChanged();
        this.loadFiles();
     });
  }

  async loadFiles() {
     const res = await this.fileService.getRecentFiles();
     this.files.set(res);
  }

  getIcon(f: AppFile) {
     if (f.type === 'folder') return 'folder';
     const ext = f.extension?.toLowerCase() || '';
     if (ext === 'pdf') return 'picture_as_pdf';
     if (ext === 'epub') return 'menu_book';
     if (['zip', 'rar', 'cbz', 'cbr'].includes(ext)) return 'collections_bookmark';
     if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
     if (['doc', 'docx'].includes(ext)) return 'description';
     return 'insert_drive_file';
  }

  formatSize(bytes: number) {
     if (bytes === 0) return '0 B';
     const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
     return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  openItem(f: AppFile) {
     this.fileService.updateLastOpened(f.id);
     if (f.type === 'folder') {
        this.router.navigate(['/folder', f.id]);
     } else {
        this.router.navigate(['/viewer', f.id]);
     }
  }
}
