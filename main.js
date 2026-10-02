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
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      zoomFactor: 1.0
    }
  });

  mainWindow.loadFile('index.html');

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

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});