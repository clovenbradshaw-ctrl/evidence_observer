/**
 * AI Service — LLM API Client
 * Calls Claude (Anthropic) or OpenAI APIs directly from the browser.
 * API keys are stored in localStorage and never leave the client except
 * to the chosen provider's endpoint.
 */

import { getAPIKey, getProvider, getModel } from './settings.js';

const ENDPOINTS = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions'
};

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o'
};

/**
 * Send a prompt to the configured LLM provider.
 *
 * @param {string} systemPrompt - System-level instructions
 * @param {string} userPrompt - The user/analysis prompt
 * @param {Object} [options] - { maxTokens, temperature }
 * @returns {Promise<{success: boolean, text: string, usage: Object, error?: string}>}
 */
export async function callLLM(systemPrompt, userPrompt, options = {}) {
  const provider = getProvider();
  const apiKey = getAPIKey(provider);
  const model = getModel(provider);

  if (!apiKey) {
    return {
      success: false,
      text: '',
      usage: {},
      error: `No API key configured for ${provider}. Go to AI Settings to add one.`
    };
  }

  const { maxTokens = 4096, temperature = 0.2 } = options;

  try {
    if (provider === 'anthropic') {
      return await _callAnthropic(apiKey, model, systemPrompt, userPrompt, maxTokens, temperature);
    } else {
      return await _callOpenAI(apiKey, model, systemPrompt, userPrompt, maxTokens, temperature);
    }
  } catch (err) {
    return {
      success: false,
      text: '',
      usage: {},
      error: `API call failed: ${err.message}`
    };
  }
}

async function _callAnthropic(apiKey, model, systemPrompt, userPrompt, maxTokens, temperature) {
  const response = await fetch(ENDPOINTS.anthropic, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODELS.anthropic,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const text = data.content?.map(c => c.text).join('') || '';

  return {
    success: true,
    text,
    usage: data.usage || {},
    model: data.model
  };
}

async function _callOpenAI(apiKey, model, systemPrompt, userPrompt, maxTokens, temperature) {
  const response = await fetch(ENDPOINTS.openai, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODELS.openai,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  return {
    success: true,
    text,
    usage: data.usage || {},
    model: data.model
  };
}

/**
 * Check if the AI service is configured and ready.
 */
export function isAIConfigured() {
  const provider = getProvider();
  const key = getAPIKey(provider);
  return !!key;
}
