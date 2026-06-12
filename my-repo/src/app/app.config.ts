import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  ErrorHandler,
  isDevMode,
  provideZonelessChangeDetection
} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';

class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const chunkFailedMessage = /Loading chunk [\d]+ failed/;
    if (chunkFailedMessage.test(error.message)) {
      window.location.reload();
    }
    const message = error.message ? error.message : error.toString();
    if (message.includes('ResizeObserver') || message.includes('ResizeObserver loop')) {
      return;
    }
    console.error(error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(), 
    provideRouter(routes),
    {provide: ErrorHandler, useClass: GlobalErrorHandler}
  ],
};
