import { createTranslator } from 'use-intl/core';
import errors from '../../../messages/en/errors.json';
import placement from '../../../messages/en/placement.json';
import practice from '../../../messages/en/practice.json';

const messages = { errors, placement, practice };

/** @returns next-intl module double backed by the real English messages */
export function intlMock() {
  return {
    useTranslations: (namespace: keyof typeof messages) =>
      createTranslator({ locale: 'en', messages, namespace } as never),
  };
}
