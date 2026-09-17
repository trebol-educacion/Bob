'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ModeSelection } from '@/components/ModeSelection';
import type { AppState } from '@/lib/routing';
import type { Organization } from '@/lib/organization';
import type { PracticeMode, CefrLevel, ModeKey } from '@/lib/types/practice';
import type { Skill, SkillLevelMap } from '@/lib/types/skills';
import type { AvailableMode } from '@/lib/organization/types';

export interface CatalogViewProps {
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  sustainedImprovementDetected: boolean | null;
  selectedSkill: Skill | null;
  cefrSelectorRef: React.RefObject<HTMLDivElement | null>;
  handleModeSelect: (m: PracticeMode) => void;
  enabledModes: ModeKey[];
  availableModes: AvailableMode[];
  skillLevels: SkillLevelMap | null;
  cefrActiveLevel: CefrLevel | null;
  cefrLevelLocked: boolean;
  organization: Organization | null;
}

export function CatalogView({
  setAppState,
  sustainedImprovementDetected,
  selectedSkill,
  cefrSelectorRef,
  handleModeSelect,
  enabledModes,
  availableModes,
  skillLevels,
  cefrActiveLevel,
  cefrLevelLocked,
  organization,
}: CatalogViewProps) {
  return (
    <>
      <div className="px-4 pt-4">
        <button
          onClick={() => setAppState('skill-selection')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium mb-2"
        >
          ← Back
        </button>
        {sustainedImprovementDetected === true && selectedSkill && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-green-50 border border-green-200 px-4 py-3"
          >
            <div>
              <p className="text-sm font-black text-green-800">Ready to level up?</p>
              <p className="text-xs text-green-600 font-medium mt-0.5">
                Your recent sessions show strong accuracy. Take an Assessment to confirm your next level.
              </p>
            </div>
            <button
              onClick={() => setAppState('assessment-invite')}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-black hover:bg-green-700 transition-colors shadow-sm"
            >
              Take Assessment
            </button>
          </motion.div>
        )}
      </div>
      <ModeSelection
        ref={cefrSelectorRef}
        onSelect={handleModeSelect}
        enabledModes={enabledModes}
        availableModes={availableModes}
        cefrActiveLevel={(selectedSkill ? skillLevels?.[selectedSkill]?.cefr_level : null) ?? cefrActiveLevel}
        cefrLevelLocked={cefrLevelLocked}
        organizationName={organization?.name}
      />
    </>
  );
}
