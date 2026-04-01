import React, { useState, useRef, useEffect } from 'react';
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

interface ConversationPracticeProps {
  topic: string;
  onFinish: () => void;
}

type Phase = 'conversation' | 'questions' | 'finished';

export function ConversationPractice({ topic, onFinish }: ConversationPracticeProps) {
  const [phase, setPhase] = useState<Phase>('conversation');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [framing, setFraming] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<number | null>(null);
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(null);
  const [showEvaluation, setShowEvaluation] = useState(false);
  
  // New listening practice states
  const [playCounts, setPlayCounts] = useState<Record<number, number>>({});
  const [visibleTexts, setVisibleTexts] = useState<Record<number, boolean>>({});
  
  // Question phase states
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, EvaluationResult>>({});

  // Input state
  const [inputText, setInputText] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const MAX_TURNS = 12; // ~6 iterations

  // Initialize conversation
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initChat = async () => {
      setIsProcessing(true);
      try {
        const result = await generateInitialChatAction(topic);
        setFraming(result.framing);
        setMessages([{ role: 'model', text: result.message }]);
        // Automatically play the first message
        setTimeout(() => handleListen(result.message, 0), 500);
      } catch (error) {
        console.error('Failed to init chat:', error);
      } finally {
        setIsProcessing(false);
      }
    };
    initChat();
  }, [topic]);

  const handleListen = async (text: string, index: number) => {
    if (isGeneratingAudio !== null) return;
    
    setIsGeneratingAudio(index);
    try {
      const { data, mimeType } = await generateSpeechAction(text);
      const audioUrl = pcmToWavBase64(data, mimeType);
      const audio = new Audio(audioUrl);
      
      // Update play count
      setPlayCounts(prev => ({
        ...prev,
        [index]: (prev[index] || 0) + 1
      }));

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsGeneratingAudio(null);
    }
  };

  const toggleHint = (index: number) => {
    setVisibleTexts(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing, phase]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (phase === 'conversation') {
          await handleSendMessage(audioBlob);
        } else if (phase === 'questions') {
          await handleAnswerQuestion(audioBlob);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone error:', error);
      alert('Por favor, permite el acceso al micrófono.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendMessage = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];
      
      const result = await chatConversationAction(
        base64Audio,
        mimeType,
        messages,
        topic
      );

      const userMsg: ChatMessage = { role: 'user', text: result.evaluation.transcribed_text };
      const modelMsg: ChatMessage = { role: 'model', text: result.ai_response };

      const newMessages = [...messages, userMsg, modelMsg];
      setMessages(newMessages);
      setCurrentEvaluation(result.evaluation);
      setShowEvaluation(true);

      // Auto-play the model's response
      const modelMsgIndex = newMessages.length - 1;
      setTimeout(() => handleListen(modelMsg.text, modelMsgIndex), 500);

    } catch (error) {
      console.error('Conversation error:', error);
      alert('Error en la conversación. Inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendTextMessage = async () => {
    if (!inputText.trim() || isProcessing) return;
    
    setIsProcessing(true);
    const textToSend = inputText.trim();
    setInputText('');

    try {
      const result = await chatTextConversationAction(
        textToSend,
        messages,
        topic
      );

      const userMsg: ChatMessage = { role: 'user', text: textToSend };
      const modelMsg: ChatMessage = { role: 'model', text: result.ai_response };

      const newMessages = [...messages, userMsg, modelMsg];
      setMessages(newMessages);
      setCurrentEvaluation(result.evaluation);
      setShowEvaluation(true);

      const modelMsgIndex = newMessages.length - 1;
      setTimeout(() => handleListen(modelMsg.text, modelMsgIndex), 500);
    } catch (error) {
      console.error('Text conversation error:', error);
      alert('Error al enviar el mensaje. Inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateResponse = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const simulatedText = await simulateUserResponseAction(messages, topic);
      
      const result = await chatTextConversationAction(
        simulatedText,
        messages,
        topic
      );

      const userMsg: ChatMessage = { role: 'user', text: simulatedText };
      const modelMsg: ChatMessage = { role: 'model', text: result.ai_response };

      const newMessages = [...messages, userMsg, modelMsg];
      setMessages(newMessages);
      setCurrentEvaluation(result.evaluation);
      setShowEvaluation(true);

      const modelMsgIndex = newMessages.length - 1;
      setTimeout(() => handleListen(modelMsg.text, modelMsgIndex), 500);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoToQuestions = async () => {
    setIsProcessing(true);
    try {
      let finalHistory = messages;
      if (messages.length < MAX_TURNS) {
        // Simulate missing turns
        finalHistory = await simulateConversationAction(messages, topic);
        setMessages(finalHistory);
      }
      
      const aiQuestions = await generateQuestionsAction(finalHistory, topic);
      setQuestions(aiQuestions);
      setPhase('questions');
    } catch (error) {
      console.error('Error switching to questions:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnswerQuestion = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];
      
      const currentQuestion = questions[currentQuestionIndex];
      
      const result = await chatConversationAction(
        base64Audio,
        mimeType,
        messages,
        `Evaluating answer to: ${currentQuestion.question}. Correct info: ${currentQuestion.correct_answer}`
      );

      setQuestionAnswers(prev => ({
        ...prev,
        [currentQuestionIndex]: result.evaluation
      }));

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setPhase('finished');
      }
    } catch (error) {
      console.error('Error answering question:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (phase === 'finished') {
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
    <div className="w-full max-w-2xl mx-auto flex flex-col h-[75vh] bg-white border-2 border-trebol-border rounded-sm shadow-xl overflow-hidden">
      {/* Header Info */}
      <div className="bg-trebol-primary text-white px-6 py-2 flex justify-between items-center">
        <span className="text-xs font-black uppercase tracking-widest">
          {phase === 'conversation' ? 'Práctica de Listening y Speaking' : 'Evaluación de Comprensión'}
        </span>
        {phase === 'conversation' && (
          <span className="text-xs font-bold">
            Iteración {Math.floor(messages.length / 2) + 1} de {MAX_TURNS / 2}
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50"
      >
        <AnimatePresence mode="wait">
          {phase === 'conversation' ? (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {framing && (
                <div className="bg-trebol-secondary/10 border-2 border-dashed border-trebol-secondary/30 p-4 rounded-sm text-center mb-6">
                  <p className="text-sm font-bold text-trebol-text/70 uppercase tracking-widest mb-1">Escenario</p>
                  <p className="text-trebol-text font-medium italic">"{framing}"</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-sm shadow-sm relative group ${
                    msg.role === 'user' 
                      ? 'bg-trebol-primary text-white font-medium' 
                      : 'bg-white border border-trebol-border text-trebol-text font-medium min-w-[200px]'
                  }`}>
                    {msg.role === 'model' ? (
                      <div className="flex flex-col space-y-2">
                        {visibleTexts[i] ? (
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
                            disabled={isGeneratingAudio !== null}
                            className="flex items-center space-x-2 bg-trebol-secondary text-white px-3 py-1 rounded-sm text-xs font-black uppercase hover:bg-trebol-secondary-dark transition-colors disabled:opacity-50"
                          >
                            {isGeneratingAudio === i ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Volume2 size={12} />
                            )}
                            <span>{playCounts[i] > 0 ? 'Repetir' : 'Reproducir'}</span>
                          </button>

                          {playCounts[i] >= 2 && (
                            <button
                              onClick={() => toggleHint(i)}
                              className="flex items-center space-x-1 text-trebol-primary hover:text-trebol-primary-dark transition-colors"
                            >
                              <HelpCircle size={14} />
                              <span className="text-[10px] font-black uppercase tracking-tighter">
                                {visibleTexts[i] ? 'Ocultar Texto' : 'Ver Pista'}
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
          ) : (
            <motion.div
              key="questions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 py-8"
            >
              <div className="text-center space-y-4">
                <div className="inline-block bg-trebol-secondary text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                  Pregunta {currentQuestionIndex + 1} de {questions.length}
                </div>
                <h3 className="text-2xl font-black text-trebol-text leading-tight">
                  {questions[currentQuestionIndex]?.question}
                </h3>
              </div>

              {questionAnswers[currentQuestionIndex] && (
                <div className="bg-white p-4 border-2 border-trebol-secondary/20 rounded-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span className="font-black text-xs uppercase text-green-600">Feedback</span>
                  </div>
                  <p className="text-trebol-text font-medium italic">
                    "{questionAnswers[currentQuestionIndex].feedback}"
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white border border-trebol-border p-4 rounded-sm shadow-sm flex items-center space-x-2">
                <Loader2 size={20} className="animate-spin text-trebol-primary" />
                <span className="text-sm font-semibold text-trebol-text opacity-60">
                  {phase === 'conversation' ? 'MIA está pensando...' : 'Evaluando respuesta...'}
                </span>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Evaluation Feedback Overlay */}
      <AnimatePresence>
        {showEvaluation && currentEvaluation && !isRecording && !isProcessing && phase === 'conversation' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-6 py-3 bg-trebol-secondary/10 border-t border-trebol-secondary/20 flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-trebol-secondary text-white font-black text-sm px-2 py-1 rounded-sm">
                {currentEvaluation.score}/100
              </div>
              <p className="text-sm font-bold text-trebol-text italic">
                "{currentEvaluation.feedback}"
              </p>
            </div>
            <button 
              onClick={() => setShowEvaluation(false)}
              className="text-xs font-black text-trebol-primary uppercase tracking-wider hover:underline"
            >
              Entendido
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="p-4 bg-white border-t-2 border-trebol-border space-y-4">
        {phase === 'conversation' ? (
          <div className="flex flex-col space-y-4">
            {/* Input row */}
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendTextMessage()}
                  placeholder="Escribe tu respuesta..."
                  disabled={isProcessing || isRecording}
                  className="w-full pl-4 pr-12 py-3 bg-gray-100 border-2 border-trebol-border rounded-full focus:outline-none focus:border-trebol-primary font-medium"
                />
                <button
                  onClick={handleSendTextMessage}
                  disabled={!inputText.trim() || isProcessing || isRecording}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-trebol-primary text-white p-2 rounded-full hover:scale-105 transition-transform disabled:opacity-30"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="flex items-center space-x-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={isProcessing}
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
                disabled={isProcessing}
                className="px-4 py-2 text-xs flex items-center space-x-2"
              >
                <ArrowRight size={14} />
                <span>Saltar a Preguntas</span>
              </Button>

              <button
                onClick={handleSimulateResponse}
                disabled={isProcessing || isRecording}
                className="flex items-center space-x-2 text-trebol-secondary font-black text-xs uppercase tracking-widest hover:text-trebol-secondary-dark disabled:opacity-30"
              >
                <Wand2 size={16} />
                <span>Simular Respuesta</span>
              </button>

              {messages.length >= MAX_TURNS && !isProcessing && (
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
        ) : (
          <div className="flex items-center justify-center">
            {!isRecording ? (
              <Button
                variant="primary"
                disabled={isProcessing}
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
