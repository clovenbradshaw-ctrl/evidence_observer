/**
 * AI Settings — API Key & Provider Management
 * Stores configuration in localStorage. Keys never leave the browser
 * except when sent to the chosen provider's API endpoint.
 */

const STORAGE_PREFIX = 'eo_ai_';

/**
 * Get the active provider ('anthropic' or 'openai').
 */
export function getProvider() {
  return localStorage.getItem(`${STORAGE_PREFIX}provider`) || 'anthropic';
}

/**
 * Set the active provider.
 */
export function setProvider(provider) {
  localStorage.setItem(`${STORAGE_PREFIX}provider`, provider);
}

/**
 * Get the API key for a provider.
 */
export function getAPIKey(provider) {
  return localStorage.getItem(`${STORAGE_PREFIX}key_${provider}`) || '';
}

/**
 * Set the API key for a provider.
 */
export function setAPIKey(provider, key) {
  localStorage.setItem(`${STORAGE_PREFIX}key_${provider}`, key);
}

/**
 * Get the model override for a provider (or empty for default).
 */
export function getModel(provider) {
  return localStorage.getItem(`${STORAGE_PREFIX}model_${provider}`) || '';
}

/**
 * Set the model override for a provider.
 */
export function setModel(provider, model) {
  localStorage.setItem(`${STORAGE_PREFIX}model_${provider}`, model);
}

/**
 * Clear all AI settings.
 */
export function clearSettings() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
}

/**
 * Get saved custom modules from localStorage.
 */
export function getSavedModules() {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}custom_modules`);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Save custom modules to localStorage.
 */
export function saveSavedModules(modules) {
  localStorage.setItem(`${STORAGE_PREFIX}custom_modules`, JSON.stringify(modules));
}
