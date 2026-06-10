import { Component, inject, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FileService, AppFile } from '../../services/file.service';
import { LangService } from '../../services/lang.service';
import { ConfigService } from '../../services/config.service';
import * as JSZip from 'jszip';
import * as parse5 from 'parse5';

// Hack for EPUB.js to parse malformed XML as HTML
if (typeof window !== 'undefined' && window.DOMParser) {
    const originalParse = window.DOMParser.prototype.parseFromString;
    window.DOMParser.prototype.parseFromString = function(string: string, type: DOMParserSupportedType) {
        if (type === 'application/xhtml+xml') {
            type = 'text/html';
        }
        return originalParse.call(this, string, type);
    };
}
// Mammoth and PDF.js will be loaded dynamically to avoid build issues if types are weird.

interface Page {
  url: string;
  name?: string;
  blob?: Blob;
}

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white flex flex-col h-screen overflow-hidden">
       <!-- Topbar -->
       <div class="h-14 bg-white dark:bg-[#111] border-b border-white/10 flex items-center justify-between px-2 sm:px-4 shrink-0 transition-transform ease-out duration-75"
            [class.-translate-y-full]="!uiVisible()">
          <div class="flex items-center gap-1 sm:gap-4">
             <button (click)="close()" class="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center">
                <mat-icon>arrow_back</mat-icon>
             </button>
             <h2 class="font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[200px] md:max-w-md">{{ fileMeta()?.name || lang.t('Loading') }}</h2>
          </div>
          
          <div class="flex items-center gap-1 sm:gap-2">
             <button (click)="toggleThumbnails()" class="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center" [class.bg-slate-200]="showThumbnails()" [class.dark:bg-white/20]="showThumbnails()">
                <mat-icon>view_carousel</mat-icon>
             </button>
             
             <!-- Reading Mode Toggle -->
             @if (!isDocx()) {
                 <div class="bg-slate-100 dark:bg-black border border-slate-200 dark:border-white/10 rounded-full flex p-1">
                    <button (click)="setReadMode('vertical')" [class.bg-slate-300]="readMode()==='vertical'" [class.dark:bg-white/20]="readMode()==='vertical'" class="p-1.5 rounded-full transition-colors flex items-center justify-center">
                       <mat-icon class="text-[18px]">swap_vert</mat-icon>
                    </button>
                    <button (click)="setReadMode('horizontal')" [class.bg-slate-300]="readMode()==='horizontal'" [class.dark:bg-white/20]="readMode()==='horizontal'" class="p-1.5 rounded-full transition-colors flex items-center justify-center">
                       <mat-icon class="text-[18px]">swap_horiz</mat-icon>
                    </button>
                 </div>
             }
             
             <div class="flex items-center ml-2 bg-slate-100 dark:bg-black border border-slate-200 dark:border-white/10 rounded-full">
                <button (click)="toggleAutoScroll()" class="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center" [class.text-blue-500]="isAutoScrolling()">
                   <mat-icon>{{ isAutoScrolling() ? 'pause' : 'play_arrow' }}</mat-icon>
                </button>
                @if (isAutoScrolling()) {
                   <select [ngModel]="currentAutoScrollSpeed()" (ngModelChange)="setScrollSpeed($event)" class="bg-transparent text-xs outline-none cursor-pointer pr-2 appearance-none">
                      @for (speed of autoScrollSpeeds; track speed) {
                         <option [value]="speed" class="bg-white dark:bg-black text-slate-900 dark:text-white">x{{ speed }}</option>
                      }
                   </select>
                }
             </div>
          </div>
       </div>

        <!-- Main Content Area -->
       <div class="flex-1 flex overflow-hidden relative">
           <!-- Thumbnails panel -->
          @if (showThumbnails()) {
             <div class="absolute inset-0 z-10 bg-black/10 dark:bg-black/50 md:hidden" (click)="toggleThumbnails()"></div>
             <div class="absolute md:relative z-20 w-48 bg-slate-100 dark:bg-[#111] border-r border-slate-200 dark:border-white/10 overflow-y-auto shrink-0 flex flex-col p-2 gap-2 hide-scrollbar h-full shadow-2xl md:shadow-none">
                @for (p of pages(); track p.url; let i = $index) {
                    <div (click)="goToPage(i)" 
                        class="bg-white dark:bg-black rounded-md border-2 overflow-hidden cursor-pointer transition-all flex items-center justify-center relative group"
                        [ngClass]="!isEpub() ? 'aspect-[3/4]' : 'p-3'"
                        [class.border-blue-500]="currentPage() === i"
                        [class.border-transparent]="currentPage() !== i">
                      @if (p.url.endsWith('.pdf-page') || isDocx()) {
                         <div class="text-xs text-slate-500 dark:text-white/50">Pág {{ i + 1 }}</div>
                      } @else if (isEpub()) {
                         <div class="text-xs font-medium text-slate-700 dark:text-white/80 text-center line-clamp-3">
                             {{ p.name || 'Capítulo ' + (i + 1) }}
                         </div>
                      } @else {
                         <img [src]="p.url" class="w-full h-full object-contain" loading="lazy" />
                      }
                      @if (!isEpub()) {
                         <div class="absolute bottom-0 inset-x-0 bg-white/80 dark:bg-black/60 p-1 text-[10px] text-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {{ i + 1 }}
                         </div>
                      }
                   </div>
                }
             </div>
          }

          <!-- Viewport -->
          <div class="flex-1 overflow-auto bg-slate-200/50 dark:bg-[#0a0a0a] relative layout-viewport" style="touch-action: manipulation;" (click)="toggleUI()" (scroll)="onScroll($event)">
             
             @if (loading()) {
                <div class="absolute inset-0 flex flex-col items-center justify-center text-white/50 gap-4">
                   <mat-icon class="animate-spin">autorenew</mat-icon>
                   <p>Procesando archivo...</p>
                </div>
             } @else {
                <!-- Vertical Scrolling Mode -->
                @if (readMode() === 'vertical') {
                   <div class="flex flex-col items-center w-full min-h-full">
                      @if (isEpub()) {
                         <div class="w-full flex justify-center transition-all">
                             <div class="bg-white text-black w-full p-0 shadow-2xl flex items-center justify-center overflow-auto">
                                 <div id="epub-container" class="w-full bg-white text-black" style="height: 100vh; min-height: 800px;"></div>
                             </div>
                         </div>
                      } @else {
                          @for (p of pages(); track p.url; let i = $index) {
                             <div class="w-full flex justify-center transition-all" [id]="'page-' + i">
                                @if (p.url.endsWith('.pdf-page') || isDocx()) {
                                    <div [id]="'render-target-' + i" class="bg-white text-black min-h-[800px] w-full max-w-5xl md:w-full flex items-center justify-center overflow-auto" [class]="isDocx() ? 'p-0 md:my-4 shadow-2xl' : 'p-8'">
                                       <!-- PDF / DOCX render target -->
                                       <div *ngIf="isDocx()" [innerHTML]="docxHtml" class="w-full break-words p-8"></div>
                                    </div>
                                } @else {
                                    <img [src]="p.url" class="w-full h-auto max-w-5xl md:w-[90%] md:max-w-7xl object-contain block m-0 p-0" loading="lazy" style="min-height: 300px;" />
                                }
                             </div>
                          }
                      }

                       <!-- END SCREEN -->
                       @if (!isEpub() && (nextFile() || previousFile()) && config.nextFileBehavior() !== 'off') {
                           <div class="w-full flex justify-center py-20 px-4 bg-slate-100 dark:bg-transparent">
                               <div class="max-w-md w-full bg-white dark:bg-[#111] p-8 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl flex flex-col items-center text-center gap-6">
                                   <div class="text-4xl text-slate-400">🏁</div>
                                   <div>
                                       <h3 class="text-lg font-semibold">{{ lang.t('Finished') }}</h3>
                                       @if (nextFile()) {
                                           <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">{{ lang.t('Next File Available') }}:</p>
                                           <div class="font-medium mt-1 break-words break-all whitespace-normal overflow-hidden max-w-[280px] sm:max-w-full text-balance line-clamp-4 leading-snug">{{ nextFile()?.name }}</div>
                                       }
                                   </div>
                                   
                                   <div class="flex flex-col gap-3 w-full mt-4">
                                       @if (previousFile()) {
                                           <button (click)="openFile(previousFile()!.id)" class="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                                               <mat-icon class="scale-90">arrow_back</mat-icon>
                                               {{ lang.t('Previous') }}
                                           </button>
                                       }
                                       @if (nextFile()) {
                                           <button (click)="openFile(nextFile()!.id)" class="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-lg hover:shadow-blue-600/30 text-sm font-medium flex items-center justify-center gap-2">
                                               {{ lang.t('Continue Reading') }}
                                               <mat-icon class="scale-90">arrow_forward</mat-icon>
                                           </button>
                                       }
                                   </div>
                               </div>
                           </div>
                       }
                       <!-- END SCREEN -->

                   </div>
                } 
                <!-- Horizontal Pagination Mode -->
                @else {
                   <div class="w-full h-full flex items-center justify-center relative touch-pan-x touch-pan-y" style="transform-origin: center center;">
                      @if (isEpub()) {
                          <div class="w-full h-full flex items-center justify-center">
                              <div [id]="'render-target-horiz'" class="bg-white text-black min-h-screen h-full w-full flex items-center justify-center overflow-auto">
                                  <div id="epub-container-horiz" class="w-full bg-white text-black max-w-5xl" style="height: 100vh; min-height: 800px;"></div>
                              </div>
                          </div>
                      } @else if (pages()[currentPage()]) {
                         <div class="w-full h-full flex items-center justify-center">
                             @if (pages()[currentPage()].url.endsWith('.pdf-page') || isDocx()) {
                                 <div [id]="'render-target-horiz'" class="bg-white text-black min-h-screen h-full w-full flex items-center justify-center overflow-auto w-full h-full p-0 m-0">
                                     <div *ngIf="isDocx()" [innerHTML]="docxHtml" class="w-full h-full break-words max-w-5xl p-8"></div>
                                 </div>
                             } @else {
                                 <img [src]="pages()[currentPage()].url" class="w-full h-full object-contain" />
                             }
                         </div>
                      }
                      
                      <!-- Overlay Nav Buttons -->
                      <div class="absolute inset-y-0 left-0 w-24 md:w-32 flex items-center justify-start px-4 opacity-50 hover:opacity-100 transition-opacity z-10 cursor-pointer" (click)="$event.stopPropagation(); prevPage()">
                         <div class="bg-black/50 text-white w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center shadow-lg hover:bg-black/70 transition-colors">
                            <mat-icon class="text-3xl text-white">chevron_left</mat-icon>
                         </div>
                      </div>
                      <div class="absolute inset-y-0 right-0 w-24 md:w-32 flex items-center justify-end px-4 opacity-50 hover:opacity-100 transition-opacity z-10 cursor-pointer" (click)="$event.stopPropagation(); nextPage()">
                         <div class="bg-black/50 text-white w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center shadow-lg hover:bg-black/70 transition-colors">
                            <mat-icon class="text-3xl text-white">chevron_right</mat-icon>
                         </div>
                      </div>
                   </div>
                }
             }

          </div>
       </div>

       <!-- Bottom Navigation / Info (Only in Horizontal Mode) -->
       @if (readMode() === 'horizontal' && pages().length > 1) {
          <div class="h-12 bg-[#111] border-t border-white/10 flex items-center justify-center shrink-0 text-sm transition-transform ease-out duration-75"
               [class.translate-y-full]="!uiVisible()">
             <button (click)="prevPage()" [disabled]="currentPage() === 0 && (!previousFile() || config.nextFileBehavior() === 'off')" class="p-2 disabled:opacity-50 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"><mat-icon>chevron_left</mat-icon></button>
             <span class="font-mono mx-4">{{ currentPage() + 1 }} / {{ pages().length }}</span>
             <button (click)="nextPage()" [disabled]="currentPage() === pages().length - 1 && (!nextFile() || config.nextFileBehavior() === 'off')" class="p-2 disabled:opacity-50 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"><mat-icon>chevron_right</mat-icon></button>
          </div>
       }

       <!-- End Overlay (Floating) -->
       @if (showEndOverlay()) {
           <div class="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity" (click)="showEndOverlay.set(false)">
               <div class="bg-white dark:bg-[#111] p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-md w-full flex flex-col items-center text-center gap-6 relative" (click)="$event.stopPropagation()">
                   <button (click)="showEndOverlay.set(false)" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center">
                       <mat-icon>close</mat-icon>
                   </button>
                   <div class="text-6xl mb-2">🏁</div>
                   <div>
                       <h3 class="text-2xl font-bold text-slate-900 dark:text-white">{{ lang.t('Finished') }}</h3>
                       @if (nextFile()) {
                           <p class="text-sm text-slate-500 dark:text-slate-400 mt-3">{{ lang.t('Next File Available') }}:</p>
                           <div class="font-medium mt-1 text-slate-800 dark:text-slate-100 break-words break-all whitespace-normal overflow-hidden max-w-[280px] sm:max-w-full text-balance line-clamp-4 leading-snug">{{ nextFile()?.name }}</div>
                       }
                   </div>
                   
                   <div class="flex flex-col gap-3 w-full mt-4">
                       @if (nextFile()) {
                           <button (click)="openFile(nextFile()!.id)" class="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-lg hover:shadow-blue-600/30 text-[15px] font-medium flex items-center justify-center gap-2">
                               {{ lang.t('Continue Reading') }}
                               <mat-icon class="scale-90 relative" style="top: 1px">arrow_forward</mat-icon>
                           </button>
                       }
                       @if (previousFile()) {
                           <button (click)="openFile(previousFile()!.id)" class="w-full py-3.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-[15px] font-medium flex items-center justify-center gap-2 text-slate-700 dark:text-slate-300">
                               <mat-icon class="scale-90 relative text-slate-500" style="top: 1px">arrow_back</mat-icon>
                               {{ lang.t('Previous') }}
                           </button>
                       }
                   </div>
               </div>
           </div>
       }
    </div>
  `,
  styles: [`
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class ViewerComponent implements OnInit, OnDestroy {
  route = inject(ActivatedRoute);
  location = inject(Location);
  fileService = inject(FileService);
  lang = inject(LangService);
  config = inject(ConfigService);
  router = inject(Router);

  fileMeta = signal<Omit<AppFile, 'content'> | null>(null);
  previousFile = signal<AppFile | null>(null);
  nextFile = signal<AppFile | null>(null);
  pages = signal<Page[]>([]);
  
  loading = signal(true);
  uiVisible = signal(true);
  showThumbnails = signal(false);
  showEndOverlay = signal(false);
  readMode = signal<'vertical'|'horizontal'>('vertical');
  currentPage = signal(0);
  isDocx = signal(false);
  isEpub = signal(false);
  docxHtml = '';
  epubBook: any;
  epubRendition: any;
  pdfDoc: any;
  isProgrammaticScroll = false;
  
  autoScrollSpeeds = [0.5, 1, 1.5, 2.5, 4, 6, 8, 10, 12, 14];
  currentAutoScrollSpeed = signal<number>(1);
  autoScrollInterval: any;
  isAutoScrolling = signal(false);
  autoAdvanceTimeout: any;

  private objectUrls: string[] = [];

  async ngOnInit() {
    this.route.paramMap.subscribe(async (params) => {
       const id = params.get('id');
       if (!id) return this.close();
       await this.loadFile(id);
    });
  }

  openFile(id: string) {
      this.showEndOverlay.set(false);
      if (this.autoAdvanceTimeout) {
          clearTimeout(this.autoAdvanceTimeout);
          this.autoAdvanceTimeout = null;
      }
      this.router.navigate(['/viewer', id], { replaceUrl: true });
  }

  async loadFile(id: string) {
    this.loading.set(true);
    // Cleanup previous file
    if (this.autoAdvanceTimeout) {
        clearTimeout(this.autoAdvanceTimeout);
        this.autoAdvanceTimeout = null;
    }
    const viewport = document.querySelector('.layout-viewport');
    if (viewport) {
         viewport.scrollTop = 0;
    }
    
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls = [];
    if (this.autoScrollInterval) clearInterval(this.autoScrollInterval);
    this.isAutoScrolling.set(false);
    this.pages.set([]);
    this.currentPage.set(0);
    this.docxHtml = '';
    
    if (this.epubBook) {
        this.epubBook.destroy();
        this.epubBook = null;
        const container = document.getElementById('epub-container');
        if (container) container.innerHTML = '';
    }
    this.pdfDoc = null;

    const meta = await this.fileService.getFileMetadata(id);
    if (!meta) return this.close();
    this.fileMeta.set(meta);
    
    await this.findSiblings(meta);

    const blob = await this.fileService.getFileContent(id);
    if (!blob) return this.close();

    await this.processFile(meta, blob);
  }

  async findSiblings(meta: AppFile) {
     let siblings = await this.fileService.getFilesByParent(meta.parentId);
     siblings = siblings.filter(s => s.type === 'file');
     // No sorting by name needed if we want exact library order? 
     // Wait, library currently doesn't store sort index, it just relies on createdAt or name.
     // But user says: "[0] Volumen 5, [1] Volumen 4... si alguien sube Volumen 1, 2, 3 en ese orden, el sistema seguirá el orden.
     // Recent files are ordered by createdAt desc. Library is ordered by name asc or createdAt desc. Let's just sort alphabetically so it handles Vol 1, Vol 2 reliably.
     siblings.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

     const currentIndex = siblings.findIndex(s => s.id === meta.id);
     if (currentIndex > 0) {
         this.previousFile.set(siblings[currentIndex - 1]);
     } else {
         this.previousFile.set(null);
     }
     
     if (currentIndex < siblings.length - 1) {
         this.nextFile.set(siblings[currentIndex + 1]);
     } else {
         this.nextFile.set(null);
     }
  }

  setScrollSpeed(speed: number | string) {
      const spd = typeof speed === 'string' ? parseFloat(speed) : speed;
      this.currentAutoScrollSpeed.set(spd);
      if (this.isAutoScrolling()) {
          // Restart interval with new speed
          this.toggleAutoScroll(); // wait, toggle twice
          this.isAutoScrolling.set(false);
          clearInterval(this.autoScrollInterval);
          this.toggleAutoScroll();
      }
  }

  setReadMode(mode: 'vertical' | 'horizontal') {
      this.readMode.set(mode);
      if (this.isEpub()) {
          setTimeout(() => this.renderEpub(), 250);
      } else if (this.pdfDoc) {
          setTimeout(() => this.renderPDF(this.pdfDoc), 250);
      }
  }

  toggleAutoScroll() {
      if (this.isAutoScrolling()) {
          this.isAutoScrolling.set(false);
          clearInterval(this.autoScrollInterval);
      } else {
          this.isAutoScrolling.set(true);
          // the logic: on vertical mode, standard smooth scroll might be slow/fast. Let's do a requestAnimationFrame or interval.
          // Using interval of say 20ms and scroll amount = speed.
          this.autoScrollInterval = setInterval(() => {
              if (this.readMode() === 'vertical') {
                  const viewport = document.querySelector('.layout-viewport');
                  if (viewport) {
                      // default 1x = 1px every 20ms = 50px/sec
                      const amt = this.currentAutoScrollSpeed();
                      viewport.scrollBy({ top: amt, behavior: 'auto' });
                  }
              } else {
                  // In horizontal mode it pages. 3000ms / speed. 1x = 3000ms. 2x = 1500ms
                  this.nextPage(true);
              }
          }, this.readMode() === 'vertical' ? 20 : (3000 / (this.currentAutoScrollSpeed() || 1)));
      }
  }

  ngOnDestroy() {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    if (this.autoScrollInterval) clearInterval(this.autoScrollInterval);
    if (this.autoAdvanceTimeout) clearTimeout(this.autoAdvanceTimeout);
  }

  async processFile(meta: Omit<AppFile, 'content'>, blob: Blob) {
     this.loading.set(true);
     const ext = meta.extension?.toLowerCase() || '';

     try {
       if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
             // Check if this image has siblings in the same folder for seamless reading
             if (meta.parentId !== 'root') {
                 let siblings = await this.fileService.getFilesByParent(meta.parentId);
                 siblings = siblings.filter(s => ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(s.extension?.toLowerCase() || ''));
                 siblings.sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
                 
                 if (siblings.length > 0) {
                     const newPages: Page[] = [];
                     let startIdx = 0;
                     for (let i = 0; i < siblings.length; i++) {
                         const sib = siblings[i];
                         if (sib.id === meta.id) startIdx = i;
                         const sibBlob = await this.fileService.getFileContent(sib.id);
                         if (sibBlob) {
                             const url = URL.createObjectURL(sibBlob);
                             this.objectUrls.push(url);
                             newPages.push({ url, name: sib.name });
                         }
                     }
                     this.pages.set(newPages);
                     this.currentPage.set(startIdx);
                     
                     // Scroll to the startIdx page if in vertical mode
                     if (this.readMode() === 'vertical') {
                         setTimeout(() => {
                             this.goToPage(startIdx);
                         }, 100);
                     }
                 } else {
                 const url = URL.createObjectURL(blob);
                 this.objectUrls.push(url);
                 this.pages.set([{ url }]);
             }
          } else {
              // Single Image
              const url = URL.createObjectURL(blob);
              this.objectUrls.push(url);
              this.pages.set([{ url }]);
          }
       } else if (['zip', 'cbz'].includes(ext)) {
          // Archive Images
          const JSZipModule = await import('jszip');
          const JSZipClass = JSZipModule.default || JSZipModule;
          const zip = new (JSZipClass as any)();
          await zip.loadAsync(blob);
          const imageFiles: string[] = [];
          
          zip.forEach((relativePath: string, zipEntry: any) => {
             if (!zipEntry.dir && relativePath.match(/\.(jpg|jpeg|png|webp)$/i)) {
                imageFiles.push(relativePath);
             }
          });
          
          imageFiles.sort(); // Very basic numeric/string sort
          const extractedPages: Page[] = [];
          
          for (const path of imageFiles) {
             const fileData = await zip.file(path)?.async('blob');
             if (fileData) {
                const url = URL.createObjectURL(fileData);
                this.objectUrls.push(url);
                extractedPages.push({ url, name: path });
             }
          }
          this.pages.set(extractedPages);
       } else if (['rar', 'cbr'].includes(ext)) {
          // Unrar Images
          const unrar = await import('node-unrar-js');
          const arrayBuffer = await blob.arrayBuffer();
          const wasmResponse = await fetch('https://unpkg.com/node-unrar-js@2.0.2/esm/js/unrar.wasm');
          const wasmBinary = await wasmResponse.arrayBuffer();
          
          const extractor = await unrar.createExtractorFromData({ data: arrayBuffer, wasmBinary });
          const { files } = extractor.extract();
          
          const extractedPages: Page[] = [];
          for (const file of files) {
              if (file.fileHeader.flags.directory) continue;
              const name = file.fileHeader.name;
              if (name.match(/\.(jpg|jpeg|png|webp)$/i) && file.extraction) {
                  const fileBlob = new Blob([new Uint8Array(file.extraction)]);
                  const url = URL.createObjectURL(fileBlob);
                  this.objectUrls.push(url);
                  extractedPages.push({ url, name: name });
              }
          }
          
          extractedPages.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          this.pages.set(extractedPages);
       } else if (ext === 'pdf') {
          // Just set placeholders, render happens outside right now or needs pdf.js
          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
          
          const arrayBuffer = await blob.arrayBuffer();
          this.pdfDoc = await pdfjs.getDocument(arrayBuffer).promise;
          const pages: Page[] = [];
          for (let i = 1; i <= this.pdfDoc.numPages; i++) {
             pages.push({ url: `page-${i}.pdf-page` });
          }
          this.pages.set(pages);
          
          // Actually rendering PDF will require some timeouts and canvas elements.
          // For simplicity, we can load them lazily or just set a warning.
          setTimeout(() => this.renderPDF(this.pdfDoc), 500);

       } else if (['doc', 'docx'].includes(ext)) {
          const mammoth = await import('mammoth');
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          this.docxHtml = result.value;
          this.isDocx.set(true);
          this.pages.set([{ url: 'docx.docx-page' }]);
       } else if (ext === 'epub') {
          const ePub = await import('epubjs').then((m:any) => m.default || m);
          this.isEpub.set(true);
          
          const arrayBuffer = await blob.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);
          
          for (const relativePath in zip.files) {
              const fileInfo = zip.files[relativePath];
              const ext = relativePath.split('.').pop()?.toLowerCase();
              if (!fileInfo.dir && ['html', 'htm', 'xhtml', 'xml'].includes(ext || '')) {
                  // Skip standard metadata files just in case
                  if (relativePath.includes('META-INF/') || relativePath.endsWith('.opf') || relativePath.endsWith('.ncx')) {
                      continue;
                  }
                  
                  const content = await fileInfo.async("string");
                  // Only parse as HTML if it contains an html or body tag
                  if (!/<html/i.test(content) && !/<body/i.test(content)) {
                      continue;
                  }
                  
                  try {
                      const document = parse5.parse(content);
                      let sanitizedContent = parse5.serialize(document);
                      
                      // Clean up void elements to be self-closing because EPUB requires valid XML (XHTML)
                      const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
                      const voidElementsRegex = new RegExp('<(' + voidElements.join('|') + ')\\b([^>]*?)(?<!/)(?<!/ )>', 'gi');
                      sanitizedContent = sanitizedContent.replace(voidElementsRegex, '<$1$2/>');
                      
                      zip.file(relativePath, sanitizedContent);
                  } catch (e) {
                      console.warn('Silent fallback for HTML parse error in parse5:', e);
                  }
              }
          }
          
          const sanitizedArrayBuffer = await zip.generateAsync({ type: "arraybuffer" });
          this.epubBook = ePub(sanitizedArrayBuffer);
          
          this.epubBook.loaded.navigation.then((nav: any) => {
             const pages: Page[] = [];
             const extractTOC = (items: any[]) => {
                 for (const item of items) {
                     pages.push({ url: `epub-chapter:${item.href}`, name: item.label });
                     if (item.subitems && item.subitems.length) extractTOC(item.subitems);
                 }
             };
             if (nav.toc && nav.toc.length) {
                 extractTOC(nav.toc);
             } else {
                 pages.push({ url: 'epub-chapter:start', name: this.lang.t('Start') });
             }
             this.pages.set(pages);
          });
          
          setTimeout(() => {
              this.renderEpub();
          }, 200);
       } else {
          alert('Formato no soportado aún.');
          this.close();
       }
     } catch (err) {
       console.error('Error open formatting:', err);
       alert('Error procesando el archivo.');
     }

     this.loading.set(false);
  }

  renderPDF(pdf: any) {
      const mode = this.readMode();
      
      const render = async () => {
          if (mode === 'vertical') {
              let allTargetsFound = true;
              for (let i = 0; i < this.pages().length; i++) {
                 if (!document.getElementById('render-target-' + i)) {
                     allTargetsFound = false;
                     break;
                 }
              }
              if (!allTargetsFound) {
                  setTimeout(render, 100);
                  return;
              }
              
              for (let i = 0; i < this.pages().length; i++) {
                  const page = await pdf.getPage(i + 1);
                  const viewport = page.getViewport({ scale: 1.5 });
                  const target = document.getElementById('render-target-' + i);
                  if (target) {
                      target.innerHTML = '';
                      const canvas = document.createElement('canvas');
                      const context = canvas.getContext('2d');
                      canvas.height = viewport.height;
                      canvas.width = viewport.width;
                      canvas.style.display = 'block';
                      canvas.style.width = '100%';
                      canvas.style.height = 'auto';
                      canvas.style.margin = '0';
                      canvas.style.padding = '0';
                      target.appendChild(canvas);
                      await page.render({ canvasContext: context, viewport: viewport }).promise;
                      target.classList.remove('p-8', 'min-h-[800px]', 'md:my-4', 'shadow-2xl');
                      target.classList.add('p-0');
                  }
              }
          } else {
              // Render only current page
              const target = document.getElementById('render-target-horiz');
              if (target) {
                  const page = await pdf.getPage(this.currentPage() + 1);
                  const viewport = page.getViewport({ scale: 1.5 });
                  target.innerHTML = '';
                  const canvas = document.createElement('canvas');
                  const context = canvas.getContext('2d');
                  canvas.height = viewport.height;
                  canvas.width = viewport.width;
                  canvas.style.display = 'block';
                  canvas.style.width = '100%';
                  canvas.style.height = 'auto';
                  canvas.style.margin = '0';
                  canvas.style.padding = '0';
                  target.appendChild(canvas);
                  await page.render({ canvasContext: context, viewport: viewport }).promise;
                  target.classList.remove('p-8', 'min-h-[800px]', 'md:my-4', 'shadow-2xl');
                  target.classList.add('p-0');
              } else {
                  setTimeout(render, 100);
              }
          }
      };
      render();
  }

  close() { this.location.back(); }
  toggleUI() { this.uiVisible.set(!this.uiVisible()); }
  toggleThumbnails() { this.showThumbnails.set(!this.showThumbnails()); }

  onScroll(event: Event) {
      if (this.loading() || this.readMode() !== 'vertical' || this.isEpub() || this.isProgrammaticScroll) return;
      const target = event.target as HTMLElement;
      
      let closestPage = 0;
      let minDiff = Infinity;
      const scrollY = target.scrollTop + (target.clientHeight / 2);
      
      for (let i = 0; i < this.pages().length; i++) {
          const el = document.getElementById('page-' + i);
          if (el && el.clientHeight > 10) {
              const elY = el.offsetTop + (el.clientHeight / 2);
              const diff = Math.abs(scrollY - elY);
              if (diff < minDiff) {
                  minDiff = diff;
                  closestPage = i;
              }
          }
      }
      if (this.currentPage() !== closestPage) {
          this.currentPage.set(closestPage);
      }

      // Prevent fake layout-shift scroll events at the very top from immediately skipping short files
      if (target.scrollTop <= 5 && !this.isAutoScrolling()) {
          if (this.autoAdvanceTimeout) {
              clearTimeout(this.autoAdvanceTimeout);
              this.autoAdvanceTimeout = null;
          }
      } else {
          // Auto advance
          const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 100;
          if (isAtBottom && this.nextFile() && this.config.nextFileBehavior() === 'auto') {
              if (!this.autoAdvanceTimeout) {
                  this.autoAdvanceTimeout = setTimeout(() => {
                      this.openFile(this.nextFile()!.id);
                  }, 3000); // 3 seconds
              }
          } else {
              if (this.autoAdvanceTimeout) {
                  clearTimeout(this.autoAdvanceTimeout);
                  this.autoAdvanceTimeout = null;
              }
          }
      }
  }

  nextPage(fromAutoScroll = false) {
     if (this.isEpub()) {
        if (this.epubRendition) {
            const loc = this.epubRendition.location;
            if (loc && loc.atEnd && this.nextFile()) {
                if (fromAutoScroll && this.config.nextFileBehavior() !== 'auto') {
                    this.toggleAutoScroll();
                } else if (this.config.nextFileBehavior() === 'suggest') {
                    this.showEndOverlay.set(true);
                } else if (this.config.nextFileBehavior() === 'auto') {
                    this.openFile(this.nextFile()!.id);
                }
            } else {
                this.epubRendition.next();
            }
        }
        return;
     }
     if (this.currentPage() < this.pages().length - 1) {
        this.currentPage.update(v => v + 1);
        if (this.fileMeta()?.extension === 'pdf') this.reRenderPdfHorizontal();
     } else if (this.nextFile()) {
         if (fromAutoScroll && this.config.nextFileBehavior() !== 'auto') {
             this.toggleAutoScroll();
         } else if (this.config.nextFileBehavior() === 'suggest') {
             this.showEndOverlay.set(true);
         } else if (this.config.nextFileBehavior() === 'auto') {
             this.openFile(this.nextFile()!.id);
         }
     }
  }

  prevPage() {
     if (this.isEpub()) {
        if (this.epubRendition) {
            const loc = this.epubRendition.location;
            if (loc && loc.atStart && this.previousFile() && this.config.nextFileBehavior() !== 'off') {
                this.openFile(this.previousFile()!.id);
            } else {
                this.epubRendition.prev();
            }
        }
        return;
     }
     if (this.currentPage() > 0) {
        this.currentPage.update(v => v - 1);
        if (this.fileMeta()?.extension === 'pdf') this.reRenderPdfHorizontal();
     } else if (this.previousFile() && this.config.nextFileBehavior() !== 'off') {
         this.openFile(this.previousFile()!.id);
     }
  }

  goToPage(index: number) {
     this.currentPage.set(index);
     if (this.isEpub()) {
         const page = this.pages()[index];
         if (page && page.url.startsWith('epub-chapter:')) {
             const href = page.url.replace('epub-chapter:', '');
             if (this.epubRendition) {
                if (href !== 'start') this.epubRendition.display(href);
                else this.epubRendition.display();
             }
         }
         return;
     }
     
     if (this.readMode() === 'vertical') {
        this.isProgrammaticScroll = true;
        document.getElementById('page-' + index)?.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => this.isProgrammaticScroll = false, 1000);
     } else if (this.fileMeta()?.extension === 'pdf') {
        this.reRenderPdfHorizontal();
     }
  }

  async reRenderPdfHorizontal() {
      // Re-render logic when changing pages in horizontal model
      const meta = this.fileMeta();
      if (meta?.extension === 'pdf' && this.pdfDoc) {
         setTimeout(async () => {
             this.renderPDF(this.pdfDoc);
         }, 50);
      }
  }

  renderEpub() {
      const mode = this.readMode();
      const targetId = mode === 'vertical' ? 'epub-container' : 'epub-container-horiz';
      
      const render = () => {
          const target = document.getElementById(targetId);
          if (target && this.epubBook) {
              let currentLocation: string | undefined = undefined;
              if (this.epubRendition) {
                  try { currentLocation = this.epubRendition.location?.start?.cfi; } catch (e) {}
                  this.epubRendition.destroy();
              }
              this.epubRendition = this.epubBook.renderTo(targetId, {
                  width: "100%",
                  height: "100%",
                  spread: "none",
                  manager: "continuous",
                  flow: mode === 'vertical' ? "scrolled" : "paginated"
              });
              this.epubRendition.display(currentLocation).then(() => {
                  console.log('EPUB rendered successfully');
              }).catch((err: any) => {
                  console.error('EPUB rendering failed:', err);
              });
              
              this.epubRendition.on('relocated', (location: any) => {
                  if (location.atEnd && this.nextFile() && this.config.nextFileBehavior() === 'auto') {
                      if (!this.autoAdvanceTimeout) {
                          this.autoAdvanceTimeout = setTimeout(() => {
                              this.openFile(this.nextFile()!.id);
                          }, 3000);
                      }
                  } else {
                      if (this.autoAdvanceTimeout) {
                          clearTimeout(this.autoAdvanceTimeout);
                          this.autoAdvanceTimeout = null;
                      }
                  }
              });
          } else {
              setTimeout(render, 100);
          }
      };
      render();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          if (this.readMode() === 'horizontal') this.nextPage();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          if (this.readMode() === 'horizontal') this.prevPage();
      }
  }
}
