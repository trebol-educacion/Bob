'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ModeSelection } from '@/components/ModeSelection';
import type { Organization } from '@/lib/organization';
import type { PracticeMode, CefrLevel, ModeKey } from '@/lib/types/practice';
import type { Skill, SkillLevelMap } from '@/lib/types/skills';
import type { AvailableMode } from '@/lib/organization/types';

export interface ModeSelectorViewProps {
  organization: Organization | null;
  cefrSelectorRef: React.RefObject<HTMLDivElement | null>;
  handleModeSelect: (m: PracticeMode) => void;
  enabledModes: ModeKey[];
  availableModes: AvailableMode[];
  skillLevels: SkillLevelMap | null;
  selectedSkill: Skill | null;
  cefrActiveLevel: CefrLevel | null;
  cefrLevelLocked: boolean;
}

export function ModeSelectorView({
  organization,
  cefrSelectorRef,
  handleModeSelect,
  enabledModes,
  availableModes,
  skillLevels,
  selectedSkill,
  cefrActiveLevel,
  cefrLevelLocked,
}: ModeSelectorViewProps) {
  const t = useTranslations('home.bobUnavailable');

  if (organization && organization.is_bob_enabled === false) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="bg-white shadow-md rounded-2xl p-10 max-w-md w-full space-y-3">
          <p className="text-2xl font-black text-trebol-text">{t('title')}</p>
          <p className="text-trebol-text opacity-60 font-medium text-sm">
            {t('body')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ModeSelection
      ref={cefrSelectorRef}
      onSelect={handleModeSelect}
      enabledModes={enabledModes}
      availableModes={availableModes}
      cefrActiveLevel={(selectedSkill ? skillLevels?.[selectedSkill]?.cefr_level : null) ?? cefrActiveLevel}
      cefrLevelLocked={cefrLevelLocked}
      organizationName={organization?.name}
    />
  );
}
