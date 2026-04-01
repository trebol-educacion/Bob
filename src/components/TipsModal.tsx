import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Info, X } from 'lucide-react';
import { Button } from './Button';

interface TipsModalProps {
  onClose: () => void;
}

export function TipsModal({ onClose }: TipsModalProps) {
  const strategies = [
    {
      title: "La Estrategia de las 4 Ws",
      tips: [
        "Who? ¿Quiénes son? (edades, relaciones)",
        "What? ¿Qué están haciendo? (usa Present Continuous)",
        "Where? ¿Dónde están ubicados?",
        "When? ¿Qué momento del día o estación es?"
      ]
    },
    {
      title: "Vocabulario Espacial",
      tips: [
        "In the middle/background of the photo...",
        "On the left/right of the picture...",
        "Behind the people, there is a..."
      ]
    },
    {
      title: "Especulación (Puntos extra)",
      tips: [
        "Usa frases como 'Perhaps', 'Maybe' o 'It looks like...'",
        "Prueba con modales: 'They might be...', 'I guess...'"
      ]
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-sm w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 bg-trebol-primary text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
            <Info size={24} />
            <h2 className="text-xl font-black">Consejos de Experto (B1)</h2>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-sm transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto">
          {strategies.map((section, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className="text-lg font-bold text-trebol-text flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-trebol-secondary rounded-full" />
                <span>{section.title}</span>
              </h3>
              <ul className="space-y-2 pl-4">
                {section.tips.map((tip, tIdx) => (
                  <li key={tIdx} className="flex items-start space-x-2 text-trebol-text opacity-80 font-medium">
                    <CheckCircle2 size={18} className="text-trebol-primary mt-1 shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          
          <div className="bg-trebol-secondary/10 p-4 border-l-4 border-trebol-secondary rounded-r-sm">
            <p className="text-sm font-bold text-trebol-text">
              💡 Objetivo: Intenta hablar durante 60 segundos seguidos sin pausas largas.
            </p>
          </div>
        </div>

        <div className="p-6 border-t shrink-0">
          <Button
            variant="primary"
            className="w-full py-4 text-lg"
            onClick={onClose}
          >
            ¡Entendido, vamos!
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
