ALTER TABLE public.bob_word_images
  DROP CONSTRAINT IF EXISTS bob_word_images_image_type_check;
ALTER TABLE public.bob_word_images
  ADD CONSTRAINT bob_word_images_image_type_check
  CHECK (image_type IN ('scene', 'object_card', 'photo_realistic'));
