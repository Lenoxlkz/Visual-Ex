import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

const originalError = console.error;
console.error = function(...args: any[]) {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('ResizeObserver loop completed with undelivered notifications.')) {
        return;
    }
    if (args[0] && args[0].message && args[0].message.includes('ResizeObserver loop completed with undelivered notifications.')) {
        return;
    }
    originalError.apply(console, args);
};

window.addEventListener('error', e => {
    if (e.message && e.message.includes('ResizeObserver')) {
        e.stopImmediatePropagation();
        e.preventDefault();
    }
}, true);

window.onerror = function(msg, ...args) {
    if (typeof msg === 'string' && msg.includes('ResizeObserver')) {
        return true;
    }
    return false;
};

window.addEventListener('unhandledrejection', (e) => {
    if (e.reason && e.reason.message && (e.reason.message.includes('ResizeObserver loop') || e.reason.message.includes('ResizeObserver'))) {
        e.preventDefault();
        e.stopImmediatePropagation();
    }
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

