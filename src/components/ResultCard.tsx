import React from 'react';
import { motion } from 'motion/react';
import { Button } from './Button';
import { CheckCircle2, ArrowRight, MessageCircle, Clock, Lightbulb, Zap } from 'lucide-react';
import { EvaluationResult } from '@/actions/gemini';

interface ResultCardProps {
  result: EvaluationResult;
  onNext: () => void;
}

export function ResultCard({ result, onNext }: ResultCardProps) {
  const { score, feedback, transcribed_text, details } = result;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-trebol-primary';
    if (score >= 70) return 'text-trebol-secondary';
    return 'text-trebol-primary opacity-70';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      <div className="bg-white border-4 border-trebol-border rounded-sm overflow-hidden shadow-xl">
        {/* Header con Puntuación */}
        <div className="p-8 text-center border-b-2 border-trebol-border bg-trebol-bg">
          <div className="inline-block relative">
            <div className={`text-7xl font-black ${getScoreColor(score)}`}>
              {score}
            </div>
            <div className="text-sm font-bold text-trebol-text uppercase tracking-widest mt-2">
              Puntuación Total
            </div>
          </div>
          <p className="mt-6 text-xl font-bold text-trebol-text">
            {feedback}
          </p>
        </div>

        <div className="p-8 space-y-8">
          {/* Transcripción */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-trebol-text uppercase tracking-widest flex items-center space-x-2">
              <MessageCircle size={18} className="text-trebol-secondary" />
              <span>Lo que dijiste</span>
            </h3>
            <div className="bg-trebol-bg p-4 rounded-sm border-2 border-trebol-border italic text-trebol-text font-medium leading-relaxed">
              "{transcribed_text}"
            </div>
          </div>

          {/* Detalles Potentes si existen */}
          {details && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <DetailItem 
                  icon={<Zap size={18} className="text-yellow-500" />} 
                  title="Contenido (4 Ws)" 
                  text={details.content_coverage} 
                />
                <DetailItem 
                  icon={<Clock size={18} className="text-blue-500" />} 
                  title="Duración" 
                  text={details.duration_feedback} 
                />
                <DetailItem 
                  icon={<CheckCircle2 size={18} className="text-green-500" />} 
                  title="Claridad" 
                  text={details.clarity} 
                />
              </div>
              <div className="bg-trebol-secondary/5 p-6 rounded-sm border-2 border-trebol-secondary/20 space-y-4">
                <h3 className="font-black text-trebol-text flex items-center space-x-2">
                  <Lightbulb size={20} className="text-trebol-secondary" />
                  <span>Consejos Pro</span>
                </h3>
                <ul className="space-y-3">
                  {details.improvement_tips.map((tip, idx) => (
                    <li key={idx} className="text-sm font-medium text-trebol-text opacity-80 flex items-start space-x-2">
                      <span className="text-trebol-secondary font-bold">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-trebol-bg border-t-2 border-trebol-border flex flex-col sm:flex-row gap-4">
          <Button
            variant="primary"
            size="lg"
            className="flex-1 py-4 text-xl"
            onClick={onNext}
          >
            <span>Siguiente</span>
            <ArrowRight size={20} className="ml-2" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function DetailItem({ icon, title, text }: { icon: React.ReactNode, title: string, text: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center space-x-2 text-xs font-black text-trebol-text/40 uppercase tracking-tighter">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-sm font-bold text-trebol-text leading-snug">
        {text}
      </p>
    </div>
  );
}
