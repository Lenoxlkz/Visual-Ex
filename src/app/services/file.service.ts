import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface AppFile {
  id: string;
  name: string;
  type: 'folder' | 'file';
  extension?: string;
  mimeType?: string;
  size?: number;
  parentId: string; // use "root" instead of null
  createdAt: number;
  lastOpened?: number;
}

interface AppDB extends DBSchema {
  files: {
    key: string;
    value: AppFile; // No longer contains 'content'
    indexes: { 'by-parent': string, 'by-lastOpened': number };
  };
  'file-contents': {
    key: string;
    value: Blob;
  };
  'sync-settings': {
    key: string;
    value: any;
  };
}

@Injectable({ providedIn: 'root' })
export class FileService {
  private dbPromise: Promise<IDBPDatabase<AppDB>>;
  
  // Using a signal to notify the UI when files change
  filesChanged = signal<number>(0);

  private router = inject(Router);

  constructor() {
    this.dbPromise = openDB<AppDB>('file-viewer-db', 4, {
      async upgrade(db, oldVersion, newVersion, transaction) {
        let store;
        if (oldVersion < 1) {
          store = db.createObjectStore('files', { keyPath: 'id' });
          store.createIndex('by-parent', 'parentId');
        } else {
          store = transaction.objectStore('files');
        }
        if (oldVersion < 2) {
          store.createIndex('by-lastOpened', 'lastOpened');
        }
        if (oldVersion < 3) {
          const contentStore = db.createObjectStore('file-contents');
          let cursor = await store.openCursor();
          while (cursor) {
            const val = cursor.value as any;
            if (val.content) {
              await contentStore.put(val.content, val.id);
              delete val.content;
              await cursor.update(val);
            }
            cursor = await cursor.continue();
          }
        }
        if (oldVersion < 4) {
          db.createObjectStore('sync-settings');
        }
      },
    });

    this.initLaunchQueue();
  }

