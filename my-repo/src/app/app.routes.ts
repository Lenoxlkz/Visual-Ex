import {Routes} from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./components/library/library.component').then(m => m.LibraryComponent) },
  { path: 'folder/:folderId', loadComponent: () => import('./components/library/library.component').then(m => m.LibraryComponent) },
  { path: 'recents', loadComponent: () => import('./components/recents/recents.component').then(m => m.RecentsComponent) },
  { path: 'viewer/:id', loadComponent: () => import('./components/viewer/viewer.component').then(m => m.ViewerComponent) }
];

