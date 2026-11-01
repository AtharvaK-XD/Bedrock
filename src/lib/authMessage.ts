// The sign-in popup tells the sign-in screen it is done with window.postMessage('clerk-auth-complete').
// Any other website that holds a reference to this window could send the same text, so the screen
// believes it only when the message comes from Bedrock's own address.
export const AUTH_COMPLETE_MESSAGE = 'clerk-auth-complete';

export function isTrustedAuthMessage(data: unknown, messageOrigin: string, ownOrigin: string): boolean {
  return data === AUTH_COMPLETE_MESSAGE && Boolean(ownOrigin) && messageOrigin === ownOrigin;
}
