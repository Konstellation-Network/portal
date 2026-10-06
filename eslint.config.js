import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'packages/sdk/src/schema.ts',
      'packages/db/migrations/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    // Money can buy a streak shield; it can never write XP. Streaks awards the
    // XP for auto-streak hours through awardXp(). Keep payments away from xp.
    files: ['packages/core/src/payments/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/xp', '**/xp.ts', '**/xp/**'],
              message:
                'The payments module must never write XP. Buy a shield; Streaks awards the XP.',
            },
          ],
        },
      ],
    },
  },
);
