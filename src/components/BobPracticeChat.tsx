'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Mic, Square, Send, Volume2, ArrowRight } from 'lucide-react';
import { ImageConfigSelection, SceneConfig } from '@/components/ImageConfigSelection';
import {
  generateTopicPhrasesAction,
  generateImageSceneAction,
  generateImageAction,
  generateSpeechAction,
  evaluatePronunciationAction,
  evaluateImageDescriptionAction,
  EvaluationResult,
  ImageScene,
} from '@/actions/gemini';
import { saveMessageAction, StoredMessage } from '@/actions/messages';
import { blobToBase64, pcmToWavBase64 } from '@/lib/audio';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';

type ChatPhase =
  | 'topic-input'
  | 'image-config'
  | 'generating'
  | 'phrase-ready'
  | 'recording'
  | 'evaluating'
  | 'result'
  | 'finished';

type ChatMsg = {
  id: string;
  role: 'bob' | 'user';
  content: React.ReactNode;
};

interface BobPracticeChatProps {
  mode: 'situation' | 'image';
  onBack: () => void;
  onSessionStart: (title: string) => Promise<string | undefined>;
  sessionId?: string | null;
  initialMessages?: StoredMessage[];
}

function restoreMessages(stored: StoredMessage[]): ChatMsg[] {
  return stored.map((m) => {
    let content: React.ReactNode;

    if (m.msg_type === 'phrase') {
      const j = m.content_json as { phrase: string; index: number; total: number } | null;
      content = j ? (
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-trebol-text/50">
            Frase {j.index + 1} de {j.total}
          </p>
          <div className="bg-trebol-bg border-2 border-trebol-primary/30 rounded-xl p-4">
            <p className="text-xl font-extrabold text-trebol-text leading-relaxed">{j.phrase}</p>
          </div>
          <p className="text-sm text-trebol-text/60">Escucha la frase y luego grábate pronunciándola.</p>
        </div>
      ) : <span>{m.content_text}</span>;
    } else if (m.msg_type === 'image_scene') {
      const j = m.content_json as { description: string } | null;
      content = (
        <div className="space-y-3">
          <p className="text-sm text-trebol-text/60">
            Describe lo que ves en esta imagen en inglés. Tienes 60 segundos.
          </p>
          {m.content_text ? (
            <img
              src={m.content_text}
              alt="Scene to describe"
              className="w-full rounded-xl border-2 border-trebol-border shadow-md"
            />
          ) : j?.description ? (
            <p className="text-xs text-trebol-text/50 italic">{j.description}</p>
          ) : null}
        </div>
      );
    } else if (m.msg_type === 'evaluation') {
      const j = m.content_json as { score: number; feedback: string; transcribed_text?: string } | null;
      if (j) {
        const scoreColor =
          j.score >= 90 ? 'text-green-600' : j.score >= 70 ? 'text-yellow-600' : 'text-gray-500';
        content = (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`text-4xl font-black ${scoreColor}`}>{j.score}</span>
              <span className="text-trebol-text/60 text-sm font-medium">/ 100</span>
            </div>
            {j.transcribed_text && (
              <div className="bg-trebol-bg rounded-lg px-3 py-2 text-sm text-trebol-text/80 italic">
                &quot;{j.transcribed_text}&quot;
              </div>
            )}
            <p className="text-sm text-trebol-text/80">{j.feedback}</p>
          </div>
        );
      } else {
        content = <span>{m.content_text}</span>;
      }
    } else if (m.msg_type === 'user_audio') {
      content = (
        <span className="flex items-center gap-2 text-sm">
          <Mic size={14} /> Audio grabado
        </span>
      );
    } else {
      content = <span>{m.content_text}</span>;
    }

    return { id: m.id, role: m.role, content };
  });
}

