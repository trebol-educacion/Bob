/**
 * Gemini actions — shared type contracts.
 */

export interface EvaluationResult {
  score: number;
  feedback: string;
  transcribed_text: string;
  model_answer?: string;
  details?: {
    content_coverage?: string;
    duration_feedback?: string;
    clarity?: string;
    improvement_tips?: string[];
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatTurnResult {
  evaluation: EvaluationResult;
  ai_response: string;
  ai_audio?: { data: string; mimeType: string };
}

export interface ImageScene {
  description: string;
  image_prompt: string;
  topic: string;
  image_data?: string;
}

export interface InitialChatResult {
  framing: string;
  message: string;
}

export interface Question {
  id: number;
  question: string;
  correct_answer: string;
}

