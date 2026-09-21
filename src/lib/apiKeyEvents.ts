export const OPEN_API_KEY_MODAL_EVENT = 'bedrock_open_api_key_modal';
export const API_KEYS_UPDATED_EVENT = 'bedrock_api_keys_updated';

export interface OpenApiKeyModalDetail {
  errorMessage?: string;
}

export function openApiKeyModal(errorMessage?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<OpenApiKeyModalDetail>(OPEN_API_KEY_MODAL_EVENT, {
      detail: { errorMessage },
    })
  );
}
