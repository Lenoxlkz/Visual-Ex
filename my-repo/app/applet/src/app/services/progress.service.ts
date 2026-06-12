import { Injectable, signal } from '@angular/core';

export interface ProgressState {
   visible: boolean;
   message: string;
   current: number;
   total: number;
   percentage: number;
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
   state = signal<ProgressState>({
      visible: false,
      message: '',
      current: 0,
      total: 0,
      percentage: 0
   });

   show(message: string, total: number) {
      this.state.set({ visible: true, message, current: 0, total, percentage: 0 });
   }

   update(current: number, message?: string) {
      this.state.update(s => ({
         ...s,
         current,
         message: message || s.message,
         percentage: s.total > 0 ? Math.round((current / s.total) * 100) : 0
      }));
   }

   hide() {
      setTimeout(() => {
          this.state.update(s => ({ ...s, visible: false }));
      }, 1000);
   }
}
