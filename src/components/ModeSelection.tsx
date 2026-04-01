import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Image as ImageIcon, Sparkles, Mic2 } from 'lucide-react';

interface ModeSelectionProps {
  onSelect: (mode: 'situation' | 'image' | 'conversation') => void;
}

export function ModeSelection({ onSelect }: ModeSelectionProps) {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-trebol-text tracking-tight">
          Elige tu entrenamiento
        </h2>
        <p className="text-trebol-text font-semibold opacity-60">
          ¿Cómo quieres mejorar tu inglés hoy?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('situation')}
          className="bg-white border-2 border-trebol-border p-8 rounded-sm text-left space-y-4 hover:border-trebol-primary transition-colors group relative overflow-hidden"
        >
          <div className="bg-trebol-secondary/20 p-4 rounded-sm w-fit group-hover:bg-trebol-primary group-hover:text-white transition-colors">
            <MessageSquare size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black text-trebol-text">Práctica de Situación</h3>
            <p className="text-trebol-text opacity-70 font-medium">
              Practica frases útiles para situaciones reales personalizadas por ti.
            </p>
          </div>
          <Sparkles className="absolute -bottom-4 -right-4 text-trebol-secondary opacity-20 group-hover:opacity-100 transition-opacity" size={80} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('image')}
          className="bg-white border-2 border-trebol-border p-8 rounded-sm text-left space-y-4 hover:border-trebol-primary transition-colors group relative overflow-hidden"
        >
          <div className="bg-trebol-secondary/20 p-4 rounded-sm w-fit group-hover:bg-trebol-primary group-hover:text-white transition-colors">
            <ImageIcon size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black text-trebol-text">Descripción de Imagen</h3>
            <p className="text-trebol-text opacity-70 font-medium">
              Prepárate para el examen B1 describiendo escenas generadas por IA.
            </p>
          </div>
          <Sparkles className="absolute -bottom-4 -right-4 text-trebol-secondary opacity-20 group-hover:opacity-100 transition-opacity" size={80} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('conversation')}
          className="bg-white border-2 border-trebol-border p-8 rounded-sm text-left space-y-4 hover:border-trebol-primary transition-colors group relative overflow-hidden"
        >
          <div className="bg-trebol-secondary/20 p-4 rounded-sm w-fit group-hover:bg-trebol-primary group-hover:text-white transition-colors">
            <Mic2 size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black text-trebol-text">Conversación Fluida</h3>
            <p className="text-trebol-text opacity-70 font-medium">
              Interactúa en una conversación real con IA sobre cualquier tema.
            </p>
          </div>
          <Sparkles className="absolute -bottom-4 -right-4 text-trebol-secondary opacity-20 group-hover:opacity-100 transition-opacity" size={80} />
        </motion.button>
      </div>
    </div>
  );
}