  private initLaunchQueue() {
    if ('launchQueue' in window) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (!launchParams.files || !launchParams.files.length) return;
        
        await this.dbPromise;
        let lastStoredId: string | null = null;
        
        for (const handle of launchParams.files) {
           const file = await handle.getFile();
           lastStoredId = await this.storeFile(file, 'root');
        }

        if (lastStoredId) {
           this.router.navigate(['/view', lastStoredId]);
        }
      });
    }
  }

  async getRecentFiles(limit: number = 30): Promise<AppFile[]> {
    const db = await this.dbPromise;
    const tx = db.transaction('files', 'readonly');
    const index = tx.store.index('by-lastOpened');
    let cursor = await index.openCursor(null, 'prev'); // sort descending
    const results: AppFile[] = [];
    
    while (cursor && results.length < limit) {
      if (cursor.value.lastOpened) {
          results.push(cursor.value);
      }
      cursor = await cursor.continue();
    }
    return results;
  }

  async updateLastOpened(id: string): Promise<void> {
    const db = await this.dbPromise;
    const item = await db.get('files', id);
    if (item) {
        item.lastOpened = Date.now();
        await db.put('files', item);
        this.notifyChanged();
    }
  }

  async getFilesByParent(parentId: string = 'root'): Promise<AppFile[]> {
    const db = await this.dbPromise;
    const tx = db.transaction('files', 'readonly');
    const index = tx.store.index('by-parent');
    let cursor = await index.openCursor(parentId);
    const results: AppFile[] = [];
    
    while (cursor) {
      results.push(cursor.value);
      cursor = await cursor.continue();
    }
    return results;
  }

  async getFileMetadata(id: string): Promise<AppFile | undefined> {
    const db = await this.dbPromise;
    return await db.get('files', id);
  }

  async getFileContent(id: string): Promise<Blob | undefined> {
    const db = await this.dbPromise;
    return await db.get('file-contents', id);
  }

  async createFolder(name: string, parentId: string = 'root'): Promise<string> {
    const db = await this.dbPromise;
    const id = crypto.randomUUID();
    await db.put('files', {
      id,
      name,
      type: 'folder',
      parentId,
      createdAt: Date.now()
    });
    this.notifyChanged();
    return id;
  }

  async storeFile(file: File, parentId: string = 'root'): Promise<string> {
    const db = await this.dbPromise;
    const id = crypto.randomUUID();
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    const tx = db.transaction(['files', 'file-contents'], 'readwrite');
    await tx.objectStore('file-contents').put(file, id);
    await tx.objectStore('files').put({
      id,
      name: file.name,
      type: 'file',
      extension,
      mimeType: file.type,
      size: file.size,
      parentId,
      createdAt: Date.now()
    });
    await tx.done;
    
    this.notifyChanged();
    return id;
  }

  async deleteItem(id: string): Promise<void> {
    const db = await this.dbPromise;
    const item = await db.get('files', id);
    if (!item) return;

    if (item.type === 'folder') {
      // recursively delete children
      const children = await this.getFilesByParent(id);
      for (const child of children) {
        await this.deleteItem(child.id);
      }
    }
    const tx = db.transaction(['files', 'file-contents'], 'readwrite');
    await tx.objectStore('file-contents').delete(id);
    await tx.objectStore('files').delete(id);
    await tx.done;
    
    this.notifyChanged();
  }

  async convertPdfToEpub(fileMeta: AppFile): Promise<string> {
      if (fileMeta.extension !== 'pdf') throw new Error('Not a pdf');
      const blob = await this.getFileContent(fileMeta.id);
      if (!blob) throw new Error('File content not found');

      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      
      let pagesData: { items: any[] }[] = [];
      let baseFontSize = 12; // Initial guess
      let fontSizes: Record<number, number> = {};

      for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContentObj = await page.getTextContent();
          const items = (textContentObj.items as any[]).filter(item => item.str.trim().length > 0 || item.hasEOL);
          pagesData.push({ items });

          for (const item of items) {
             if (item.str.trim()) {
                 const size = Math.round(item.transform[0]);
                 fontSizes[size] = (fontSizes[size] || 0) + 1;
             }
          }
      }

      // Determine the most common font size to act as the base un-styled text (paragraph text)
      let maxCount = 0;
      for (const size in fontSizes) {
          if (fontSizes[size] > maxCount) {
             maxCount = fontSizes[size];
             baseFontSize = Number(size);
          }
      }

      const escapeHtml = (text: string) => {
          return text.replace(/&/g, "&amp;")
                     .replace(/</g, "&lt;")
                     .replace(/>/g, "&gt;")
                     .replace(/"/g, "&quot;")
                     .replace(/'/g, "&#039;");
      }

      let parsedContentHtml = ``;
      let tocItems: { id: string, title: string, level: number }[] = [];
      let headingCount = 0;

      for (let i = 0; i < pagesData.length; i++) {
          const items = pagesData[i].items;

          // Sort items by Y descending, then X ascending
          items.sort((a, b) => {
              const yA = Math.round(a.transform[5]);
              const yB = Math.round(b.transform[5]);
              if (Math.abs(yA - yB) < 5) {
                  return a.transform[4] - b.transform[4];
              }
              return yB - yA;
          });

          // Group into lines
          let lines: { text: string, y: number, fontSize: number, isBold: boolean, minX: number }[] = [];
          let currentLine: any[] = [];
          let lastY = -1;

          for (const item of items) {
              const y = Math.round(item.transform[5]);
              if (lastY === -1 || Math.abs(lastY - y) < 5) {
                  currentLine.push(item);
                  if (lastY === -1) lastY = y;
              } else {
                  if (currentLine.length > 0) {
                      const text = currentLine.map(t => t.str).join(' ').replace(/\s+/g, ' ');
                      if (text.trim()) {
                         const size = Math.round(currentLine[0].transform[0]);
                         const fontName = currentLine[0].fontName || '';
                         lines.push({
                             text: text,
                             y: lastY,
                             fontSize: size,
                             isBold: fontName.toLowerCase().includes('bold'),
                             minX: Math.min(...currentLine.map(t => t.transform[4]))
                         });
                      }
                  }
                  currentLine = [item];
                  lastY = y;
              }
          }

          if (currentLine.length > 0) {
              const text = currentLine.map(t => t.str).join(' ').replace(/\s+/g, ' ');
              if (text.trim()) {
                 const size = Math.round(currentLine[0].transform[0]);
                 const fontName = currentLine[0].fontName || '';
                 lines.push({
                     text: text,
                     y: lastY,
                     fontSize: size,
                     isBold: fontName.toLowerCase().includes('bold'),
                     minX: Math.min(...currentLine.map(t => t.transform[4]))
                 });
              }
          }

          // Group lines into paragraphs or headers
          let currentParagraph: string[] = [];
          
          for (let j = 0; j < lines.length; j++) {
              const line = lines[j];
              const isHeading = line.fontSize > baseFontSize + 2 || (line.isBold && line.fontSize > baseFontSize);
              
              if (isHeading) {
                  // Flush paragraph
                  if (currentParagraph.length > 0) {
                      parsedContentHtml += `<p>${escapeHtml(currentParagraph.join(' '))}</p>\n`;
                      currentParagraph = [];
                  }
                  let hLevel = line.fontSize > baseFontSize + 6 ? 1 : 2;
                  headingCount++;
                  const headingId = `heading-\${headingCount}`;
                  tocItems.push({ id: headingId, title: line.text, level: hLevel });
                  parsedContentHtml += `<h\${hLevel} id="\${headingId}">\${escapeHtml(line.text)}</h\${hLevel}>\n`;
              } else {
                 currentParagraph.push(line.text.trim());
                 
                 // Smart paragraph break: if the next line is far away, or shifted, break
                 if (j < lines.length - 1) {
                     const nextLine = lines[j+1];
                     const distance = Math.abs(line.y - nextLine.y);
                     const isNextHeading = nextLine.fontSize > baseFontSize + 2;
                     const isIndent = Math.abs(nextLine.minX - line.minX) > 20;

                     // Typically lines in a paragraph are apart by 1-2 times the font size
                     if (distance > line.fontSize * 2 || isNextHeading || isIndent) {
                         if (currentParagraph.length > 0) {
                             parsedContentHtml += `<p>${escapeHtml(currentParagraph.join(' '))}</p>\n`;
                             currentParagraph = [];
                         }
                     }
                 }
              }
          }
          if (currentParagraph.length > 0) {
              parsedContentHtml += `<p>${escapeHtml(currentParagraph.join(' '))}</p>\n`;
          }
      }

      const parse5 = await import('parse5');
      // Create a fragment and serialize it back to ensure valid and sanitized tags
      const documentFragment = parse5.parseFragment(parsedContentHtml);
      const sanitizedHtml = parse5.serialize(documentFragment);

      const JSZip = await import('jszip').then((m:any) => m.default || m);
      const zip = new JSZip();

      zip.file('mimetype', 'application/epub+zip');
      const metaInf = zip.folder('META-INF')!;
      metaInf.file('container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

      const oebps = zip.folder('OEBPS')!;
      
      const htmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>Book Content</title>
</head>
<body>
    ${sanitizedHtml}
</body>
</html>`;

      oebps.file('chapter.xhtml', htmlContent);
      
      const bookId = crypto.randomUUID();
      const title = fileMeta.name.replace('.pdf', '');

      oebps.file('content.opf', `<?xml version="1.0"?>
<package version="3.0" unique-identifier="BookId" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:language>es</dc:language>
    <dc:identifier id="BookId">urn:uuid:${bookId}</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter1"/>
  </spine>
</package>`);

      let navPointsHtml = '';
      if (tocItems.length === 0) {
          navPointsHtml = `<navPoint id="navPoint-1" playOrder="1">
      <navLabel>
        <text>Start</text>
      </navLabel>
      <content src="chapter.xhtml"/>
    </navPoint>`;
      } else {
          navPointsHtml = tocItems.map((item, idx) => `
    <navPoint id="navPoint-\${idx+1}" playOrder="\${idx+1}">
      <navLabel>
        <text>\${escapeHtml(item.title)}</text>
      </navLabel>
      <content src="chapter.xhtml#\${item.id}"/>
    </navPoint>`).join('\n');
      }

      oebps.file('toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${bookId}"/>
  </head>
  <docTitle>
    <text>${escapeHtml(title)}</text>
  </docTitle>
  <navMap>
${navPointsHtml}
  </navMap>
</ncx>`);

      const epubBlob = await zip.generateAsync({ type: 'blob' });
      const newFile = new File([epubBlob], title + '.epub', { type: 'application/epub+zip' });
      return await this.storeFile(newFile, fileMeta.parentId);
  }

  async clearAll(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(['files', 'file-contents'], 'readwrite');
    await tx.objectStore('files').clear();
    await tx.objectStore('file-contents').clear();
    await tx.done;
    this.notifyChanged();
  }

  async getTotalSize(): Promise<number> {
    const db = await this.dbPromise;
    const files = await db.getAll('files');
    return files.reduce((acc, file) => acc + (file.size || 0), 0);
  }

  private notifyChanged() {
    this.filesChanged.update(v => v + 1);
  }
}

