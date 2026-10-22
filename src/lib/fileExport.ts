import { isDesktopApp } from './platform';

const STORAGE_KEY_PROJECT_DIR = 'bedrock_project_directory';
const EVENT_PROJECT_DIR = 'bedrock_project_dir_changed';

export interface FileSaveResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  fileName?: string;
  folderPath?: string;
  error?: string;
}

/**
 * Returns the currently active project folder path saved by the user.
 */
export function getSavedProjectFolder(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_PROJECT_DIR);
}

/**
 * Persists the project folder path and notifies subscribers across the app.
 */
export function setSavedProjectFolder(folderPath: string | null): void {
  if (typeof window === 'undefined') return;
  if (!folderPath) {
    localStorage.removeItem(STORAGE_KEY_PROJECT_DIR);
  } else {
    localStorage.setItem(STORAGE_KEY_PROJECT_DIR, folderPath);
  }
  window.dispatchEvent(new CustomEvent(EVENT_PROJECT_DIR, { detail: folderPath }));
}

/**
 * Prompts the user with a native OS directory picker to choose a local codebase folder.
 */
export async function pickProjectFolder(): Promise<string | null> {
  // 1. Electron Desktop Native Dialog
  if (isDesktopApp() && typeof (window as any).electronFile?.selectFolder === 'function') {
    try {
      const res = await (window as any).electronFile.selectFolder();
      if (!res.canceled && res.folderPath) {
        setSavedProjectFolder(res.folderPath);
        return res.folderPath;
      }
      return null;
    } catch (err: any) {
      console.error('[FileExport] Electron folder selection failed:', err);
      return null;
    }
  }

  // 2. Modern Web File System Access API (Chromium / Edge / Opera)
  if (typeof (window as any).showDirectoryPicker === 'function') {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        id: 'bedrock-project-folder',
        mode: 'readwrite',
      });
      const folderName = dirHandle.name || 'Workspace';
      setSavedProjectFolder(folderName);
      return folderName;
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('[FileExport] showDirectoryPicker error:', err);
      }
      return null;
    }
  }

  return null;
}

/**
 * Saves a rule file (.cursorrules, CLAUDE.md, .windsurfrules, etc.) directly to the user's project folder with 1 click.
 */
export async function saveRuleFileDirectly(
  fileName: string,
  content: string,
  explicitFolder?: string
): Promise<FileSaveResult> {
  const isDesktop = isDesktopApp();
  const electronFile = (window as any).electronFile;

  // 1. Desktop Mode (Electron Native Write)
  if (isDesktop && electronFile?.saveToFolder) {
    let targetFolder = explicitFolder || getSavedProjectFolder();

    // If no folder has been set yet, prompt user to select their project folder
    if (!targetFolder) {
      targetFolder = await pickProjectFolder();
      if (!targetFolder) {
        return { success: false, canceled: true };
      }
    }

    try {
      const res = await electronFile.saveToFolder({
        folderPath: targetFolder,
        fileName,
        content,
      });

      if (res?.success) {
        return {
          success: true,
          filePath: res.filePath,
          fileName,
          folderPath: targetFolder,
        };
      } else {
        return {
          success: false,
          error: res?.error || 'Failed to write file to disk',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Filesystem error during write',
      };
    }
  }

  // 2. Desktop Mode "Save As..." native dialog fallback
  if (isDesktop && electronFile?.saveWithDialog) {
    try {
      const res = await electronFile.saveWithDialog({
        defaultFileName: fileName,
        content,
        title: `Save ${fileName} to Project`,
      });
      if (res?.canceled) {
        return { success: false, canceled: true };
      }
      if (res?.success) {
        return {
          success: true,
          filePath: res.filePath,
          fileName,
        };
      }
    } catch (err: any) {
      console.warn('[FileExport] Save dialog error:', err);
    }
  }

  // 3. Web Fallback (Browser File Download)
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return {
      success: true,
      fileName,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Download error',
    };
  }
}

/**
 * Saves multiple rule files (.cursorrules, CLAUDE.md, .windsurfrules) at once to the target project folder.
 */
export async function saveMultipleRuleFiles(
  files: { fileName: string; content: string }[],
  explicitFolder?: string
): Promise<{ success: boolean; savedCount: number; errors: string[] }> {
  let targetFolder = explicitFolder || getSavedProjectFolder();

  if (isDesktopApp() && (window as any).electronFile?.saveToFolder) {
    if (!targetFolder) {
      targetFolder = await pickProjectFolder();
      if (!targetFolder) {
        return { success: false, savedCount: 0, errors: ['No directory selected'] };
      }
    }

    const errors: string[] = [];
    let savedCount = 0;

    for (const f of files) {
      const res = await saveRuleFileDirectly(f.fileName, f.content, targetFolder);
      if (res.success) {
        savedCount++;
      } else if (res.error) {
        errors.push(`${f.fileName}: ${res.error}`);
      }
    }

    return {
      success: savedCount > 0,
      savedCount,
      errors,
    };
  }

  // Web fallback: download each sequentially
  for (const f of files) {
    await saveRuleFileDirectly(f.fileName, f.content);
  }

  return {
    success: true,
    savedCount: files.length,
    errors: [],
  };
}
