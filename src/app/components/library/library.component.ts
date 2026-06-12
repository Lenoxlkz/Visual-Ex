import { ProgressService } from '../../services/progress.service';
import { Component, inject, computed, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FileService, AppFile } from '../../services/file.service';
import { LangService } from '../../services/lang.service';
import { GlassCardComponent } from '../ui/glass-card.component';
import { NavComponent } from '../ui/nav.component';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, GlassCardComponent, FormsModule],
  template: `
    <div class="px-1 sm:px-2 pb-24 max-w-[100rem] mx-auto w-full flex flex-col h-full min-h-screen space-y-4 sm:space-y-6 pt-12 select-none overflow-x-hidden">
      <!-- Header -->
      <div class="flex flex-row items-center justify-between w-full px-1 sm:px-4">
        <div class="flex items-center gap-2">
           <h1 class="font-display font-bold tracking-tight title-dynamic">{{ lang.t('Library') }}</h1>
           <mat-icon class="text-2xl md:text-3xl text-blue-500 animate-bounce">menu_book</mat-icon>
        </div>
        
        <div class="flex items-center gap-1.5 sm:gap-2 justify-end">
           <!-- Total Files Indicator -->
           <div class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full text-slate-600 dark:text-slate-300 transition-all hover:scale-105 active:scale-95 group shadow-sm cursor-default btn-main" [title]="lang.t('Total Files') || 'Archivos Totales'">
              <mat-icon class="text-[18px] w-[18px] h-[18px] group-hover:animate-pulse text-blue-500">description</mat-icon>
              <span class="text-xs sm:text-sm font-medium">{{ totalFilesCount() }}</span>
           </div>
           
           <!-- Total Size Indicator -->
           <div class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full text-slate-600 dark:text-slate-300 transition-all hover:scale-105 active:scale-95 group shadow-sm cursor-default btn-main" [title]="lang.t('Total Size')">
              <mat-icon class="text-[18px] w-[18px] h-[18px] group-hover:animate-pulse text-emerald-500">sd_storage</mat-icon>
              <span class="text-xs sm:text-sm font-medium">{{ formatSize(totalSize()) }}</span>
           </div>

           <!-- Refresh (Delete All) Button -->
           <button (click)="clearAll()" class="p-2 transition-all hover:text-blue-500 active:animate-spin hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full group text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 shadow-sm btn-icon-circle" [title]="lang.t('Clear All')">
              <mat-icon>ac_unit</mat-icon>
           </button>
           
           <!-- Translate Button -->
           <button (click)="lang.toggle()" class="p-2 transition-all hover:scale-110 active:scale-90 rounded-full group bg-blue-50/50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20 shadow-sm flex items-center justify-center btn-icon-circle" [title]="lang.t('Switch Lang')">
              <mat-icon class="transition-transform duration-500 group-hover:rotate-12">g_translate</mat-icon>
           </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-2 w-full">
         <div class="flex items-center justify-start md:justify-center gap-2 sm:gap-3 w-full overflow-x-auto no-scrollbar py-2">
            <label class="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium cursor-pointer shadow-lg hover:shadow-blue-600/25 transition-all text-xs flex items-center justify-center gap-1.5 whitespace-nowrap min-w-max btn-main">
               <mat-icon class="scale-75">upload_file</mat-icon>
               {{ lang.t('Upload Files') }}
               <input type="file" multiple (change)="onFilesSelected($event)" class="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.cbr,.cbz,.zip,.rar,.epub" />
            </label>
            
            <label class="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-slate-800 hover:bg-slate-700 dark:bg-white/10 dark:hover:bg-white/20 text-white rounded-full font-medium cursor-pointer shadow-lg transition-all text-xs flex items-center justify-center gap-1.5 whitespace-nowrap min-w-max border border-white/5 btn-main">
               <mat-icon class="scale-75">folder_open</mat-icon>
               {{ lang.t('Upload Folder') }}
               <input type="file" webkitdirectory directory multiple (change)="onFilesSelected($event)" class="hidden" />
            </label>

            <button (click)="createNewFolder()" class="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 text-slate-900 dark:text-white rounded-full font-medium cursor-pointer transition-all text-xs flex items-center justify-center gap-1.5 whitespace-nowrap min-w-max border border-black/5 dark:border-white/5 btn-main">
               <mat-icon class="scale-75">create_new_folder</mat-icon>
               {{ lang.t('New Folder') }}
            </button>
         </div>
         
         <div class="flex items-center justify-end gap-1 w-full shrink-0 pr-1">
            <button (click)="viewMode.set('grid')" [class.text-blue-500]="viewMode() === 'grid'" [class.bg-slate-100]="viewMode() === 'grid'" [class.dark:bg-white/10]="viewMode() === 'grid'" class="p-2 transition-all hover:bg-slate-100 dark:hover:bg-white/5 rounded-full hover:text-blue-400 btn-icon-circle flex items-center justify-center">
               <mat-icon>grid_view</mat-icon>
            </button>
            <button (click)="viewMode.set('list')" [class.text-blue-500]="viewMode() === 'list'" [class.bg-slate-100]="viewMode() === 'list'" [class.dark:bg-white/10]="viewMode() === 'list'" class="p-2 transition-all hover:bg-slate-100 dark:hover:bg-white/5 rounded-full hover:text-blue-400 btn-icon-circle flex items-center justify-center">
               <mat-icon>view_list</mat-icon>
            </button>
         </div>
      </div>

      <!-- Breadcrumbs -->
      @if (currentParentId() !== 'root') {
         <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-medium bg-slate-200/50 dark:bg-white/5 w-fit px-4 py-2 rounded-full backdrop-blur-md">
            <button (click)="goBack()" class="flex items-center gap-1 hover:text-slate-800 dark:hover:text-white transition-colors">
               <mat-icon class="text-sm">arrow_back</mat-icon>
               {{ lang.t('Back') }}
            </button>
         </div>
      }

      <!-- Grid / List View -->
      @if (files().length === 0) {
         <div class="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-4 mt-20">
            <mat-icon class="text-6xl opacity-50">auto_awesome_mosaic</mat-icon>
            <p class="font-medium text-lg text-center">{{ lang.t('Empty Folder') }}</p>
            <p class="text-sm text-center max-w-sm">{{ lang.t('Empty Desc') }}</p>
         </div>
      } @else {
         <div [class]="viewMode() === 'grid' ? ('grid gap-[2px] px-[2px] w-full ' + (config.scale() === '60' || config.scale() === '70' ? 'grid-cols-4' : 'grid-cols-3')) : 'flex flex-col gap-2 px-1 sm:px-4'">
            @for (f of files(); track f.id) {
               @if (viewMode() === 'grid') {
                  <!-- Grid Item -->
                  <app-glass-card 
                       [className]="'group relative cursor-pointer flex flex-col items-center justify-center p-2 sm:p-4 text-center hover:-translate-y-1 hover:shadow-2xl hover:border-blue-500/50 transition-all select-none w-full h-[14rem]'"
                       (clicked)="openItem(f)"
                       (held)="openContextMenu(f)">
                     
                     <!-- Top Right Menu -->
                     <button (click)="deleteItem(f.id, $event)" class="absolute top-2 right-2 p-1.5 rounded-full bg-black/20 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md">
                        <mat-icon class="text-[18px] w-[18px] h-[18px] block">delete</mat-icon>
                     </button>

                     <mat-icon class="text-5xl mb-4" [class.text-amber-400]="f.type === 'folder'" [class.text-blue-400]="f.type === 'file' && f.mimeType?.includes('pdf')" [class.text-emerald-400]="f.type === 'file' && f.mimeType?.includes('image')" [class.text-purple-400]="f.type === 'file' && f.extension?.includes('cb')">
                        {{ getIcon(f) }}
                     </mat-icon>
                     <span class="text-sm font-medium line-clamp-2">{{ f.name }}</span>
                     @if (f.size) {
                        <span class="text-[10px] text-slate-500 dark:text-slate-400 mt-2">{{ formatSize(f.size) }}</span>
                     }
                  </app-glass-card>
               } @else {
                  <!-- List Item -->
                  <app-glass-card 
                       [className]="'group relative cursor-pointer flex items-center justify-between p-3 px-5 hover:-translate-y-0.5 hover:shadow-xl transition-all select-none w-full'"
                       (clicked)="openItem(f)"
                       (held)="openContextMenu(f)">
                     <div class="flex items-center gap-4 flex-1 min-w-0 pr-4">
                        <mat-icon class="flex-shrink-0" [class.text-amber-400]="f.type === 'folder'" [class.text-blue-400]="f.type === 'file' && f.mimeType?.includes('pdf')" [class.text-emerald-400]="f.type === 'file' && f.mimeType?.includes('image')" [class.text-purple-400]="f.type === 'file' && f.extension?.includes('cb')">
                           {{ getIcon(f) }}
                        </mat-icon>
                        <span class="text-sm font-medium break-all">{{ f.name }}</span>
                     </div>
                     <div class="flex items-center gap-4 flex-shrink-0">
                        @if (f.size) {
                           <span class="text-xs text-slate-500 dark:text-slate-400">{{ formatSize(f.size) }}</span>
                        }
                        <button (click)="deleteItem(f.id, $event)" class="p-2 rounded-full hover:bg-red-500 hover:text-white text-slate-400 transition-colors">
                           <mat-icon class="text-[18px] w-[18px] h-[18px] block">delete</mat-icon>
                        </button>
                     </div>
                  </app-glass-card>
               }
            }
         </div>
      }
      
<!-- Context Menu Modal -->
      @if (activeMenu()) {
          <div class="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity select-none" (click)="closeMenu()">
             <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 w-full max-w-sm flex flex-col gap-2 overflow-hidden" (click)="$event.stopPropagation()">
                <div class="text-center pb-4 border-b border-slate-100 dark:border-white/10 mb-2">
                   <h3 class="text-slate-900 dark:text-white font-medium px-4 break-words line-clamp-3">{{ activeMenu()?.name }}</h3>
                   <span class="text-xs text-slate-500 dark:text-white/50">{{ activeMenu()?.type === 'folder' ? lang.t('Folder') : lang.t('File') }}</span>
                </div>
                
                <button (click)="handleMenuOpen()" class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white text-left font-medium">
                   <mat-icon class="text-blue-500 dark:text-blue-400">open_in_new</mat-icon>
                   {{ lang.t('Open') }}
                </button>
                @if (activeMenu()?.extension === 'pdf') {
                   <button [disabled]="isConverting()" (click)="handleConvertToEpub()" class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white text-left font-medium disabled:opacity-50">
                      @if (isConverting()) {
                         <mat-icon class="text-emerald-500 animate-spin">data_usage</mat-icon>
                         {{ lang.t('Converting') }}
                      } @else {
                         <mat-icon class="text-emerald-500">auto_stories</mat-icon>
                         {{ lang.t('Convert to EPUB') }}
                      }
                   </button>
                }
                <button (click)="handleMenuDelete()" class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/20 text-red-500 transition-colors text-left font-medium">
                   <mat-icon>delete</mat-icon>
                   {{ lang.t('Delete') }}
                </button>
                
                <button (click)="closeMenu()" class="w-full mt-2 p-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-slate-800 dark:text-white font-medium">
                   {{ lang.t('Cancel') }}
                </button>
             </div>
          </div>
      }
      
    </div>
  `
})
export class LibraryComponent implements OnInit {
  lang = inject(LangService);
  fileService = inject(FileService);
  progressService = inject(ProgressService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  config = inject(ConfigService);
  
  viewMode = signal<'grid'|'list'>('grid');
  currentParentId = signal<string>('root');
  files = signal<AppFile[]>([]);
  activeMenu = signal<AppFile | null>(null);
  totalSize = signal<number>(0);
  totalFilesCount = signal<number>(0);

  constructor() {
     effect(() => {
        // re-fetch when file service changes or parent id changes
        this.fileService.filesChanged();
        this.loadFiles();
     });
  }

  ngOnInit() {
     this.route.paramMap.subscribe(params => {
        if (params.has('folderId')) {
            this.currentParentId.set(params.get('folderId')!);
        } else {
            this.currentParentId.set('root');
        }
     });
  }

  async loadFiles() {
     const res = await this.fileService.getFilesByParent(this.currentParentId());
     // Sort folders first, then alphabetically
     res.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
     });
     this.files.set(res);
     this.totalSize.set(await this.fileService.getTotalSize());
     this.totalFilesCount.set(await this.fileService.getTotalFilesCount());
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

