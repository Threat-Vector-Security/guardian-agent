import { execFile as execFileCb } from 'node:child_process';

export interface NativePathPickerResult {
  success: boolean;
  path?: string;
  canceled?: boolean;
  message: string;
}

type PathPickerKind = 'directory' | 'file';
type NativePathPickerBackend = 'windows' | 'macos' | 'linux-zenity' | 'linux-kdialog';

interface NativePathPickerOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  execFile?: typeof execFileCb;
}

function buildWindowsPickerScript(kind: PathPickerKind): string {
  return kind === 'file'
    ? `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Select a file to index'
$dialog.CheckFileExists = $true
$dialog.Multiselect = $false
$dialog.InitialDirectory = [Environment]::GetFolderPath('MyDocuments')
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$owner.Location = New-Object System.Drawing.Point(-32000, -32000)
$owner.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
$null = $owner.Show()
$owner.Activate()
$result = $dialog.ShowDialog($owner)
$owner.Close()
if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $dialog.FileName) {
  @{ success = $true; canceled = $false; path = $dialog.FileName; message = 'File selected.' } | ConvertTo-Json -Compress
} else {
  @{ success = $false; canceled = $true; message = 'Selection cancelled.' } | ConvertTo-Json -Compress
}
`
    : `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Select a directory to index'
$dialog.ShowNewFolderButton = $false
$dialog.SelectedPath = [Environment]::GetFolderPath('MyDocuments')
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$owner.Location = New-Object System.Drawing.Point(-32000, -32000)
$owner.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
$null = $owner.Show()
$owner.Activate()
$result = $dialog.ShowDialog($owner)
$owner.Close()
if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $dialog.SelectedPath) {
  @{ success = $true; canceled = $false; path = $dialog.SelectedPath; message = 'Directory selected.' } | ConvertTo-Json -Compress
} else {
  @{ success = $false; canceled = $true; message = 'Selection cancelled.' } | ConvertTo-Json -Compress
}
`;
}

function buildMacOsPickerScript(kind: PathPickerKind): string {
  return kind === 'file'
    ? `
try
  POSIX path of (choose file with prompt "Select a file to index")
on error number -128
  "__CANCELED__"
end try
`
    : `
try
  POSIX path of (choose folder with prompt "Select a directory to index")
on error number -128
  "__CANCELED__"
end try
`;
}

function execFileAsync(
  execFile: typeof execFileCb,
  file: string,
  args: string[],
  options: Parameters<typeof execFileCb>[2],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({
        stdout: typeof stdout === 'string' ? stdout : stdout.toString('utf8'),
        stderr: typeof stderr === 'string' ? stderr : stderr.toString('utf8'),
      });
    });
  });
}

async function commandExists(
  command: string,
  execFile: typeof execFileCb,
): Promise<boolean> {
  try {
    await execFileAsync(execFile, 'which', [command], {
      timeout: 5_000,
      windowsHide: true,
      maxBuffer: 64 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

function hasLinuxDesktopSession(env: NodeJS.ProcessEnv): boolean {
  return typeof env.DISPLAY === 'string'
    || typeof env.WAYLAND_DISPLAY === 'string'
    || typeof env.MIR_SOCKET === 'string';
}

export async function resolveNativePathPickerBackend(
  options: Pick<NativePathPickerOptions, 'platform' | 'env' | 'execFile'> = {},
): Promise<NativePathPickerBackend | null> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const execFile = options.execFile ?? execFileCb;

  if (platform === 'win32') {
    return 'windows';
  }

  if (platform === 'linux' && (
    typeof env.WSL_DISTRO_NAME === 'string'
    || typeof env.WSL_INTEROP === 'string'
  )) {
    return 'windows';
  }

  if (platform === 'darwin') {
    return 'macos';
  }

  if (platform !== 'linux' || !hasLinuxDesktopSession(env)) {
    return null;
  }

  if (await commandExists('zenity', execFile)) {
    return 'linux-zenity';
  }
  if (await commandExists('kdialog', execFile)) {
    return 'linux-kdialog';
  }
  return null;
}

export async function pickNativeSearchPath(
  kind: PathPickerKind,
  options: NativePathPickerOptions = {},
): Promise<NativePathPickerResult> {
  const execFile = options.execFile ?? execFileCb;
  const backend = await resolveNativePathPickerBackend(options);
  if (!backend) {
    return {
      success: false,
      canceled: false,
      message: 'Native path picker is currently available on Windows, macOS, and desktop Linux hosts.',
    };
  }

  try {
    let stdout = '';
    if (backend === 'windows') {
      const result = await execFileAsync(
        execFile,
        'powershell.exe',
        ['-NoProfile', '-STA', '-Command', buildWindowsPickerScript(kind)],
        { timeout: 300_000, windowsHide: false, maxBuffer: 1024 * 1024 },
      );
      stdout = result.stdout;
    } else if (backend === 'macos') {
      const result = await execFileAsync(
        execFile,
        'osascript',
        ['-e', buildMacOsPickerScript(kind)],
        { timeout: 300_000, windowsHide: true, maxBuffer: 1024 * 1024 },
      );
      stdout = result.stdout;
    } else if (backend === 'linux-zenity') {
      const args = kind === 'file'
        ? ['--file-selection', '--title=Select a file to index']
        : ['--file-selection', '--directory', '--title=Select a directory to index'];
      const result = await execFileAsync(
        execFile,
        'zenity',
        args,
        { timeout: 300_000, windowsHide: true, maxBuffer: 1024 * 1024 },
      );
      stdout = result.stdout;
    } else {
      const args = kind === 'file'
        ? ['--getopenfilename', '/']
        : ['--getexistingdirectory', '/'];
      const result = await execFileAsync(
        execFile,
        'kdialog',
        args,
        { timeout: 300_000, windowsHide: true, maxBuffer: 1024 * 1024 },
      );
      stdout = result.stdout;
    }

    const trimmed = stdout.trim();
    if (!trimmed || trimmed === '__CANCELED__') {
      return {
        success: false,
        canceled: true,
        message: 'Selection cancelled.',
      };
    }
    if (backend === 'windows') {
      const parsed = JSON.parse(trimmed) as {
        success?: boolean;
        path?: string;
        canceled?: boolean;
        message?: string;
      };
      return {
        success: parsed.success === true,
        path: typeof parsed.path === 'string' ? parsed.path : undefined,
        canceled: parsed.canceled === true,
        message: typeof parsed.message === 'string'
          ? parsed.message
          : (parsed.success ? 'Path selected.' : 'Selection cancelled.'),
      };
    }
    return {
      success: true,
      path: trimmed,
      canceled: false,
      message: kind === 'file' ? 'File selected.' : 'Directory selected.',
    };
  } catch (err) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as { code?: string | number }).code : undefined;
    if (code === 1 || code === -128) {
      return {
        success: false,
        canceled: true,
        message: 'Selection cancelled.',
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      canceled: false,
      message: `Failed to open native ${kind} picker: ${message}`,
    };
  }
}