export function BobPracticeChat({
  mode,
  onBack,
  onSessionStart,
  sessionId,
  initialMessages,
}: BobPracticeChatProps) {
  const isHistory = !!initialMessages && initialMessages.length > 0;

  const [messages, setMessages] = useState<ChatMsg[]>(() =>
    isHistory ? restoreMessages(initialMessages) : []
  );
  const [phase, setPhase] = useState<ChatPhase>(() => {
    if (isHistory) return 'finished';
    return mode === 'image' ? 'image-config' : 'topic-input';
  });
  const [topic, setTopic] = useState('');
  const [inputText, setInputText] = useState('');
  const [dynamicPhrases, setDynamicPhrases] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentScene, setCurrentScene] = useState<(ImageScene & { image_data?: string }) | null>(null);
  const [currentSceneConfig, setCurrentSceneConfig] = useState<SceneConfig | null>(null);
  const [currentResult, setCurrentResult] = useState<EvaluationResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionStartedRef = useRef(false);
  const greetingAddedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sessionIdRef = useRef<string | null>(sessionId ?? null);
  useEffect(() => {
    if (sessionId) sessionIdRef.current = sessionId;
  }, [sessionId]);

  const saveMsg = async (input: Omit<Parameters<typeof saveMessageAction>[0], 'session_id'>) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const { error } = await saveMessageAction({ ...input, session_id: sid });
    if (error) console.error('[saveMsg] failed:', error, 'msg_type:', input.msg_type);
  };

  const addBobMessage = (content: React.ReactNode) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bob', content }]);
  };

  const addUserMessage = (content: React.ReactNode) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content }]);
  };

  useEffect(() => {
    if (isHistory || greetingAddedRef.current) return;
    greetingAddedRef.current = true;
    if (mode === 'situation') {
      addBobMessage(
        <p>
          ¡Hola! Soy <strong>BOB</strong>, tu coach de pronunciación. ¿Sobre qué situación quieres practicar hoy?
          <br />
          <span className="text-trebol-text/60 text-sm">
            Ej: &quot;En una entrevista de trabajo&quot; o &quot;Pidiendo direcciones en la calle&quot;.
          </span>
        </p>
      );
      saveMsg({
        role: 'bob',
        msg_type: 'text',
        content_text: '¡Hola! Soy BOB, tu coach de pronunciación. ¿Sobre qué situación quieres practicar hoy?',
      });
    } else {
      addBobMessage(
        <div className="space-y-3">
          <p>¡Vamos a practicar descripción de imágenes! Configura tu escena:</p>
          <ImageConfigSelection onConfirm={handleImageConfig} />
        </div>
      );
      saveMsg({
        role: 'bob',
        msg_type: 'text',
        content_text: '¡Vamos a practicar descripción de imágenes! Configura tu escena:',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderPhrase = (phrase: string, index: number, total: number) => (
    <div className="space-y-3">
      <p className="text-xs font-black uppercase tracking-widest text-trebol-text/50">
        Frase {index + 1} de {total}
      </p>
      <div className="bg-trebol-bg border-2 border-trebol-primary/30 rounded-xl p-4">
        <p className="text-xl font-extrabold text-trebol-text leading-relaxed">{phrase}</p>
      </div>
      <p className="text-sm text-trebol-text/60">Escucha la frase y luego grábate pronunciándola.</p>
      <button
        type="button"
        onClick={() => handleListen(phrase)}
        className="flex items-center gap-2 text-sm font-bold text-trebol-primary hover:opacity-75 transition-opacity"
      >
        <Volume2 size={16} /> Escuchar pronunciación
      </button>
    </div>
  );

  const renderScene = (scene: ImageScene & { image_data?: string }) => (
    <div className="space-y-3">
      <p className="text-sm text-trebol-text/60">
        Describe lo que ves en esta imagen en inglés. Tienes 60 segundos.
      </p>
      {scene.image_data && (
        <img
          src={scene.image_data}
          alt="Scene to describe"
          className="w-full rounded-xl border-2 border-trebol-border shadow-md"
        />
      )}
    </div>
  );

  const renderResult = (result: EvaluationResult) => {
    const scoreColor =
      result.score >= 90
        ? 'text-green-600'
        : result.score >= 70
        ? 'text-yellow-600'
        : 'text-gray-500';
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className={`text-4xl font-black ${scoreColor}`}>{result.score}</span>
          <span className="text-trebol-text/60 text-sm font-medium">/ 100</span>
        </div>
        {result.transcribed_text && (
          <div className="bg-trebol-bg rounded-lg px-3 py-2 text-sm text-trebol-text/80 italic">
            &quot;{result.transcribed_text}&quot;
          </div>
        )}
        <p className="text-sm text-trebol-text/80">{result.feedback}</p>
      </div>
    );
  };

  const handleListen = async (text: string) => {
    try {
      const { data, mimeType } = await generateSpeechAction(text);
      const audioUrl = pcmToWavBase64(data, mimeType);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    }
  };

  const handleTopicSubmit = async () => {
    if (!inputText.trim()) return;
    const t = inputText.trim();
    setTopic(t);
    setInputText('');
    addUserMessage(<span>{t}</span>);
    saveMsg({ role: 'user', msg_type: 'text', content_text: t });
    setPhase('generating');
    addBobMessage(
      <span className="flex items-center gap-2 text-trebol-text/70">
        <Loader2 size={16} className="animate-spin" /> Creando tu práctica...
      </span>
    );
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      const id = await onSessionStart(t.slice(0, 60) || 'Práctica de frases');
      if (id) sessionIdRef.current = id;
    }
    try {
      const generated = await generateTopicPhrasesAction(t);
      setDynamicPhrases(generated);
      setCurrentIndex(0);
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(renderPhrase(generated[0], 0, generated.length));
      saveMsg({ role: 'bob', msg_type: 'phrase', content_json: { phrase: generated[0], index: 0, total: generated.length } });
      setPhase('phrase-ready');
    } catch {
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(
        <span className="text-red-500">No pude generar las frases. ¿Intentamos con otro tema?</span>
      );
      setPhase('topic-input');
    }
  };

  const uploadImageToStorage = async (imageDataUrl: string): Promise<string> => {
    const supabase = createSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    const filename = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('bob-images').upload(filename, blob, { contentType: blob.type });
    if (error) throw error;
    return supabase.storage.from('bob-images').getPublicUrl(filename).data.publicUrl;
  };

  const handleImageConfig = async (config: SceneConfig) => {
    setCurrentSceneConfig(config);
    addUserMessage(
      <span>
        {config.topic} · {config.difficulty}
      </span>
    );
    saveMsg({ role: 'user', msg_type: 'text', content_text: `${config.topic} · ${config.difficulty}` });
    setPhase('generating');
    addBobMessage(
      <span className="flex items-center gap-2 text-trebol-text/70">
        <Loader2 size={16} className="animate-spin" /> Generando tu escena...
      </span>
    );
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      const id = await onSessionStart(config.topic.slice(0, 60) || 'Describe la escena');
      if (id) sessionIdRef.current = id;
    }
    try {
      const scene = await generateImageSceneAction(config.topic, config.difficulty);
      const imageData = await generateImageAction(scene.image_prompt);
      const fullScene = { ...scene, image_data: imageData };
      setCurrentScene(fullScene);
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(renderScene(fullScene));
      const imageUrl = await uploadImageToStorage(imageData);
      saveMsg({ role: 'bob', msg_type: 'image_scene', content_text: imageUrl, content_json: { description: scene.description } });
      setPhase('phrase-ready');
    } catch (err) {
      console.error('[handleImageConfig]', err);
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(
        <span className="text-red-500">Error al generar la imagen. Intenta de nuevo.</span>
      );
      setPhase('image-config');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        } as MediaTrackConstraints,
      });
      const mr = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000,
      });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        handleAudioRecorded(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setPhase('recording');
    } catch {
      addBobMessage(
        <span className="text-red-500">No pude acceder al micrófono. Revisa los permisos.</span>
      );
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleAudioRecorded = async (audioBlob: Blob) => {
    addUserMessage(
      <span className="flex items-center gap-2 text-sm">
        <Mic size={14} /> Audio grabado
      </span>
    );
    saveMsg({ role: 'user', msg_type: 'user_audio', content_text: 'Audio grabado' });
    setPhase('evaluating');
    addBobMessage(
      <span className="flex items-center gap-2 text-trebol-text/70">
        <Loader2 size={16} className="animate-spin" /> Analizando tu pronunciación...
      </span>
    );
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];
      const result =
        mode === 'situation'
          ? await evaluatePronunciationAction(base64Audio, mimeType, dynamicPhrases[currentIndex])
          : await evaluateImageDescriptionAction(
              base64Audio,
              mimeType,
              currentScene?.description || ''
            );
      setCurrentResult(result);
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(renderResult(result));
      saveMsg({
        role: 'bob',
        msg_type: 'evaluation',
        content_json: {
          score: result.score,
          feedback: result.feedback,
          transcribed_text: result.transcribed_text ?? null,
        },
      });
      setPhase('result');
    } catch {
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(
        <span className="text-red-500">Error al evaluar. ¿Intentamos de nuevo?</span>
      );
      setPhase('phrase-ready');
    }
  };

  const handleNextImage = async () => {
    if (!currentSceneConfig) return;
    setPhase('generating');
    addBobMessage(
      <span className="flex items-center gap-2 text-trebol-text/70">
        <Loader2 size={16} className="animate-spin" /> Generando nueva escena...
      </span>
    );
    try {
      const scene = await generateImageSceneAction(currentSceneConfig.topic, currentSceneConfig.difficulty);
      const imageData = await generateImageAction(scene.image_prompt);
      const fullScene = { ...scene, image_data: imageData };
      setCurrentScene(fullScene);
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(renderScene(fullScene));
      const imageUrl = await uploadImageToStorage(imageData);
      saveMsg({ role: 'bob', msg_type: 'image_scene', content_text: imageUrl, content_json: { description: scene.description } });
      setPhase('phrase-ready');
    } catch (err) {
      console.error('[handleNextImage]', err);
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(<span className="text-red-500">Error al generar la imagen. Intenta de nuevo.</span>);
      setPhase('result');
    }
  };

  const handleNext = () => {
    if (mode === 'situation') {
      if (currentIndex < dynamicPhrases.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        addBobMessage(renderPhrase(dynamicPhrases[nextIndex], nextIndex, dynamicPhrases.length));
        saveMsg({
          role: 'bob',
          msg_type: 'phrase',
          content_json: { phrase: dynamicPhrases[nextIndex], index: nextIndex, total: dynamicPhrases.length },
        });
        setPhase('phrase-ready');
      } else {
        const completionText = `¡Sesión completada! Has practicado ${dynamicPhrases.length} frases sobre "${topic}". ¡Sigue así!`;
        addBobMessage(
          <div className="space-y-1">
            <p className="font-black text-trebol-primary">¡Sesión completada! 🎉</p>
            <p className="text-sm text-trebol-text/70">
              Has practicado {dynamicPhrases.length} frases sobre &quot;{topic}&quot;. ¡Sigue así!
            </p>
          </div>
        );
        saveMsg({ role: 'bob', msg_type: 'text', content_text: completionText });
        setPhase('finished');
      }
    } else {
      addBobMessage(
        <div className="space-y-1">
          <p className="font-black text-trebol-primary">¡Bien hecho! 🎉</p>
          <p className="text-sm text-trebol-text/70">Has completado la descripción de imagen.</p>
        </div>
      );
      saveMsg({ role: 'bob', msg_type: 'text', content_text: '¡Bien hecho! Has completado la descripción de imagen.' });
      setPhase('finished');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-slate-50/40">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {msg.role === 'bob' && (
              <div className="w-8 h-8 rounded-full bg-trebol-primary text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                B
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.role === 'bob'
                  ? 'bg-white border border-trebol-border rounded-tl-none text-trebol-text'
                  : 'bg-trebol-primary text-white rounded-tr-none'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed input area */}
      <div className="shrink-0 border-t border-trebol-border bg-white px-4 py-3">
        {phase === 'topic-input' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTopicSubmit();
            }}
            className="flex gap-2"
          >
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe aquí tu situación..."
              className="flex-1 px-4 py-2.5 rounded-xl border-2 border-trebol-border focus:border-trebol-primary focus:outline-none text-sm bg-slate-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-4 py-2.5 bg-trebol-primary text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Send size={18} />
            </button>
          </form>
        )}

        {phase === 'phrase-ready' && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-3 px-8 py-3 bg-trebol-primary text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity shadow-lg"
            >
              <Mic size={20} /> Grabar respuesta
            </button>
          </div>
        )}

        {phase === 'recording' && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-3 px-8 py-3 bg-red-500 text-white rounded-full font-bold text-sm hover:opacity-90 transition-opacity shadow-lg animate-pulse"
            >
              <Square size={18} /> Detener grabación
            </button>
          </div>
        )}

        {(phase === 'generating' || phase === 'evaluating') && (
          <div className="flex justify-center py-1">
            <span className="text-sm text-trebol-text/50 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Procesando...
            </span>
          </div>
        )}

        {phase === 'result' && mode === 'situation' && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-trebol-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            >
              {currentIndex < dynamicPhrases.length - 1 ? 'Siguiente frase' : 'Finalizar sesión'}
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {phase === 'result' && mode === 'image' && (
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={handleNextImage}
              className="flex items-center gap-2 px-6 py-2.5 bg-trebol-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Nueva imagen <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 border-2 border-trebol-border text-trebol-text rounded-xl font-bold text-sm hover:opacity-70 transition-opacity"
            >
              Finalizar sesión
            </button>
          </div>
        )}

        {phase === 'finished' && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 px-6 py-2.5 bg-trebol-secondary text-trebol-text rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Nueva sesión
            </button>
          </div>
        )}

        {phase === 'image-config' && (
          <p className="text-xs text-trebol-text/50 text-center py-1">
            Configura la escena arriba para comenzar
          </p>
        )}
      </div>
    </div>
  );
}
