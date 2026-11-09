/** Geometry from Stitch's option A; B translates the same mark up 20 units.
 * Shared by the native SVG component and scripts/generate-brand-icons.mjs.
 * Source: projects/17315762413421369447/screens/ed67babc7b7e4195b520cfd8caee0ff2
 * The earlier aa3b2b29 brand sheet supplies the Deep Navy icon background;
 * the later comparison sheet supplies the approved continuous ribbon. */
export const logoPaths = {
  ribbon: 'M200 160 C164 96 92 80 56 124 C22 168 32 220 120 278 C152 250 178 208 200 160 C222 208 248 250 280 278 C368 220 378 168 344 124 C308 80 236 96 200 160 Z',
  beam: 'M200 140 C164 76 92 60 56 104 C22 148 32 200 120 258 C152 230 178 188 200 140 C222 188 248 230 280 258 C368 200 378 148 344 104 C308 60 236 76 200 140',
  optionBStars: ['M200 32 Q200 44 188 44 Q200 44 200 56 Q200 44 212 44 Q200 44 200 32 Z', 'M324 46 Q324 54 316 54 Q324 54 324 62 Q324 54 332 54 Q324 54 332 46 Z'],
  bridge: 'M176 196 C190 174 208 148 222 126',
  highlights: ['M72 114 C94 94 142 94 178 136', 'M222 136 C258 94 306 94 328 114'],
  stars: ['M200 42 Q200 54 188 54 Q200 54 200 66 Q200 54 212 54 Q200 54 200 42 Z', 'M324 56 Q324 64 316 64 Q324 64 324 72 Q324 64 332 64 Q324 64 324 56 Z'],
} as const
