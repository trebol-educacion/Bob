import React, { useState, useRef } from 'react';
import { Button } from './Button';
import { Volume2, Mic, Square, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { generateSpeechAction } from '@/actions/gemini';
import { pcmToWavBase64 } from '@/lib/audio';

interface PhraseCardProps {
  phrase: string;
  onAudioRecorded: (audioBlob: Blob) => void;
}

export function PhraseCard({ phrase, onAudioRecorded }: PhraseCardProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleListen = async () => {
    if (isGeneratingAudio) return;
    
    setIsGeneratingAudio(true);
    try {
      const { data, mimeType } = await generateSpeechAction(phrase);
      const audioUrl = pcmToWavBase64(data, mimeType);
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (error) {
      console.error('Error playing phrase audio:', error);
      // Fallback to basic speech synthesis if Gemini fails
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } 
      });
      
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        bitsPerSecond: 128000
      };
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onAudioRecorded(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Por favor, permite el acceso al micrófono para practicar.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center space-y-8 w-full max-w-md mx-auto p-6"
    >
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-trebol-text">Lee esta frase en voz alta:</h2>
        <div className="bg-white border-2 border-trebol-border rounded-sm p-6 shadow-sm relative">
          <p className="text-3xl font-extrabold text-trebol-text tracking-tight">
            {phrase}
          </p>
          <button
            onClick={handleListen}
            disabled={isGeneratingAudio}
            className="absolute -top-4 -right-4 bg-trebol-primary text-white p-3 rounded-sm shadow-md hover:bg-trebol-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Escuchar pronunciación"
          >
            {isGeneratingAudio ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <Volume2 size={24} />
            )}
          </button>
        </div>
      </div>

      <div className="pt-8">
        {!isRecording ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full flex items-center justify-center space-x-2 py-6 text-xl rounded-full"
            onClick={startRecording}
          >
            <Mic size={28} />
            <span>Grabar</span>
          </Button>
        ) : (
          <Button
            variant="danger"
            size="lg"
            className="w-full flex items-center justify-center space-x-2 py-6 text-xl rounded-full animate-pulse"
            onClick={stopRecording}
          >
            <Square size={28} fill="currentColor" />
            <span>Detener</span>
          </Button>
        )}
      </div>
      
      {isRecording && (
        <p className="text-red-500 font-bold text-sm animate-bounce">
          Escuchando...
        </p>
      )}
    </motion.div>
  );
}