  async createNewFolder() {
     const name = prompt(this.lang.t('New Folder Name'));
     if (name) {
        await this.fileService.createFolder(name, this.currentParentId());
     }
  }

  async clearAll() {
     if (confirm(this.lang.t('Clear All Confirm'))) {
        await this.fileService.clearAll();
     }
  }

  async onFilesSelected(event: Event) {
     const input = event.target as HTMLInputElement;
     if (!input.files || input.files.length === 0) return;
     
     // Handle webkitdirectory paths (e.g. folder/subfolder/file.txt)
     // We need to create the virtual folders iteratively.
     const files = Array.from(input.files);
     this.progressService.show('Subiendo archivos...', files.length);
     let currentFileIndex = 0;
     const folderCache = new Map<string, string>();
     const baseParentId = this.currentParentId(); // Capture base parent ID once

     // Clear input to allow re-uploading the same folder if needed
     input.value = '';

     // For performance, we can just dump them into the current parent for now,
     // or re-create directory tree. Let's do simple flat upload to current folder if standard upload,
     // or create trees if webkit path is present.
     for (const file of files) {
        const path = file.webkitRelativePath;
        if (path) {
           const parts = path.split('/');
           parts.pop(); // remove filename
           let currentFolder = baseParentId;
           let accumulatedPath = '';

           for (const part of parts) {
               accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
               const cacheKey = `${currentFolder}:${accumulatedPath}`;
               
               if (folderCache.has(cacheKey)) {
                  currentFolder = folderCache.get(cacheKey)!;
               } else {
                  // find or create folder
                  const currentFiles = await this.fileService.getFilesByParent(currentFolder);
                  let folderMatch = currentFiles.find(f => f.type === 'folder' && f.name === part);
                  if (!folderMatch) {
                     const newId = await this.fileService.createFolder(part, currentFolder);
                     currentFolder = newId;
                  } else {
                     currentFolder = folderMatch.id;
                  }
                  folderCache.set(cacheKey, currentFolder);
               }
           }
           await this.fileService.storeFile(file, currentFolder);
           currentFileIndex++;
           this.progressService.update(currentFileIndex, 'Subiendo ' + file.name + '...');
        } else {
           await this.fileService.storeFile(file, baseParentId);
           currentFileIndex++;
           this.progressService.update(currentFileIndex, 'Subiendo ' + file.name + '...');
        }
     }
     
     input.value = ''; // reset
     this.progressService.hide();
  }

