/**
 * Known apps and websites MAVE can open by name, in Thai or English.
 * Users can extend both catalogs from settings (see createBuiltinTools options).
 */

export interface AppEntry {
  id: string;
  title: string;
  /** Names a user may say: English and Thai. Lowercase. */
  aliases: string[];
  /** What to start, per platform. `uri:` entries are opened as URIs. */
  windows?: string;
  darwin?: string;
  linux?: string;
}

export interface SiteEntry {
  id: string;
  title: string;
  aliases: string[];
  url: string;
}

export const DEFAULT_APPS: AppEntry[] = [
  { id: 'vscode', title: 'Visual Studio Code', aliases: ['vscode', 'vs code', 'code', 'visual studio code', 'วีเอสโค้ด'], windows: 'code', darwin: 'Visual Studio Code', linux: 'code' },
  { id: 'chrome', title: 'Google Chrome', aliases: ['chrome', 'google chrome', 'โครม', 'กูเกิลโครม'], windows: 'chrome', darwin: 'Google Chrome', linux: 'google-chrome' },
  { id: 'edge', title: 'Microsoft Edge', aliases: ['edge', 'microsoft edge', 'เอดจ์'], windows: 'msedge', darwin: 'Microsoft Edge', linux: 'microsoft-edge' },
  { id: 'explorer', title: 'File Explorer', aliases: ['explorer', 'file explorer', 'files', 'finder', 'ไฟล์', 'โฟลเดอร์'], windows: 'explorer', darwin: 'Finder', linux: 'xdg-open' },
  { id: 'terminal', title: 'Terminal', aliases: ['terminal', 'cmd', 'powershell', 'เทอร์มินัล'], windows: 'wt', darwin: 'Terminal', linux: 'x-terminal-emulator' },
  { id: 'notepad', title: 'Notepad', aliases: ['notepad', 'โน้ตแพด', 'โน๊ตแพด'], windows: 'notepad', darwin: 'TextEdit', linux: 'gedit' },
  { id: 'calculator', title: 'Calculator', aliases: ['calculator', 'calc', 'เครื่องคิดเลข'], windows: 'calc', darwin: 'Calculator', linux: 'gnome-calculator' },
  { id: 'spotify', title: 'Spotify', aliases: ['spotify', 'สปอติฟาย'], windows: 'uri:spotify:', darwin: 'Spotify', linux: 'spotify' },
  { id: 'discord', title: 'Discord', aliases: ['discord', 'ดิสคอร์ด'], windows: 'uri:discord:', darwin: 'Discord', linux: 'discord' },
  { id: 'line', title: 'LINE', aliases: ['line', 'ไลน์'], windows: 'uri:line:', darwin: 'LINE' },
  { id: 'settings', title: 'Settings', aliases: ['settings', 'ตั้งค่า', 'การตั้งค่า'], windows: 'uri:ms-settings:', darwin: 'System Settings', linux: 'gnome-control-center' },
  { id: 'task_manager', title: 'Task Manager', aliases: ['task manager', 'ทาสก์เมเนเจอร์', 'ตัวจัดการงาน'], windows: 'taskmgr', darwin: 'Activity Monitor', linux: 'gnome-system-monitor' }
];

export const DEFAULT_SITES: SiteEntry[] = [
  { id: 'youtube', title: 'YouTube', aliases: ['youtube', 'yt', 'ยูทูป', 'ยูทูบ'], url: 'https://www.youtube.com' },
  { id: 'google', title: 'Google', aliases: ['google', 'กูเกิล', 'กูเกิ้ล'], url: 'https://www.google.com' },
  { id: 'gmail', title: 'Gmail', aliases: ['gmail', 'จีเมล', 'อีเมล', 'email', 'mail'], url: 'https://mail.google.com' },
  { id: 'github', title: 'GitHub', aliases: ['github', 'กิตฮับ'], url: 'https://github.com' },
  { id: 'facebook', title: 'Facebook', aliases: ['facebook', 'fb', 'เฟสบุ๊ค', 'เฟซบุ๊ก', 'เฟส'], url: 'https://www.facebook.com' },
  { id: 'chatgpt', title: 'ChatGPT', aliases: ['chatgpt', 'แชทจีพีที'], url: 'https://chatgpt.com' },
  { id: 'claude', title: 'Claude', aliases: ['claude', 'claude ai', 'คล็อด'], url: 'https://claude.ai' },
  { id: 'gemini', title: 'Gemini', aliases: ['gemini', 'เจมินี'], url: 'https://gemini.google.com' },
  { id: 'calendar', title: 'Google Calendar', aliases: ['calendar', 'google calendar', 'ปฏิทิน'], url: 'https://calendar.google.com' },
  { id: 'drive', title: 'Google Drive', aliases: ['drive', 'google drive', 'ไดรฟ์'], url: 'https://drive.google.com' },
  { id: 'maps', title: 'Google Maps', aliases: ['maps', 'google maps', 'แผนที่'], url: 'https://maps.google.com' },
  { id: 'translate', title: 'Google Translate', aliases: ['translate', 'google translate', 'แปลภาษา', 'กูเกิลแปล'], url: 'https://translate.google.com' },
  { id: 'netflix', title: 'Netflix', aliases: ['netflix', 'เน็ตฟลิกซ์'], url: 'https://www.netflix.com' },
  { id: 'tiktok', title: 'TikTok', aliases: ['tiktok', 'ติ๊กต็อก', 'ติกตอก'], url: 'https://www.tiktok.com' }
];

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?。]+$/u, '');
}

export function findApp(name: string, apps: AppEntry[] = DEFAULT_APPS): AppEntry | undefined {
  const n = normalizeName(name);
  return apps.find((a) => a.id === n || a.aliases.includes(n));
}

export function findSite(name: string, sites: SiteEntry[] = DEFAULT_SITES): SiteEntry | undefined {
  const n = normalizeName(name);
  return sites.find((s) => s.id === n || s.aliases.includes(n));
}

export function appTargetFor(app: AppEntry, platform: NodeJS.Platform): string | undefined {
  if (platform === 'win32') return app.windows;
  if (platform === 'darwin') return app.darwin;
  return app.linux;
}
