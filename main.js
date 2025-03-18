const { app, BrowserWindow, Tray, Menu, Notification, ipcMain } = require('electron');
const path = require('path');

app.setName('Google Chat');

// Keep a global reference to prevent garbage collection
let mainWindow;
let tray;
let isQuitting = false;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icons/icon.png')
  });

  // Load Google Chat
  mainWindow.loadURL('https://chat.google.com');

  // Handle window close events
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });

  // Create notification when messages arrive
  mainWindow.webContents.on('did-finish-load', () => {
    // Inject notification observer script
    mainWindow.webContents.executeJavaScript(`
      const originalTitle = document.title;
      
      // Watch for title changes that might indicate new messages
      const titleObserver = new MutationObserver(() => {
        if (document.title !== originalTitle && document.title.includes('(')) {
          window.postMessage({ type: 'NEW_MESSAGE', title: document.title }, '*');
        }
      });
      
      titleObserver.observe(document.querySelector('title'), { subtree: true, characterData: true, childList: true });
    `);
  });

  // Create tray icon
  createTray();
}

function createTray() {
  // Use template image for better macOS menu bar appearance
  const trayIconPath = process.platform === 'darwin' 
    ? path.join(__dirname, 'icons/trayTemplate.png') // Use a template image for macOS
    : path.join(__dirname, 'icons/tray.png');
    
  tray = new Tray(trayIconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Google Chat', click: () => { mainWindow.show(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]);
  
  tray.setToolTip('Google Chat');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

function showNotification(title, body) {
  const notification = new Notification({
    title: title || 'Google Chat',
    body: body || 'You have a new message',
    icon: path.join(__dirname, 'icons/icon.png')
  });
  
  notification.on('click', () => {
    mainWindow.show();
  });
  
  notification.show();
}

app.whenReady().then(() => {
  createWindow();
  
  // Handle macOS specific behavior
  if (process.platform === 'darwin') {
    // Create app menu to ensure copy/paste and other standard features work
    const appMenu = Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { 
            label: 'Hide',
            accelerator: 'Command+H',
            click: () => { mainWindow.hide(); }
          },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { 
            label: 'Quit',
            accelerator: 'Command+Q',
            click: () => { 
              isQuitting = true;
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      }
    ]);
    
    Menu.setApplicationMenu(appMenu);
  }
  
  // Properly handle the before-quit event
  app.on('before-quit', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
});

// Listen for new message events from the preload script
ipcMain.on('notification', (event, arg) => {
  showNotification(arg.title, arg.body);
});