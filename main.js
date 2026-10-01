const { app, BrowserWindow } = require('electron');
const path = require('path');

// electron-reload dimatikan sementara (boleh buat network hang)
// require('electron-reload')(__dirname, {
//     electron: require(`${__dirname}/node_modules/electron`)
// });

function createWindow() {
  const win = new BrowserWindow({
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

  win.loadFile('index.html');

  // Show only when ready (avoid flicker)
  win.once('ready-to-show', () => {
    win.webContents.setZoomLevel(0);
    win.webContents.setZoomFactor(1);
    win.show();
  });

  // Force reset zoom on resize / restore / maximize
  const resetZoom = () => {
    try {
      win.webContents.setZoomLevel(0);
      win.webContents.setZoomFactor(1);
    } catch (_) {}
    win.webContents.send('window-resized');
  };

  win.on('resize', () => resetZoom());
  win.on('restore', () => setTimeout(resetZoom, 50));
  win.on('maximize', () => setTimeout(resetZoom, 50));
  win.on('unmaximize', () => setTimeout(resetZoom, 50));

  // Block Ctrl + / - / 0 and Ctrl+Scroll zoom
  win.webContents.on('before-input-event', (event, input) => {
    if (!input.control) return;
    if (['+', '-', '=', '0'].includes(input.key)) {
      event.preventDefault();
    }
    if (input.type === 'mouseWheel') {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});