import {Component, OnInit} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {finalize} from 'rxjs';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {Password} from 'primeng/password';
import {ToggleSwitch} from 'primeng/toggleswitch';
import {Select} from 'primeng/select';
import {AiService, AiSetting} from '../../../../core/ai/ai.service';
import {ToastrService} from '../../../../shared/services/toastr.service';

interface ProviderPreset {
  label: string;
  value: string;
  // endpoint to prefill; null means leave the endpoint untouched (Custom)
  endpoint: string | null;
  modelPlaceholder: string;
  embeddingPlaceholder: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    label: 'OpenAI',
    value: 'openai',
    endpoint: '',
    modelPlaceholder: 'gpt-4.1-mini',
    embeddingPlaceholder: 'text-embedding-3-small'
  },
  {
    label: 'Azure OpenAI',
    value: 'azure',
    endpoint: 'https://YOUR-RESOURCE.openai.azure.com/openai/v1',
    modelPlaceholder: 'your deployment name',
    embeddingPlaceholder: 'your embedding deployment name'
  },
  {
    label: 'Anthropic Claude',
    value: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1',
    modelPlaceholder: 'claude-sonnet-4-6',
    embeddingPlaceholder: 'no embeddings — leave empty'
  },
  {
    label: 'Google Gemini',
    value: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelPlaceholder: 'gemini-2.5-flash',
    embeddingPlaceholder: 'gemini-embedding-001'
  },
  {
    label: 'Ollama (local)',
    value: 'ollama',
    endpoint: 'http://localhost:11434/v1',
    modelPlaceholder: 'llama3.3',
    embeddingPlaceholder: 'nomic-embed-text'
  },
  {
    label: 'LM Studio (local)',
    value: 'lmstudio',
    endpoint: 'http://localhost:1234/v1',
    modelPlaceholder: 'your loaded model',
    embeddingPlaceholder: 'your embedding model'
  },
  {
    label: 'Groq',
    value: 'groq',
    endpoint: 'https://api.groq.com/openai/v1',
    modelPlaceholder: 'llama-3.3-70b-versatile',
    embeddingPlaceholder: 'your embedding model'
  },
  {
    label: 'OpenRouter',
    value: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1',
    modelPlaceholder: 'openai/gpt-4.1-mini',
    embeddingPlaceholder: 'your embedding model'
  },
  {
    label: 'Custom',
    value: 'custom',
    endpoint: null,
    modelPlaceholder: 'gpt-4.1-mini / llama3.3',
    embeddingPlaceholder: 'text-embedding-3-small / nomic-embed-text'
  }
];

@Component({
  selector: 'app-ai-setting',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    InputText,
    Password,
    Button,
    ToggleSwitch,
    Select
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
  loadingBackfill = false;
  providerPresets = PROVIDER_PRESETS;
  selectedProvider = 'custom';

  constructor(
    private aiService: AiService,
    private toastr: ToastrService
  ) {
  }

  ngOnInit(): void {
    this.aiService.getAiSetting().subscribe(setting => {
      this.aiSetting = setting;
      this.selectedProvider = this.inferProvider(setting.endpoint);
    })
  }

  get currentPreset(): ProviderPreset {
    return this.providerPresets.find(p => p.value === this.selectedProvider)
      ?? this.providerPresets[this.providerPresets.length - 1];
  }

  onProviderChange(value: string) {
    this.selectedProvider = value;
    const preset = this.providerPresets.find(p => p.value === value);
    // Custom (endpoint === null) leaves the endpoint untouched.
    if (preset && preset.endpoint !== null) {
      this.aiSetting.endpoint = preset.endpoint;
    }
  }

  private inferProvider(endpoint: string | null | undefined): string {
    if (!endpoint) {
      // empty endpoint defaults to OpenAI (api.openai.com)
      return 'openai';
    }
    const match = this.providerPresets.find(
      p => p.endpoint && endpoint.startsWith(p.endpoint)
    );
    return match ? match.value : 'custom';
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

  buildSearchIndex() {
    this.loadingBackfill = true;
    this.aiService.backfillEmbeddings().pipe(
      finalize(() => this.loadingBackfill = false)
    ).subscribe(result => {
      this.toastr.success({
        message: `Indexed ${result.processed} findings`
      });
    })
  }

}
