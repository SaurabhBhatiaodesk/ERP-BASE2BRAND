import { app, BrowserWindow, ipcMain, powerMonitor, desktopCapturer, systemPreferences } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
      mainWindow.webContents.openDevTools();
    } else {
      // In production, load the built index.html
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Block Ctrl+W (Windows) and Cmd+W (Mac) from closing the window
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if ((input.control || input.meta) && input.key.toLowerCase() === 'w') {
        event.preventDefault();
      }
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure app is ready before creating window
app.whenReady().then(() => {
  // Required for Windows Toast Notifications to work in the .exe
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.base2brand.erp');
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Handle IPC request for system idle time
  ipcMain.handle('get-system-idle-time', () => {
    // returns idle time in seconds
    return powerMonitor.getSystemIdleTime();
  });

  // Handle IPC request for screenshot
  ipcMain.handle('take-screenshot', async () => {
    try {
      if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('screen');
        if (status !== 'granted') {
          return null; // Return null silently to avoid repeatedly triggering OS prompts if denied
        }
      }

      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
      if (sources.length > 0) {
        // Return base64 encoded image compressed as JPEG (quality 60) for fast uploads
        return 'data:image/jpeg;base64,' + sources[0].thumbnail.toJPEG(60).toString('base64');
      }
      return null;
    } catch (err) {
      console.error("Screenshot error:", err);
      return null;
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