  isConverting = signal(false);

  openItem(f: AppFile) {
     this.fileService.updateLastOpened(f.id);
     if (f.type === 'folder') {
        this.router.navigate(['/folder', f.id]);
     } else {
        this.router.navigate(['/viewer', f.id]);
     }
  }

  openContextMenu(f: AppFile) {
     this.activeMenu.set(f);
  }

  closeMenu() {
     if (this.isConverting()) return;
     this.activeMenu.set(null);
  }
  
  async handleConvertToEpub() {
     const file = this.activeMenu();
     if (!file) return;
     
     this.isConverting.set(true);
     try {
        await this.fileService.convertPdfToEpub(file);
        this.closeMenu();
     } catch (e) {
        console.error("Convert failed:", e);
        alert(this.lang.t('Convert Error'));
     } finally {
        this.isConverting.set(false);
     }
  }

  handleMenuOpen() {
     const f = this.activeMenu();
     if (f) {
        this.closeMenu();
        this.openItem(f);
     }
  }

  async handleMenuDelete() {
     const f = this.activeMenu();
     if (f) {
        this.closeMenu();
        if (confirm(this.lang.t('Delete Confirm'))) {
           await this.fileService.deleteItem(f.id);
        }
     }
  }

  goBack() {
     this.fileService.getFileMetadata(this.currentParentId()).then(meta => {
         if (meta && meta.parentId && meta.parentId !== 'root') {
             this.router.navigate(['/folder', meta.parentId]);
         } else {
             this.router.navigate(['/']);
         }
     });
  }

  async deleteItem(id: string, event: Event) {
     event.stopPropagation();
     if (confirm(this.lang.t('Delete Confirm'))) {
        await this.fileService.deleteItem(id);
     }
  }
}
