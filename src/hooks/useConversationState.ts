import { useState } from 'react';
import { ChatMessage, EvaluationResult } from '@/actions/gemini';

type Phase = 'topic-input' | 'conversation' | 'questions' | 'finished';

interface ConversationState {
  phase: Phase;
  internalTopic: string;
  topicInput: string;
  messages: ChatMessage[];
  framing: string;
  isProcessing: boolean;
  isGeneratingAudio: number | null;
  currentEvaluation: EvaluationResult | null;
  showEvaluation: boolean;
  playCounts: Record<number, number>;
  visibleTexts: Record<number, boolean>;
  inputText: string;
}

interface UseConversationStateReturn extends ConversationState {
  setPhase: (phase: Phase) => void;
  setInternalTopic: (topic: string) => void;
  setTopicInput: (input: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setFraming: (framing: string) => void;
  setIsProcessing: (processing: boolean) => void;
  setIsGeneratingAudio: (index: number | null) => void;
  setCurrentEvaluation: (evaluation: EvaluationResult | null) => void;
  setShowEvaluation: (show: boolean) => void;
  incrementPlayCount: (index: number) => void;
  toggleVisibleText: (index: number) => void;
  setInputText: (text: string) => void;
}

export function useConversationState(topicProp: string): UseConversationStateReturn {
  const [phase, setPhase] = useState<Phase>(topicProp ? 'conversation' : 'topic-input');
  const [internalTopic, setInternalTopic] = useState(topicProp);
  const [topicInput, setTopicInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [framing, setFraming] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<number | null>(null);
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(null);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [playCounts, setPlayCounts] = useState<Record<number, number>>({});
  const [visibleTexts, setVisibleTexts] = useState<Record<number, boolean>>({});
  const [inputText, setInputText] = useState('');

  const incrementPlayCount = (index: number) => {
    setPlayCounts(prev => ({ ...prev, [index]: (prev[index] || 0) + 1 }));
  };

  const toggleVisibleText = (index: number) => {
    setVisibleTexts(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return {
    phase,
    internalTopic,
    topicInput,
    messages,
    framing,
    isProcessing,
    isGeneratingAudio,
    currentEvaluation,
    showEvaluation,
    playCounts,
    visibleTexts,
    inputText,
    setPhase,
    setInternalTopic,
    setTopicInput,
    setMessages,
    setFraming,
    setIsProcessing,
    setIsGeneratingAudio,
    setCurrentEvaluation,
    setShowEvaluation,
    incrementPlayCount,
    toggleVisibleText,
    setInputText,
  };
}
