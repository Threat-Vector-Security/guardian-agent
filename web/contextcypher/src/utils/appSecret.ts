export type FrontendSecretMode = 'local_development' | 'local_production';

export const getFrontendAppSecret = (): string => {
  if (typeof window !== 'undefined' && typeof (window as any).__APP_SECRET__ === 'string') {
    return (window as any).__APP_SECRET__;
  }
  return process.env.REACT_APP_SECRET || 'contextcypher-local-dev-secret';
};

export const getFrontendAppSecretMode = (): FrontendSecretMode => {
  return process.env.NODE_ENV === 'production' ? 'local_production' : 'local_development';
};
