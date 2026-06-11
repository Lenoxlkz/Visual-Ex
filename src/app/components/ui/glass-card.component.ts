import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-glass-card',
  standalone: true,
  template: `
    <div (click)="handleClick($event)"
         (mousedown)="startHold($event)"
         (touchstart)="startHold($event)"
         (mouseup)="endHold()"
         (touchend)="endHold()"
         (mouseleave)="endHold()"
         class="bg-white/70 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:bg-white/90 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 select-none {{ className() }}">
      <ng-content></ng-content>
    </div>
  `
})
export class GlassCardComponent {
  className = input<string>('');
  clicked = output<void>();
  held = output<void>();
  
  private holdTimeout: any;
  private wasHeld = false;

  startHold(event: Event) {
    this.wasHeld = false;
    this.holdTimeout = setTimeout(() => {
      this.wasHeld = true;
      this.held.emit();
    }, 1700); // 1700ms for long press
  }

  endHold() {
    if (this.holdTimeout) {
      clearTimeout(this.holdTimeout);
      this.holdTimeout = null;
    }
  }

  handleClick(event: Event) {
    if (!this.wasHeld) {
      this.clicked.emit();
    }
    this.wasHeld = false;
  }
}

