import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SelectButtonModule } from 'primeng/selectbutton';
import { LayoutService } from '../layout.service';

/**
 * Layout preferences panel.
 * Theme (colors, radius, typography) is locked to the Warden brand preset
 * (see app/warden.preset.ts) — only layout behavior is configurable here.
 */
@Component({
  selector: 'app-configurator',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectButtonModule],
  template: `
        <div class="flex flex-col gap-4">
            <div *ngIf="showMenuModeButton()" class="flex flex-col gap-2">
                <span class="text-sm text-muted-color font-semibold">Menu Mode</span>
                <p-selectbutton [ngModel]="menuMode()" (ngModelChange)="onMenuModeChange($event)" [options]="menuModeOptions" [allowEmpty]="false" size="small" />
            </div>
        </div>
    `,
  host: {
    class: 'hidden absolute top-[3.25rem] right-0 w-72 p-4 bg-surface-0 dark:bg-surface-900 border border-surface rounded-border origin-top shadow-[0px_3px_5px_rgba(0,0,0,0.02),0px_0px_2px_rgba(0,0,0,0.05),0px_1px_4px_rgba(0,0,0,0.08)]'
  }
})
export class AppConfigurator {
  router = inject(Router);

  layoutService: LayoutService = inject(LayoutService);

  showMenuModeButton = signal(!this.router.url.includes('auth'));

  menuModeOptions = [
    { label: 'Static', value: 'static' },
    { label: 'Overlay', value: 'overlay' }
  ];

  menuMode = computed(() => this.layoutService.layoutConfig().menuMode);

  onMenuModeChange(event: string) {
    this.layoutService.layoutConfig.update((prev) => ({ ...prev, menuMode: event }));
  }
}
