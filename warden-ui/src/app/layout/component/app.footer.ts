import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-footer',
  template: `<div class="layout-footer">
        Techanv Warden by
        <a href="https://techanv.com" target="_blank" rel="noopener noreferrer" class="text-primary font-bold hover:underline">Techanv Consulting</a>
    </div>`
})
export class AppFooter {}
