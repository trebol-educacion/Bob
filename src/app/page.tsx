'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PhraseCard } from '@/components/PhraseCard';
import { ResultCard } from '@/components/ResultCard';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/Button';
import { ModeSelection } from '@/components/ModeSelection';
import { TipsModal } from '@/components/TipsModal';
import { ImageConfigSelection, SceneConfig } from '@/components/ImageConfigSelection';
import { ImagePractice } from '@/components/ImagePractice';
import { ConversationPractice } from '@/components/ConversationPractice';
import { 
  evaluatePronunciationAction, 
  evaluateImageDescriptionAction, 
  EvaluationResult, 
  generateTopicPhrasesAction, 
  generateImageSceneAction, 
  generateImageAction,
  ImageScene,
  chatConversationAction 
} from '@/actions/gemini';
import { blobToBase64 } from '@/lib/audio';
import { Loader2, Mic2, Sparkles, Send, Image as ImageIcon } from 'lucide-react';

type AppState = 
  | 'welcome' 
  | 'mode-selection'
  | 'topic-selection' 
  | 'generating-phrases' 
  | 'practicing' 
  | 'showing-tips'
  | 'image-config'
  | 'generating-image'
  | 'image-practicing'
  | 'conversation-practicing'
  | 'evaluating' 
  | 'result' 
  | 'finished';

