import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Lang = 'es' | 'en';

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  es: {
    'Library': 'Biblioteca',
    'Upload Files': 'Subir Archivos',
    'Upload Folder': 'Subir Carpeta',
    'New Folder': 'Nueva Carpeta',
    'Back': 'Atrás',
    'Empty Folder': 'No hay archivos en esta carpeta.',
    'Empty Desc': 'Sube archivos locales o carpetas completas de manera masiva. Se organizarán automáticamente.',
    'Folder': 'Carpeta',
    'File': 'Archivo',
    'Open': 'Abrir',
    'Convert to EPUB': 'Convertir a EPUB',
    'Converting': 'Convirtiendo...',
    'Delete': 'Eliminar',
    'Cancel': 'Cancelar',
    'Delete Confirm': '¿Eliminar este elemento permanentemente?',
    'New Folder Name': 'Nombre de la nueva carpeta:',
    'Convert Error': 'Error al convertir PDF a EPUB',
    'Clear All': 'Refrescar',
    'Clear All Confirm': '¿Eliminar TODOS los archivos y carpetas? Esta acción es irreversible.',
    'Total Size': 'Peso Total',
    'Switch Lang': 'English',
    'Recents': 'Recientes',
    'Recents Desc': 'Archivos y carpetas abiertos recientemente.',
    'Empty Recents': 'No hay elementos recientes.',
    'Empty Recents Desc': 'Los archivos y carpetas que abras aparecerán aquí.',
    'Home': 'Inicio',
    'Theme': 'Tema',
    'Scale': 'Escala',
    'Loading': 'Cargando...',
    'Start': 'Inicio',
    'Welcome Title': 'Bienvenido a Visual X',
    'Welcome Desc': 'Tu visor seguro de documentos y cómics locales.',
    'Welcome Feature 1': '<b>Soporte Multiformato:</b> Lee archivos PDF, ePub, CBZ, CBR, Word, archivos RAR y ZIP sin protección y galerías de imágenes.',
    'Welcome Feature 2': '<b>Conversión Inteligente:</b> Realiza conversiones de PDF a ePUB.',
    'Welcome Feature 3': '<b>Modos de Lectura:</b> Disfruta de scroll vertical fluido, cambio de página horizontal y Auto-scroll disponible.',
    'Welcome Feature 4': '<b>Librería Organizada:</b> Crea carpetas y organiza todos tus documentos de manera fácil.',
    'Welcome Attention': 'ⓘ <b>Atención:</b> Archivos sumamente pesados pueden exceder la capacidad estándar de procesamiento del navegador, lo que podría causar errores, bloqueos en la web o incluso muerte del navegador. Se recomienda evitar la carga de archivos muy o sumamente pesados para asegurar un funcionamiento óptimo.<br><br>->Para dispositivos con poca RAM se recomienda no subir archivos pesados superior a 300-400mb.<br>-Dispositivos con mayor RAM a 6Gb o 8Gb, pueden subir archivos pesados pero con moderación.<br>->Dispositivos con mayor RAM a 12Gb o 16Gb, pueden subir archivos pesados sin alto riesgo de navegador muerto.',
    'Dont Show Again': 'Dejar de mostrar de ahora en adelante',
    'Continue': 'Continuar',
    'Settings': 'Ajustes',
    'Theme Light': 'Claro',
    'Theme Dark': 'Oscuro',
    'Theme Auto': 'Auto',
    'Next File': 'Siguiente Archivo',
    'Next File Off': 'Desactivado',
    'Next File Suggest': 'Sugerir al terminar',
    'Next File Auto': 'Abrir Automáticamente',
    'Report': 'Reportar',
    'Report Problem': 'Reportar Problema',
    'Report Problem Desc': '¿Tienes un error o problema que reportar? Puedes hacerlo a través de aquí:',
    'Finished': 'Has llegado al final.',
    'Next File Available': 'Siguiente archivo disponible',
    'Continue Reading': 'Continuar leyendo',
    'Previous': 'Anterior',
    'Sync': 'Sincronización',
    'Sync Desc': 'Configura la sincronización y lectura automática de archivos y directorios del dispositivo.',
    'Sync Individual': 'Sincronización individual masiva',
    'Sync Individual Desc': 'Selecciona una carpeta entera del almacenamiento del dispositivo para que la app web lea completamente esa carpeta, suba automáticamente todos los archivos compatibles.',
    'Sync Total': 'Sincronización total con almacenamiento',
    'Sync Total Desc': 'Otorga permiso total para leer completamente todo el almacenamiento del dispositivo, buscar los archivos compatibles y subirlos automáticamente.',
    'Sync Periodic': 'Leer periódicamente la carpeta/almacenamiento',
    'Sync Now': 'Sincronizar Ahora',
    'Sync Off': 'Desactivado',
    'Sync Interval 6h': 'Cada 6 horas',
    'Sync Interval 12h': 'Cada 12 horas',
    'Sync Interval 24h': 'Cada 24 horas',
    'Sync Interval 32h': 'Cada 32 horas',
    'Sync Interval 48h': 'Cada 48 horas',
    'Sync Interval 7d': 'Cada 7 días',
    'Sync Interval 15d': 'Cada 15 días',
    'Sync Interval 30d': 'Cada 30 días',
    'Sync Interval 60d': 'Cada 60 días',
    'Sync Interval 90d': 'Cada 90 días',
    'Not Allowed': 'No permitido'
  },
  en: {
    'Library': 'Library',
    'Upload Files': 'Upload Files',
    'Upload Folder': 'Upload Folder',
    'New Folder': 'New Folder',
    'Back': 'Back',
    'Empty Folder': 'No files in this folder.',
    'Empty Desc': 'Upload local files or entire folders in bulk. They will be organized automatically.',
    'Folder': 'Folder',
    'File': 'File',
    'Open': 'Open',
    'Convert to EPUB': 'Convert to EPUB',
    'Converting': 'Converting...',
    'Delete': 'Delete',
    'Cancel': 'Cancel',
    'Delete Confirm': 'Delete this item permanently?',
    'New Folder Name': 'New folder name:',
    'Convert Error': 'Error converting PDF to EPUB',
    'Clear All': 'Refresh',
    'Clear All Confirm': 'Delete ALL files and folders? This action cannot be undone.',
    'Total Size': 'Total Size',
    'Switch Lang': 'Español',
    'Recents': 'Recents',
    'Recents Desc': 'Recently opened files and folders.',
    'Empty Recents': 'No recent items.',
    'Empty Recents Desc': 'Files and folders you open will appear here.',
    'Home': 'Home',
    'Theme': 'Theme',
    'Scale': 'Scale',
    'Loading': 'Loading...',
    'Start': 'Start',
    'Welcome Title': 'Welcome to Visual X',
    'Welcome Desc': 'Your secure local document and comic viewer.',
    'Welcome Feature 1': '<b>Multi-format Support:</b> Read PDF, ePub, CBZ, CBR, Word, unprotected RAR and ZIP archives, and image galleries.',
    'Welcome Feature 2': '<b>Smart Conversion:</b> Perform smart PDF to ePUB conversions.',
    'Welcome Feature 3': '<b>Reading Modes:</b> Enjoy fluid vertical scroll, horizontal page turn, and Auto-scroll available.',
    'Welcome Feature 4': '<b>Organized Library:</b> Create folders and easily organize all your documents.',
    'Welcome Attention': 'ⓘ <b>Attention:</b> Extremely heavy files may exceed the browser\'s standard processing capacity, which could cause errors, web crashes or even browser death. It is recommended to avoid uploading very or extremely heavy files to ensure optimal performance.<br><br>->For low RAM devices, it is recommended not to upload heavy files exceeding 300-400mb.<br>-Devices with RAM greater than 6Gb or 8Gb can upload heavy files but with moderation.<br>->Devices with RAM greater than 12Gb or 16Gb can upload heavy files without high risk of a dead browser.',
    'Dont Show Again': 'Do not show this again',
    'Continue': 'Continue',
    'Settings': 'Settings',
    'Theme Light': 'Light',
    'Theme Dark': 'Dark',
    'Theme Auto': 'Auto',
    'Next File': 'Next File',
    'Next File Off': 'Disabled',
    'Next File Suggest': 'Suggest at end',
    'Next File Auto': 'Open Automatically',
    'Report': 'Report',
    'Report Problem': 'Report Problem',
    'Report Problem Desc': 'Have an error or problem to report? You can do it through here:',
    'Finished': 'You have reached the end.',
    'Next File Available': 'Next file available',
    'Continue Reading': 'Continue reading',
    'Previous': 'Previous',
    'Sync': 'Synchronization',
    'Sync Desc': 'Configure automatic reading and synchronization of device files and directories.',
    'Sync Individual': 'Individual Bulk Sync',
    'Sync Individual Desc': 'Select a complete folder from device storage so the web app can read it entirely and automatically upload compatible files.',
    'Sync Total': 'Total Storage Sync',
    'Sync Total Desc': 'Grant full permission to read the entire device storage, find compatible files and automatically upload them.',
    'Sync Periodic': 'Periodically read folder/storage',
    'Sync Now': 'Sync Now',
    'Sync Off': 'Off',
    'Sync Interval 6h': 'Every 6 hours',
    'Sync Interval 12h': 'Every 12 hours',
    'Sync Interval 24h': 'Every 24 hours',
    'Sync Interval 32h': 'Every 32 hours',
    'Sync Interval 48h': 'Every 48 hours',
    'Sync Interval 7d': 'Every 7 days',
    'Sync Interval 15d': 'Every 15 days',
    'Sync Interval 30d': 'Every 30 days',
    'Sync Interval 60d': 'Every 60 days',
    'Sync Interval 90d': 'Every 90 days',
    'Not Allowed': 'Not allowed'
  }
};

@Injectable({
  providedIn: 'root'
})
export class LangService {
  currentLang = signal<Lang>('es');
  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initLang();
    }
  }

  initLang() {
    const saved = localStorage.getItem('lang') as Lang | null;
    if (saved) {
      this.currentLang.set(saved);
    } else {
      const browserLang = navigator.language.split('-')[0].toLowerCase();
      const lang: Lang = browserLang === 'es' ? 'es' : 'en';
      this.currentLang.set(lang);
      localStorage.setItem('lang', lang);
    }
  }

  t(key: string): string {
    return TRANSLATIONS[this.currentLang()][key] || key;
  }

  toggle() {
    const newLang = this.currentLang() === 'es' ? 'en' : 'es';
    this.currentLang.set(newLang);
    localStorage.setItem('lang', newLang);
  }
}
