/**
 * The single source of truth for the deployment base path.
 *
 * Vite injects `import.meta.env.BASE_URL` from `base` in vite.config.ts, which in turn
 * comes from the VITE_BASE_PATH environment variable (default '/pedigree/'). The PWA
 * manifest, the service-worker scope and every in-app absolute URL derive from this value,
 * so renaming the repository is a one-variable change.
 */
export const BASE_PATH: string = import.meta.env.BASE_URL;
