import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from './Button';
import { Zap, Coffee, ShoppingBag, Palmtree, Utensils, Plane, Briefcase, Dumbbell, GraduationCap, Users } from 'lucide-react';

export type Difficulty = 'basic' | 'intermediate' | 'advanced';

export interface SceneConfig {
  topic: string;
  difficulty: Difficulty;
}

interface ImageConfigSelectionProps {
  onConfirm: (config: SceneConfig) => void;
}

export function ImageConfigSelection({ onConfirm }: ImageConfigSelectionProps) {
  const [selectedTopic, setSelectedTopic] = useState<string>('Daily Life');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('intermediate');

  const topics = [
    { label: 'Daily Life', icon: <Users size={20} /> },
    { label: 'At a Cafe', icon: <Coffee size={20} /> },
    { label: 'Shopping', icon: <ShoppingBag size={20} /> },
    { label: 'Travel', icon: <Plane size={20} /> },
    { label: 'Workplace', icon: <Briefcase size={20} /> },
    { label: 'Nature', icon: <Palmtree size={20} /> },
    { label: 'Restaurant', icon: <Utensils size={20} /> },
    { label: 'Sports', icon: <Dumbbell size={20} /> },
    { label: 'Education', icon: <GraduationCap size={20} /> },
    { label: 'Technology', icon: <Zap size={20} /> },
  ];

  const difficulties: { label: Difficulty; description: string }[] = [
    { label: 'basic', description: 'Escenas simples con pocos objetos.' },
    { label: 'intermediate', description: 'Escenas dinámicas con varias acciones.' },
    { label: 'advanced', description: 'Escenas complejas con muchos detalles y matices.' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-trebol-text tracking-tight">
          Configura tu Escena
        </h2>
        <p className="text-trebol-text font-semibold opacity-60">
          Personaliza el desafío antes de empezar.
        </p>
      </div>

      <div className="space-y-6">
        {/* Temáticas */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-trebol-text uppercase tracking-widest opacity-40">
            1. Elige una Temática
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {topics.map((t) => (
              <button
                key={t.label}
                onClick={() => setSelectedTopic(t.label)}
                className={`flex flex-col items-center justify-center p-4 rounded-sm border-2 transition-all space-y-2 ${
                  selectedTopic === t.label
                    ? 'border-trebol-primary bg-trebol-primary/10 text-trebol-primary'
                    : 'border-trebol-border bg-white text-trebol-text hover:border-trebol-secondary'
                }`}
              >
                {t.icon}
                <span className="text-xs font-bold truncate w-full text-center">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dificultad */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-trebol-text uppercase tracking-widest opacity-40">
            2. Elige la Dificultad
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {difficulties.map((d) => (
              <button
                key={d.label}
                onClick={() => setSelectedDifficulty(d.label)}
                className={`p-4 rounded-sm border-2 text-left transition-all ${
                  selectedDifficulty === d.label
                    ? 'border-trebol-secondary bg-trebol-secondary/10'
                    : 'border-trebol-border bg-white hover:border-trebol-primary/50'
                }`}
              >
                <div className="text-lg font-black text-trebol-text capitalize">{d.label}</div>
                <div className="text-xs font-medium text-trebol-text opacity-60">{d.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4">
        <Button
          variant="primary"
          size="lg"
          className="w-full py-4 text-xl"
          onClick={() => onConfirm({ topic: selectedTopic, difficulty: selectedDifficulty })}
        >
          Generar Escena
        </Button>
      </div>
    </div>
  );
}
