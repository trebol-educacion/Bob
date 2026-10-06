import { z } from 'zod';
import { GenerationSchema } from '../../actions/modes/pet-p2/contracts';

export const PetPictureGenerationSchema = GenerationSchema;

export const PetPicturePlanSchema = GenerationSchema.extend({
  image_url: z.string().startsWith('https://'),
});

export type PetPicturePlan = z.infer<typeof PetPicturePlanSchema>;
