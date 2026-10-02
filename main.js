const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let notificationWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      zoomFactor: 1.0
    }
  });

  mainWindow.loadFile('login.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.setZoomLevel(0);
    mainWindow.webContents.setZoomFactor(1);
    mainWindow.show();
  });

  const resetZoom = () => {
    try {
      mainWindow.webContents.setZoomLevel(0);
      mainWindow.webContents.setZoomFactor(1);
    } catch (_) {}
    mainWindow.webContents.send('window-resized');
  };

  mainWindow.on('resize', () => resetZoom());
  mainWindow.on('restore', () => setTimeout(resetZoom, 50));
  mainWindow.on('maximize', () => setTimeout(resetZoom, 50));
  mainWindow.on('unmaximize', () => setTimeout(resetZoom, 50));

  // Block Ctrl +/-/0 dan Ctrl+Scroll zoom
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!input.control) return;
    if (['+', '-', '=', '0'].includes(input.key)) event.preventDefault();
    if (input.type === 'mouseWheel') event.preventDefault();
  });

  // =========================================
  // Handle ALL external links → small Electron window
  // =========================================
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file://')) {
      return { action: 'allow' };
    }

    // External URL → small Electron window
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 700,
        height: 500,
        minWidth: 500,
        minHeight: 400,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      }
    };
  });

  // Prevent external navigation in main window
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      mainWindow.webContents.send('force-external-open', url);
    }
  });
}

// =========================================
// Notification popup window
// =========================================
function createNotificationWindow(data) {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.close();
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const popupWidth = 420;
  const popupHeight = 260;
  const margin = 20;

  notificationWindow = new BrowserWindow({
    width: popupWidth,
    height: popupHeight,
    x: screenWidth - popupWidth - margin,
    y: screenHeight - popupHeight - margin,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  notificationWindow.loadFile('notification.html');

  notificationWindow.once('ready-to-show', () => {
    notificationWindow.show();
    notificationWindow.webContents.send('reminder-data', data);
  });

  const timeout = setTimeout(() => {
    if (notificationWindow && !notificationWindow.isDestroyed()) {
      notificationWindow.close();
    }
  }, 60000);

  notificationWindow.on('closed', () => {
    clearTimeout(timeout);
    notificationWindow = null;
  });
}

// =========================================
// IPC HANDLERS
// =========================================
ipcMain.on('trigger-notification', (event, data) => {
  console.log('[MAIN] Trigger notification:', data.title);
  createNotificationWindow(data);
});

ipcMain.on('dismiss-notification', () => {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.close();
  }
});

ipcMain.on('view-reminder', () => {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.close();
  }
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('open-view', 'reminders');
  }
});

// Open URL from renderer in small Electron window
ipcMain.on('open-external', (event, url) => {
  if (!url) return;
  const extWin = new BrowserWindow({
    width: 700,
    height: 500,
    minWidth: 500,
    minHeight: 400,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  extWin.loadURL(url);
});

// =========================================
// APP LIFECYCLE
// =========================================
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});