export default function App() {
  const [appState, setAppState] = useState<AppState>('welcome');
  const [mode, setMode] = useState<'situation' | 'image' | 'conversation' | null>(null);
  const [topic, setTopic] = useState('');
  const [dynamicPhrases, setDynamicPhrases] = useState<string[]>([]);
  const [currentScene, setCurrentScene] = useState<ImageScene | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentResult, setCurrentResult] = useState<EvaluationResult | null>(null);

  const startModeSelection = () => {
    setAppState('mode-selection');
  };

  const handleModeSelect = (selectedMode: 'situation' | 'image' | 'conversation') => {
    setMode(selectedMode);
    if (selectedMode === 'situation' || selectedMode === 'conversation') {
      setAppState('topic-selection');
    } else {
      setAppState('showing-tips');
    }
  };

  const handleTipsClose = () => {
    setAppState('image-config');
  };

  const handleStartImagePractice = async (config: SceneConfig) => {
    setAppState('generating-image');
    try {
      const scene = await generateImageSceneAction(config.topic, config.difficulty);
      const imageData = await generateImageAction(scene.image_prompt);
      setCurrentScene({ ...scene, image_data: imageData });
      setAppState('image-practicing');
    } catch (error) {
      console.error('Failed to generate image scene or image:', error);
      alert('Error al generar la imagen. Inténtalo de nuevo.');
      setAppState('mode-selection');
    }
  };

  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    if (mode === 'conversation') {
      setAppState('conversation-practicing');
      return;
    }

    setAppState('generating-phrases');
    try {
      const generated = await generateTopicPhrasesAction(topic);
      setDynamicPhrases(generated);
      setCurrentIndex(0);
      setAppState('practicing');
    } catch (error) {
      console.error('Failed to generate phrases:', error);
      alert('No pudimos generar las frases. Por favor, intenta con otro tema.');
      setAppState('topic-selection');
    }
  };

  const handleAudioRecorded = async (audioBlob: Blob) => {
    setAppState('evaluating');
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];
      
      let result: EvaluationResult;
      if (mode === 'situation') {
        result = await evaluatePronunciationAction(
          base64Audio,
          mimeType,
          dynamicPhrases[currentIndex]
        );
      } else {
        result = await evaluateImageDescriptionAction(
          base64Audio,
          mimeType,
          currentScene?.description || ''
        );
      }
      
      setCurrentResult(result);
      setAppState('result');
    } catch (error) {
      console.error('Evaluation failed:', error);
      alert('Hubo un error al evaluar tu audio. Inténtalo de nuevo.');
      setAppState(mode === 'situation' ? 'practicing' : 'image-practicing');
    }
  };

  const handleNext = () => {
    if (mode === 'situation') {
      if (currentIndex < dynamicPhrases.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setAppState('practicing');
      } else {
        setAppState('finished');
      }
    } else {
      setAppState('finished');
    }
  };

  const isDuringPractice = ['practicing', 'image-practicing', 'evaluating', 'result'].includes(appState);

  return (
    <div className="min-h-screen bg-trebol-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col py-8">
        
        {/* Header / Progress */}
        {isDuringPractice && mode === 'situation' && (
          <div className="w-full max-w-md mx-auto mb-8">
            <ProgressBar current={currentIndex} total={dynamicPhrases.length} />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col justify-center items-center w-full">
          <AnimatePresence mode="wait">
            {appState === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center space-y-8 w-full max-w-md"
              >
                <div className="bg-trebol-secondary p-6 rounded-sm inline-block mb-6 shadow-md">
                  <Mic2 size={64} className="text-trebol-primary" />
                </div>
                <h1 className="text-4xl font-black text-trebol-text tracking-tight">
                  Pronuncia con MIA
                </h1>
                <p className="text-xl text-trebol-text font-semibold opacity-80">
                  Aprende inglés con situaciones personalizadas por IA.
                </p>
                <div className="pt-8">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full py-4 text-xl"
                    onClick={startModeSelection}
                  >
                    ¡Comenzar!
                  </Button>
                </div>
              </motion.div>
            )}

            {appState === 'mode-selection' && (
              <motion.div
                key="mode-selection"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <ModeSelection onSelect={handleModeSelect} />
              </motion.div>
            )}

            {appState === 'showing-tips' && (
              <TipsModal onClose={handleTipsClose} />
            )}

            {appState === 'image-config' && (
              <motion.div
                key="image-config"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <ImageConfigSelection onConfirm={handleStartImagePractice} />
              </motion.div>
            )}

            {appState === 'topic-selection' && (
              <motion.div
                key="topic-selection"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-md space-y-6"
              >
                <div className="text-center space-y-2">
                  <Sparkles size={48} className="text-trebol-secondary mx-auto" />
                  <h2 className="text-2xl font-black text-trebol-text">¿Qué quieres practicar?</h2>
                  <p className="text-trebol-text font-semibold opacity-60">Ej: "En una entrevista de trabajo" o "Programando en equipo".</p>
                </div>
                
                <form onSubmit={handleTopicSubmit} className="space-y-4">
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Escribe aquí tu situación..."
                    className="w-full p-4 text-lg border-2 border-trebol-border rounded-sm focus:border-trebol-primary focus:outline-none min-h-[120px] font-medium bg-white"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full flex items-center justify-center space-x-2 py-4 text-xl"
                    disabled={!topic.trim()}
                  >
                    <span>Generar Lección</span>
                    <Send size={20} />
                  </Button>
                </form>
              </motion.div>
            )}

            {appState === 'generating-phrases' && (
              <motion.div
                key="generating"
                className="flex flex-col items-center justify-center space-y-6 text-center"
              >
                <div className="relative">
                  <Loader2 size={80} className="text-trebol-primary animate-spin" />
                  <Sparkles size={32} className="text-trebol-secondary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h2 className="text-2xl font-bold text-trebol-text">Creando tu historia...</h2>
                <p className="text-trebol-text font-semibold opacity-60">Estamos diseñando 10 frases perfectas para tu tema.</p>
              </motion.div>
            )}

            {appState === 'generating-image' && (
              <motion.div
                key="generating-image"
                className="flex flex-col items-center justify-center space-y-6 text-center"
              >
                <div className="relative">
                  <Loader2 size={80} className="text-trebol-primary animate-spin" />
                  <ImageIcon size={32} className="text-trebol-secondary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h2 className="text-2xl font-bold text-trebol-text">Generando una escena...</h2>
                <p className="text-trebol-text font-semibold opacity-60">Estamos creando una situación perfecta para practicar.</p>
              </motion.div>
            )}

            {appState === 'practicing' && (
              <div className="w-full max-w-md mx-auto">
                <PhraseCard
                  key={`phrase-${currentIndex}`}
                  phrase={dynamicPhrases[currentIndex]}
                  onAudioRecorded={handleAudioRecorded}
                />
              </div>
            )}

            {appState === 'conversation-practicing' && (
              <ConversationPractice 
                topic={topic}
                onFinish={() => setAppState('finished')}
              />
            )}

            {appState === 'image-practicing' && currentScene && (
              <ImagePractice
                scene={currentScene}
                onAudioRecorded={handleAudioRecorded}
              />
            )}

            {appState === 'evaluating' && (
              <motion.div
                key="evaluating"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center space-y-6 text-center"
              >
                <Loader2 size={64} className="text-trebol-primary animate-spin" />
                <h2 className="text-2xl font-bold text-trebol-text">
                  Analizando tu respuesta...
                </h2>
                <p className="text-trebol-text font-semibold opacity-60">
                  Nuestra IA está escuchando atentamente.
                </p>
              </motion.div>
            )}

            {appState === 'result' && currentResult && (
              <ResultCard
                key="result"
                result={currentResult}
                onNext={handleNext}
              />
            )}

            {appState === 'finished' && (
              <motion.div
                key="finished"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-8 w-full max-w-md mx-auto"
              >
                <h1 className="text-4xl font-black text-trebol-primary tracking-tight">
                  ¡Sesión Completada!
                </h1>
                <p className="text-xl text-trebol-text font-semibold text-center px-4">
                  {mode === 'situation' || mode === 'conversation' ? (
                    <>Has completado tu sesión sobre: <br/><span className="text-trebol-primary italic">"{topic}"</span></>
                  ) : (
                    <>Has completado tu descripción sobre: <br/><span className="text-trebol-primary italic">"{currentScene?.topic}"</span></>
                  )}
                </p>
                <div className="pt-8">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full py-4 text-xl"
                    onClick={() => {
                      setTopic('');
                      setAppState('welcome');
                      setMode(null);
                      setCurrentScene(null);
                    }}
                  >
                    Practicar otro tema
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
