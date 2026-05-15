import React, { useRef, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { Mic, Square, Loader2, Volume2, HelpCircle, CheckCircle, ArrowRight, Send, Wand2, MessageSquare, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChatMessage,
  chatConversationAction,
  chatTextConversationAction,
  simulateUserResponseAction,
  EvaluationResult,
  generateInitialChatAction,
  generateSpeechAction,
  generateQuestionsAction,
  simulateConversationAction,
  Question,
  ACTIVE_MODEL_LABEL,
} from '@/actions/gemini';
import { blobToBase64, pcmToWavBase64 } from '@/lib/audio';
import { ResultCard } from './ResultCard';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useConversationState } from '@/hooks/useConversationState';
import { useQuestionsFlow } from '@/hooks/useQuestionsFlow';
import { ChatShell } from '@/components/ChatShell';
import { MessageBubble, InfoCard } from '@/components/chat';

interface ConversationPracticeProps {
  topic?: string;
  onFinish: () => void;
  noFrame?: boolean;
  onPhaseChange?: (label: string, iter?: string) => void;
  onSessionStart?: (topic: string) => void;
}

export function ConversationPractice({ topic: topicProp = '', onFinish, noFrame, onPhaseChange, onSessionStart }: ConversationPracticeProps) {
  const conv = useConversationState(topicProp);
  const qf = useQuestionsFlow();

  // Stable ref so useAudioRecorder never captures a stale callback
  const onRecordedRef = useRef<(blob: Blob) => void>(() => {});

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: useCallback((blob: Blob) => onRecordedRef.current(blob), []),
    onError: useCallback(() => {
      alert('Por favor, permite el acceso al micrófono.');
    }, []),
  });

  const MAX_TURNS = 12; // ~6 iterations

  useEffect(() => {
    if (!onPhaseChange) return;
    if (conv.phase === 'conversation') {
      const iter = Math.floor(conv.messages.length / 2);
      onPhaseChange('Listening & Speaking', iter > 0 ? `Turno ${iter}` : undefined);
    } else if (conv.phase === 'questions') {
      onPhaseChange('Comprensión', undefined);
    }
  }, [conv.phase, conv.messages.length, onPhaseChange]);

  // Initialize conversation (fires once when internalTopic is first set)
  const initDoneRef = useRef(false);
  useEffect(() => {
    if (initDoneRef.current || !conv.internalTopic) return;
    initDoneRef.current = true;

    const initChat = async () => {
      conv.setIsProcessing(true);
      try {
        const result = await generateInitialChatAction(conv.internalTopic);
        conv.setFraming(result.framing);
        conv.setMessages([{ role: 'model', text: result.message }]);
        setTimeout(() => handleListen(result.message, 0), 500);
      } catch (error) {
        console.error('Failed to init chat:', error);
      } finally {
        conv.setIsProcessing(false);
      }
    };
    initChat();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.internalTopic]);

  const handleListen = async (text: string, index: number) => {
    if (conv.isGeneratingAudio !== null) return;

    conv.setIsGeneratingAudio(index);
    try {
      const { data, mimeType } = await generateSpeechAction(text);
      const audioUrl = pcmToWavBase64(data, mimeType);
      const audio = new Audio(audioUrl);

      conv.incrementPlayCount(index);

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      conv.setIsGeneratingAudio(null);
    }
  };

  const handleSendMessage = async (audioBlob: Blob) => {
    conv.setIsProcessing(true);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];

      const result = await chatConversationAction(
        base64Audio,
        mimeType,
        conv.messages,
        conv.internalTopic
      );

      const userMsg: ChatMessage = { role: 'user', text: result.evaluation.transcribed_text };
      const modelMsg: ChatMessage = { role: 'model', text: result.ai_response };

      const newMessages = [...conv.messages, userMsg, modelMsg];
      conv.setMessages(newMessages);
      conv.setCurrentEvaluation(result.evaluation);
      conv.setShowEvaluation(true);

      // Auto-play the model's response
      const modelMsgIndex = newMessages.length - 1;
      setTimeout(() => handleListen(modelMsg.text, modelMsgIndex), 500);

    } catch (error) {
      console.error('Conversation error:', error);
      alert('Error en la conversación. Inténtalo de nuevo.');
    } finally {
      conv.setIsProcessing(false);
    }
  };

  const handleSendTextMessage = async () => {
    if (!conv.inputText.trim() || conv.isProcessing) return;

    conv.setIsProcessing(true);
    const textToSend = conv.inputText.trim();
    conv.setInputText('');

    try {
      const result = await chatTextConversationAction(
        textToSend,
        conv.messages,
        conv.internalTopic
      );

      const userMsg: ChatMessage = { role: 'user', text: textToSend };
      const modelMsg: ChatMessage = { role: 'model', text: result.ai_response };

      const newMessages = [...conv.messages, userMsg, modelMsg];
      conv.setMessages(newMessages);
      conv.setCurrentEvaluation(result.evaluation);
      conv.setShowEvaluation(true);

      const modelMsgIndex = newMessages.length - 1;
      setTimeout(() => handleListen(modelMsg.text, modelMsgIndex), 500);
    } catch (error) {
      console.error('Text conversation error:', error);
      alert('Error al enviar el mensaje. Inténtalo de nuevo.');
    } finally {
      conv.setIsProcessing(false);
    }
  };

  const handleSimulateResponse = async () => {
    if (conv.isProcessing) return;
    conv.setIsProcessing(true);

    try {
      const simulatedText = await simulateUserResponseAction(conv.messages, conv.internalTopic);

      const result = await chatTextConversationAction(
        simulatedText,
        conv.messages,
        conv.internalTopic
      );

      const userMsg: ChatMessage = { role: 'user', text: simulatedText };
      const modelMsg: ChatMessage = { role: 'model', text: result.ai_response };

      const newMessages = [...conv.messages, userMsg, modelMsg];
      conv.setMessages(newMessages);
      conv.setCurrentEvaluation(result.evaluation);
      conv.setShowEvaluation(true);

      const modelMsgIndex = newMessages.length - 1;
      setTimeout(() => handleListen(modelMsg.text, modelMsgIndex), 500);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      conv.setIsProcessing(false);
    }
  };

  const handleGoToQuestions = async () => {
    conv.setIsProcessing(true);
    try {
      let finalHistory = conv.messages;
      if (conv.messages.length < MAX_TURNS) {
        // Simulate missing turns
        finalHistory = await simulateConversationAction(conv.messages, conv.internalTopic);
        conv.setMessages(finalHistory);
      }

      const aiQuestions = await generateQuestionsAction(finalHistory, conv.internalTopic);
      qf.setQuestions(aiQuestions);
      conv.setPhase('questions');
    } catch (error) {
      console.error('Error switching to questions:', error);
    } finally {
      conv.setIsProcessing(false);
    }
  };

  const handleAnswerQuestion = async (audioBlob: Blob) => {
    conv.setIsProcessing(true);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];

      const currentQuestion = qf.questions[qf.currentQuestionIndex];

      const result = await chatConversationAction(
        base64Audio,
        mimeType,
        conv.messages,
        `Evaluating answer to: ${currentQuestion.question}. Correct info: ${currentQuestion.correct_answer}`
      );

      qf.recordAnswer(qf.currentQuestionIndex, result.evaluation);

      const hasMore = qf.advanceQuestion();
      if (!hasMore) {
        conv.setPhase('finished');
      }
    } catch (error) {
      console.error('Error answering question:', error);
    } finally {
      conv.setIsProcessing(false);
    }
  };

  // Keep the ref in sync — dispatches to conversation or question handler based on current phase
  onRecordedRef.current = async (blob: Blob) => {
    if (conv.phase === 'conversation') {
      await handleSendMessage(blob);
    } else if (conv.phase === 'questions') {
      await handleAnswerQuestion(blob);
    }
  };

  const handleTopicConfirm = () => {
    const t = conv.topicInput.trim();
    if (!t) return;
    conv.setInternalTopic(t);
    onSessionStart?.(t);
    conv.setPhase('conversation');
  };

  // Determine header icon based on input mode (text vs audio)
  // We infer from whether inputText is the active input (text mode) vs recording (audio mode)
  const isTextMode = !isRecording && conv.phase !== 'questions';
  const headerIcon = isTextMode ? MessageSquare : Mic;
  const headerTitle = isTextMode ? 'Bob — Chat' : 'Bob — Conversación';
  const modeLabel =
    conv.phase === 'questions' ? 'EVALUACIÓN DE COMPRENSIÓN' : 'CONVERSACIÓN';

  if (conv.phase === 'finished') {
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-12 bg-white rounded-sm shadow-xl space-y-8">
        <div className="bg-blue-50 p-6 rounded-full">
          <CheckCircle size={64} className="text-blue-600" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">¡Excelente Trabajo!</h2>
          <p className="text-gray-500 font-medium">Has completado la simulación y las preguntas de comprensión.</p>
        </div>
        <Button variant="primary" onClick={onFinish} className="px-12 py-4 text-xl">
          Volver al Inicio
        </Button>
      </div>
    );
  }

  // ── Controls (input slot) ────────────────────────────────────────────────────

  const controlsSlot = (
    <div className="flex-none border-t border-gray-100 bg-white px-4 py-3 space-y-3">
      {/* Evaluation feedback strip */}
      <AnimatePresence>
        {conv.showEvaluation && conv.currentEvaluation && !isRecording && !conv.isProcessing && conv.phase === 'conversation' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="bg-blue-600 text-white font-black text-sm px-2 py-1 rounded-lg">
                {conv.currentEvaluation.score}/100
              </span>
              <p className="text-sm font-medium text-gray-700 italic truncate max-w-xs">
                "{conv.currentEvaluation.feedback}"
              </p>
            </div>
            <button
              onClick={() => conv.setShowEvaluation(false)}
              className="text-xs font-black text-blue-600 uppercase tracking-wider hover:underline shrink-0"
            >
              Ok
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {conv.phase === 'topic-input' && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleTopicConfirm(); }}
          className="flex gap-2"
        >
          <input
            value={conv.topicInput}
            onChange={(e) => conv.setTopicInput(e.target.value)}
            placeholder="Escribe aquí tu tema..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:outline-none text-sm bg-slate-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!conv.topicInput.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send size={18} />
          </button>
        </form>
      )}

      {conv.phase === 'conversation' && (
        <div className="flex flex-col space-y-4">
          {/* Input row */}
          <div className="flex items-center space-x-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={conv.inputText}
                onChange={(e) => conv.setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendTextMessage()}
                placeholder="Escribe tu respuesta..."
                disabled={conv.isProcessing || isRecording}
                className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:border-blue-400 font-medium text-sm"
              />
              <button
                onClick={handleSendTextMessage}
                disabled={!conv.inputText.trim() || conv.isProcessing || isRecording}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2 rounded-full hover:scale-105 transition-transform disabled:opacity-30"
              >
                <Send size={18} />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={conv.isProcessing}
                  className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
                >
                  <Mic size={24} />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="bg-red-500 text-white p-4 rounded-full shadow-lg animate-pulse"
                >
                  <Square size={24} fill="currentColor" />
                </button>
              )}
            </div>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={handleGoToQuestions}
              disabled={conv.isProcessing}
              className="px-4 py-2 text-xs flex items-center space-x-2"
            >
              <ArrowRight size={14} />
              <span>Saltar a Preguntas</span>
            </Button>

            <button
              onClick={handleSimulateResponse}
              disabled={conv.isProcessing || isRecording}
              className="flex items-center space-x-2 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600 disabled:opacity-30"
            >
              <Wand2 size={16} />
              <span>Simular Respuesta</span>
            </button>

            {conv.messages.length >= MAX_TURNS && !conv.isProcessing && (
              <button
                onClick={handleGoToQuestions}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold uppercase text-[10px] flex items-center space-x-2 hover:bg-green-700"
              >
                <span>Evaluar Comprensión</span>
                <CheckCircle size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {conv.phase === 'questions' && (
        <div className="flex items-center justify-center">
          {!isRecording ? (
            <Button
              variant="primary"
              disabled={conv.isProcessing}
              onClick={startRecording}
              className="w-full max-w-[200px] flex items-center justify-center space-x-2 py-4 rounded-full shadow-lg"
            >
              <Mic size={24} />
              <span className="font-bold">Hablar</span>
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={stopRecording}
              className="w-full max-w-[200px] flex items-center justify-center space-x-2 py-4 rounded-full shadow-lg animate-pulse"
            >
              <Square size={24} fill="currentColor" />
              <span className="font-bold">Detener</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );

  // ── Body content ──────────────────────────────────────────────────────────────

  const bodyContent = (
    <>
      <AnimatePresence mode="wait">
        {conv.phase === 'topic-input' && (
          <motion.div
            key="topic-input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <MessageBubble variant="assistant" icon={MessageSquare} accentColor="blue">
              <p>
                ¡Hola! Vamos a tener una conversación en inglés. ¿Sobre qué tema quieres practicar hoy?
                <br />
                <span className="text-gray-400 text-xs">
                  Ej: &quot;En una reunión de trabajo&quot; o &quot;Hablando con un cliente&quot;.
                </span>
              </p>
            </MessageBubble>
          </motion.div>
        )}

        {conv.phase === 'conversation' && (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {conv.framing && (
              <InfoCard title="Escenario" icon={BookOpen}>
                <p className="italic">"{conv.framing}"</p>
              </InfoCard>
            )}

            {conv.messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] relative group ${
                  msg.role === 'user'
                    ? ''
                    : 'min-w-[200px]'
                }`}>
                  <MessageBubble
                    variant={msg.role === 'user' ? 'user' : 'assistant'}
                    icon={MessageSquare}
                    accentColor="blue"
                    noAnimate
                  >
                    {msg.role === 'model' ? (
                      <div className="flex flex-col space-y-2">
                        {conv.visibleTexts[i] ? (
                          <p className="animate-in fade-in slide-in-from-top-1 duration-300">{msg.text}</p>
                        ) : (
                          <div className="flex items-center space-x-2 py-1 text-gray-400">
                            <Volume2 size={16} className="animate-pulse" />
                            <span className="text-sm font-medium italic">Escucha el audio...</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => handleListen(msg.text, i)}
                            disabled={conv.isGeneratingAudio !== null}
                            className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {conv.isGeneratingAudio === i ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Volume2 size={12} />
                            )}
                            <span>{conv.playCounts[i] > 0 ? 'Repetir' : 'Reproducir'}</span>
                          </button>
                          {conv.playCounts[i] >= 2 && (
                            <button
                              onClick={() => conv.toggleVisibleText(i)}
                              className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              <HelpCircle size={14} />
                              <span className="text-[10px] font-black uppercase tracking-tighter">
                                {conv.visibleTexts[i] ? 'Ocultar Texto' : 'Ver Pista'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </MessageBubble>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {conv.phase === 'questions' && (
          <motion.div
            key="questions"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 py-8"
          >
            <div className="text-center space-y-4">
              <div className="inline-block bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                Pregunta {qf.currentQuestionIndex + 1} de {qf.questions.length}
              </div>
              <h3 className="text-2xl font-black text-gray-900 leading-tight">
                {qf.questions[qf.currentQuestionIndex]?.question}
              </h3>
            </div>
            {qf.questionAnswers[qf.currentQuestionIndex] && (
              <div className="bg-white p-4 border border-green-200 rounded-xl">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <span className="font-black text-xs uppercase text-green-600">Feedback</span>
                </div>
                <p className="text-gray-700 font-medium italic">
                  "{qf.questionAnswers[qf.currentQuestionIndex].feedback}"
                </p>
              </div>
            )}
          </motion.div>
        )}

        {conv.isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center space-x-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span className="text-sm font-medium text-gray-500">
                {conv.phase === 'conversation' ? 'Bob está pensando...' : 'Evaluando respuesta...'}
              </span>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  if (noFrame) {
    return (
      <div className="w-full h-full flex flex-col bg-white">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/30">
          {bodyContent}
        </div>
        {controlsSlot}
      </div>
    );
  }

  return (
    <ChatShell
      headerConfig={{
        icon: headerIcon,
        title: headerTitle,
        subtitle: 'SIMULACIÓN B1',
        accentColor: 'blue',
        online: true,
      }}
      footerConfig={{
        modeLabel,
        modelName: ACTIVE_MODEL_LABEL,
      }}
      inputSlot={controlsSlot}
      animationKey={`conversation-${conv.phase}`}
    >
      {bodyContent}
    </ChatShell>
  );
}
