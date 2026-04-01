import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { Mic, Square, Loader2, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { ImageScene } from '@/actions/gemini';

interface ImagePracticeProps {
  scene: ImageScene & { image_data?: string };
  onAudioRecorded: (audioBlob: Blob) => void;
}

export function ImagePractice({ scene, onAudioRecorded }: ImagePracticeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

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
      setSeconds(0);
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

  const imageUrl = scene.image_data || `https://image.pollinations.ai/prompt/${encodeURIComponent(scene.image_prompt)}?width=800&height=600&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-4xl mx-auto space-y-6 p-4"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-trebol-text">Describe esta imagen</h2>
        <p className="text-trebol-text font-semibold opacity-60">Recuerda las 4 Ws y habla durante un minuto.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <div className="aspect-video bg-white border-4 border-white shadow-xl rounded-sm overflow-hidden relative group">
            <img 
              src={imageUrl} 
              alt="Describe this scene" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-white font-bold text-lg px-4 text-center">{scene.topic}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between bg-white p-4 border-2 border-trebol-border rounded-sm">
            <div className="flex items-center space-x-2 text-trebol-text">
              <Clock size={20} className={seconds >= 45 ? 'text-trebol-primary' : 'text-trebol-secondary'} />
              <span className="font-black text-xl">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>
            </div>
            <div className="text-sm font-bold text-trebol-text opacity-40">Objetivo: 01:00</div>
          </div>
        </div>

        <div className="flex flex-col space-y-6 justify-center h-full">
          <div className="bg-white p-6 border-2 border-trebol-border rounded-sm shadow-sm space-y-4">
            <h3 className="font-black text-trebol-text flex items-center space-x-2">
              <span className="w-2 h-2 bg-trebol-primary rounded-full"></span>
              <span>Estado de la práctica</span>
            </h3>
            {isRecording ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-3 text-trebol-primary animate-pulse">
                  <div className="w-3 h-3 bg-trebol-primary rounded-full"></div>
                  <span className="font-black">Grabando... ¡sigue hablando!</span>
                </div>
                <p className="text-sm text-trebol-text opacity-70 font-medium">
                  Intenta describir los detalles del fondo y lo que las personas llevan puesto si te quedas sin ideas.
                </p>
                <Button
                  variant="danger"
                  size="lg"
                  className="w-full py-6 text-xl rounded-full"
                  onClick={stopRecording}
                >
                  <Square size={24} fill="currentColor" className="mr-2" />
                  Finalizar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-trebol-text font-medium">
                  Cuando estés listo, pulsa el botón para empezar a grabar tu descripción.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full py-6 text-xl rounded-full"
                  onClick={startRecording}
                >
                  <Mic size={24} className="mr-2" />
                  Empezar a Grabar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
