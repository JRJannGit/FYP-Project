const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const APP_ICON = path.join(__dirname, 'assets', 'icon.ico');

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
    icon: APP_ICON,
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

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!input.control) return;
    if (['+', '-', '=', '0'].includes(input.key)) event.preventDefault();
    if (input.type === 'mouseWheel') event.preventDefault();
  });

  // [R3] Every popup (file:// and remote) must get hardened defaults.
  // file:// popups used to inherit the main window's privileged
  // webPreferences (nodeIntegration: true, contextIsolation: false).
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'allow', overrideBrowserWindowOptions: createExternalWindowOptions() };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      mainWindow.webContents.send('force-external-open', url);
    }
  });
}

// [R3] Hardened defaults for every popup window. Node is never enabled in
// renderer processes here; sandboxed + context isolated.
function createExternalWindowOptions() {
  return {
    width: 700,
    height: 500,
    minWidth: 500,
    minHeight: 400,
    autoHideMenuBar: true,
    icon: APP_ICON,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  };
}

function createNotificationWindow(data) {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.close();
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const popupWidth = 420;
  const popupHeight = 260;
  const margin = 20;

  // [R1] Keep a local reference to the NEW window. The async 'closed' handler
  // of the OLD window used to fire after the shared field was re-pointed at
  // the new window and nulled it, leaving notificationWindow === null, so
  // the Dismiss/Close buttons and the 60s auto-close silently did nothing.
  const win = new BrowserWindow({
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
    icon: APP_ICON,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  notificationWindow = win;

  win.loadFile('notification.html');

  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send('reminder-data', data);
  });

  const timeout = setTimeout(() => {
    if (win && !win.isDestroyed()) {
      win.close();
    }
  }, 60000);

  win.on('closed', () => {
    clearTimeout(timeout);
    if (notificationWindow === win) notificationWindow = null;
  });
}

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

ipcMain.on('open-external', (event, url) => {
  if (!url) return;
  const extWin = new BrowserWindow(createExternalWindowOptions());
  extWin.loadURL(url);
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});