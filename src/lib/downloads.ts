import { version } from '../../package.json';

/** Where the installers are published (the same repository the desktop auto-updater reads). */
const RELEASES_REPO = 'https://github.com/Bedrockxai/Bedrock';

/** The Windows installer is always attached to the latest release under this fixed name. */
export const WINDOWS_DOWNLOAD_URL = `${RELEASES_REPO}/releases/latest/download/Bedrock-Setup.exe`;

/** The Mac build is published on its own release, tagged with the app version plus "-mac". */
export const MAC_DOWNLOAD_URL = `${RELEASES_REPO}/releases/download/v${version}-mac/Bedrock-Mac.dmg`;

export const SOURCE_REPO_URL = RELEASES_REPO;
export const APP_VERSION = version;
