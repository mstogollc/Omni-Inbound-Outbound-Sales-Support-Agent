
export enum Tab {
  LiveAgent = 'liveAgent',
  GroundedChat = 'groundedChat',
  ComplexQuery = 'complexQuery',
  TtsPlayer = 'ttsPlayer',
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  sources?: GroundingSource[];
}

export interface GroundingSource {
    uri: string;
    title: string;
    type: 'web' | 'maps';
}
