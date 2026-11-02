// Which browser-storage entries go into a "workspace backup" file and may be restored from one.
// Same rule for export and import, web and desktop. A backup file can come from anywhere (a download,
// a chat attachment), so it must never be able to set who the user is, their credentials, or their consent.
const NEVER_IN_BACKUP = new Set([
  'bedrock_api_keys', // the user's own provider keys
  'bedrock_token', // session token handed over by the desktop sign-in
  'bedrock_auth_token',
  'bedrock_auth_session',
  'bedrock_auth_event',
  'bedrock_active_user_id',
  'bedrock_desktop_auth_pending', // one-time desktop sign-in code
  'bedrock_privacy_settings', // analytics consent must come from the user, not from a file
  'bedrock_user_profile', // name, email and plan come from the signed-in account
]);

export function isBackupKey(key: string): boolean {
  return key.startsWith('bedrock_') && !NEVER_IN_BACKUP.has(key);
}
