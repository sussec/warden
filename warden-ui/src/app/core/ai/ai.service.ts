import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {FindingSeverity} from '../../api/models/finding-severity';

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

export interface SemanticSearchResult {
  id: string;
  name: string;
  location?: string;
  severity: FindingSeverity;
  status: string;
  projectId: string;
  score: number;
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

  backfillEmbeddings(): Observable<{ processed: number }> {
    return this.http.post<{ processed: number }>('/api/ai/semantic-search/backfill', {});
  }

  semanticSearch(query: string, projectId?: string, top?: number): Observable<SemanticSearchResult[]> {
    return this.http.post<SemanticSearchResult[]>('/api/ai/semantic-search', {
      query,
      projectId,
      top
    });
  }
}
