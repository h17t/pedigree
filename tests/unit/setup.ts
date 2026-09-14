import '@testing-library/jest-dom/vitest';
import { loadAllLocales } from '@/i18n';

// Dictionaries other than English are lazy chunks; tests translate synchronously.
await loadAllLocales();
