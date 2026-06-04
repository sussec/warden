import {Component, OnInit} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {finalize} from 'rxjs';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {Password} from 'primeng/password';
import {ToggleSwitch} from 'primeng/toggleswitch';
import {AiService, AiSetting} from '../../../../core/ai/ai.service';
import {ToastrService} from '../../../../shared/services/toastr.service';

@Component({
  selector: 'app-ai-setting',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    InputText,
    Password,
    Button,
    ToggleSwitch
  ],
  templateUrl: './ai.component.html',
})
export class AiComponent implements OnInit {
  aiSetting: AiSetting = {
    enabled: false,
    endpoint: '',
    apiKey: '',
    model: '',
    embeddingModel: ''
  }
  loading = false;
  loadingTest = false;

  constructor(
    private aiService: AiService,
    private toastr: ToastrService
  ) {
  }

  ngOnInit(): void {
    this.aiService.getAiSetting().subscribe(setting => {
      this.aiSetting = setting;
    })
  }

  saveConfig() {
    this.loading = true;
    this.aiService.updateAiSetting(this.aiSetting).pipe(
      finalize(() => this.loading = false)
    ).subscribe(() => {
      this.toastr.success({
        message: 'Update config success!'
      });
    })
  }

  testConnection() {
    this.loadingTest = true;
    this.aiService.testAiSetting(this.aiSetting).pipe(
      finalize(() => this.loadingTest = false)
    ).subscribe(success => {
      if (success) {
        this.toastr.success({
          message: 'Connection successful!'
        });
      } else {
        this.toastr.error({
          message: 'Connection failed!'
        });
      }
    })
  }

}
