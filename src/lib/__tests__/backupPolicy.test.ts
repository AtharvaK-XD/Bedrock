import { describe, expect, it } from 'vitest';
import { isBackupKey } from '../backupPolicy';
import settingsSource from '../../pages/Settings.tsx?raw';

describe('workspace backup policy', () => {
  it('never exports or restores credentials, identity or consent', () => {
    for (const key of [
      'bedrock_api_keys', 'bedrock_token', 'bedrock_auth_token', 'bedrock_auth_session', 'bedrock_auth_event',
      'bedrock_active_user_id', 'bedrock_desktop_auth_pending', 'bedrock_privacy_settings', 'bedrock_user_profile',
    ]) {
      expect(isBackupKey(key), key).toBe(false);
    }
  });

  it('keeps ordinary Bedrock settings and work', () => {
    for (const key of ['bedrock_appearance_settings', 'bedrock_model_settings', 'bedrock_prompt_library', 'bedrock_saved_workflows', 'bedrock_generator_history']) {
      expect(isBackupKey(key), key).toBe(true);
    }
  });

  it('ignores anything that is not a Bedrock key', () => {
    expect(isBackupKey('clerk_db_jwt')).toBe(false);
    expect(isBackupKey('__proto__')).toBe(false);
  });

  it('is what the Settings page uses for both download and restore', () => {
    expect(settingsSource.match(/isBackupKey\(/g)?.length).toBe(2);
    expect(settingsSource).not.toMatch(/BACKUP_IMPORT_BLOCKED_KEYS/);
  });
});
