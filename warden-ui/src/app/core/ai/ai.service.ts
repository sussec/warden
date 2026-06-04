import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface AiSetting {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
  embeddingModel: string;
}

export interface AiSuggestion {
  content: string;
  model: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {

  constructor(private http: HttpClient) {
  }

  getAiSetting(): Observable<AiSetting> {
    return this.http.get<AiSetting>('/api/setting/ai');
  }

  updateAiSetting(setting: AiSetting): Observable<AiSetting> {
    return this.http.post<AiSetting>('/api/setting/ai', setting);
  }

  testAiSetting(setting: AiSetting): Observable<boolean> {
    return this.http.post<boolean>('/api/setting/ai/test', setting);
  }

  getAiSuggestion(findingId: string): Observable<AiSuggestion> {
    return this.http.post<AiSuggestion>(`/api/finding/${findingId}/ai-suggestion`, {});
  }
}
