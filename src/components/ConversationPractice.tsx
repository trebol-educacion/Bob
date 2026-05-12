import React, { useRef, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { Mic, Square, Loader2, Sparkles, Volume2, HelpCircle, CheckCircle, ArrowRight, Send, Wand2 } from 'lucide-react';
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
  Question
} from '@/actions/gemini';
import { blobToBase64, pcmToWavBase64 } from '@/lib/audio';
import { ResultCard } from './ResultCard';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useConversationState } from '@/hooks/useConversationState';
import { useQuestionsFlow } from '@/hooks/useQuestionsFlow';

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

  const scrollRef = useRef<HTMLDivElement>(null);

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
  // Using a ref to track initialization avoids double-init without initializedRef
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

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conv.messages, conv.isProcessing, conv.phase]);

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

  if (conv.phase === 'finished') {
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-12 bg-white border-2 border-trebol-border rounded-sm shadow-xl space-y-8">
        <div className="bg-trebol-primary/10 p-6 rounded-full">
          <CheckCircle size={64} className="text-trebol-primary" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-trebol-text uppercase tracking-tighter">¡Excelente Trabajo!</h2>
          <p className="text-trebol-text/70 font-medium">Has completado la simulación y las preguntas de comprensión.</p>
        </div>
        <Button variant="primary" onClick={onFinish} className="px-12 py-4 text-xl">
          Volver al Inicio
        </Button>
      </div>
    );
  }

  return (
    <div className={noFrame ? "w-full h-full flex flex-col bg-white" : "w-full max-w-2xl mx-auto flex flex-col h-[75vh] bg-white border-2 border-trebol-border rounded-sm shadow-xl overflow-hidden"}>
      {/* Header Info */}
      {!noFrame && (
        <div className="bg-trebol-primary text-white px-6 py-2 flex justify-between items-center">
          <span className="text-xs font-black uppercase tracking-widest">
            {conv.phase === 'conversation' ? 'Práctica de Listening y Speaking' : conv.phase === 'questions' ? 'Evaluación de Comprensión' : 'Conversación'}
          </span>
          {conv.phase === 'conversation' && (
            <span className="text-xs font-bold">
              Iteración {Math.floor(conv.messages.length / 2) + 1} de {MAX_TURNS / 2}
            </span>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-slate-50/40"
      >
        <AnimatePresence mode="wait">
          {conv.phase === 'topic-input' && (
            <motion.div
              key="topic-input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-trebol-primary text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                B
              </div>
              <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm bg-white border border-trebol-border rounded-tl-none text-trebol-text">
                <p>
                  ¡Hola! Vamos a tener una conversación en inglés. ¿Sobre qué tema quieres practicar hoy?
                  <br />
                  <span className="text-trebol-text/60 text-xs">
                    Ej: &quot;En una reunión de trabajo&quot; o &quot;Hablando con un cliente&quot;.
                  </span>
                </p>
              </div>
            </motion.div>
          )}
          {conv.phase === 'conversation' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {conv.framing && (
                <div className="bg-trebol-secondary/10 border-2 border-dashed border-trebol-secondary/30 p-4 rounded-sm text-center mb-6">
                  <p className="text-sm font-bold text-trebol-text/70 uppercase tracking-widest mb-1">Escenario</p>
                  <p className="text-trebol-text font-medium italic">"{conv.framing}"</p>
                </div>
              )}

              {conv.messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-sm shadow-sm relative group ${
                    msg.role === 'user'
                      ? 'bg-trebol-primary text-white font-medium'
                      : 'bg-white border border-trebol-border text-trebol-text font-medium min-w-[200px]'
                  }`}>
                    {msg.role === 'model' ? (
                      <div className="flex flex-col space-y-2">
                        {conv.visibleTexts[i] ? (
                          <p className="animate-in fade-in slide-in-from-top-1 duration-300">{msg.text}</p>
                        ) : (
                          <div className="flex items-center space-x-2 py-2 text-trebol-text/40">
                            <Volume2 size={20} className="animate-pulse" />
                            <span className="text-sm font-bold italic">Escucha el audio...</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-trebol-border/10">
                          <button
                            onClick={() => handleListen(msg.text, i)}
                            disabled={conv.isGeneratingAudio !== null}
                            className="flex items-center space-x-2 bg-trebol-secondary text-white px-3 py-1 rounded-sm text-xs font-black uppercase hover:bg-trebol-secondary-dark transition-colors disabled:opacity-50"
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
                              className="flex items-center space-x-1 text-trebol-primary hover:text-trebol-primary-dark transition-colors"
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
                <div className="inline-block bg-trebol-secondary text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                  Pregunta {qf.currentQuestionIndex + 1} de {qf.questions.length}
                </div>
                <h3 className="text-2xl font-black text-trebol-text leading-tight">
                  {qf.questions[qf.currentQuestionIndex]?.question}
                </h3>
              </div>
              {qf.questionAnswers[qf.currentQuestionIndex] && (
                <div className="bg-white p-4 border-2 border-trebol-secondary/20 rounded-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span className="font-black text-xs uppercase text-green-600">Feedback</span>
                  </div>
                  <p className="text-trebol-text font-medium italic">
                    "{qf.questionAnswers[qf.currentQuestionIndex].feedback}"
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {conv.isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white border border-trebol-border p-4 rounded-sm shadow-sm flex items-center space-x-2">
                <Loader2 size={20} className="animate-spin text-trebol-primary" />
                <span className="text-sm font-semibold text-trebol-text opacity-60">
                  {conv.phase === 'conversation' ? 'MIA está pensando...' : 'Evaluando respuesta...'}
                </span>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Evaluation Feedback Overlay */}
      <AnimatePresence>
        {conv.showEvaluation && conv.currentEvaluation && !isRecording && !conv.isProcessing && conv.phase === 'conversation' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-6 py-3 bg-trebol-secondary/10 border-t border-trebol-secondary/20 flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-trebol-secondary text-white font-black text-sm px-2 py-1 rounded-sm">
                {conv.currentEvaluation.score}/100
              </div>
              <p className="text-sm font-bold text-trebol-text italic">
                "{conv.currentEvaluation.feedback}"
              </p>
            </div>
            <button
              onClick={() => conv.setShowEvaluation(false)}
              className="text-xs font-black text-trebol-primary uppercase tracking-wider hover:underline"
            >
              Entendido
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="shrink-0 border-t border-trebol-border bg-white px-4 py-3 space-y-3">
        {conv.phase === 'topic-input' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleTopicConfirm(); }}
            className="flex gap-2"
          >
            <input
              value={conv.topicInput}
              onChange={(e) => conv.setTopicInput(e.target.value)}
              placeholder="Escribe aquí tu tema..."
              className="flex-1 px-4 py-2.5 rounded-xl border-2 border-trebol-border focus:border-trebol-primary focus:outline-none text-sm bg-slate-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={!conv.topicInput.trim()}
              className="px-4 py-2.5 bg-trebol-primary text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
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
                  className="w-full pl-4 pr-12 py-3 bg-gray-100 border-2 border-trebol-border rounded-full focus:outline-none focus:border-trebol-primary font-medium"
                />
                <button
                  onClick={handleSendTextMessage}
                  disabled={!conv.inputText.trim() || conv.isProcessing || isRecording}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-trebol-primary text-white p-2 rounded-full hover:scale-105 transition-transform disabled:opacity-30"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="flex items-center space-x-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={conv.isProcessing}
                    className="bg-trebol-primary text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
                  >
                    <Mic size={24} />
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="bg-trebol-danger text-white p-4 rounded-full shadow-lg animate-pulse"
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
                className="flex items-center space-x-2 text-trebol-secondary font-black text-xs uppercase tracking-widest hover:text-trebol-secondary-dark disabled:opacity-30"
              >
                <Wand2 size={16} />
                <span>Simular Respuesta</span>
              </button>

              {conv.messages.length >= MAX_TURNS && !conv.isProcessing && (
                <button
                  onClick={handleGoToQuestions}
                  className="bg-green-600 text-white px-4 py-2 rounded-sm font-bold uppercase text-[10px] flex items-center space-x-2 hover:bg-green-700"
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
    </div>
  );
}
