export const OPEN_API_KEY_MODAL_EVENT = 'bedrock_open_api_key_modal';
export const API_KEYS_UPDATED_EVENT = 'bedrock_api_keys_updated';

export interface OpenApiKeyModalDetail {
  errorMessage?: string;
  modelId?: string;
  agentId?: string;
  modelName?: string;
}

export function openApiKeyModal(detailOrError?: string | OpenApiKeyModalDetail) {
  if (typeof window === 'undefined') return;
  const detail: OpenApiKeyModalDetail = typeof detailOrError === 'string'
    ? { errorMessage: detailOrError }
    : (detailOrError || {});
  window.dispatchEvent(
    new CustomEvent<OpenApiKeyModalDetail>(OPEN_API_KEY_MODAL_EVENT, {
      detail,
    })
  );
}
