const { app, BrowserWindow, Tray, Menu, Notification, ipcMain } = require('electron');
const path = require('path');

app.setName('Google Chat');

// Keep a global reference to prevent garbage collection
let mainWindow;
let tray;
let forceQuit = false;

function createWindow() {
  // Hide from dock initially if on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

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

  // Handle window close events - just hide the window, don't close the app
  mainWindow.on('close', (event) => {
    if (!forceQuit) {
      event.preventDefault();
      mainWindow.hide();
      
      // Hide from dock when window is closed
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
      return false;
    }
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
    ? path.join(__dirname, 'icons/trayTemplate.png') 
    : path.join(__dirname, 'icons/tray.png');
    
  tray = new Tray(trayIconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show Google Chat', 
      click: () => { 
        if (process.platform === 'darwin') {
          app.dock.show();
        }
        mainWindow.show(); 
      } 
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => { 
        forceQuit = true;
        app.quit(); 
      } 
    }
  ]);
  
  tray.setToolTip('Google Chat');
  
  // Always set the context menu - macOS will show it on right-click
  tray.setContextMenu(contextMenu);
  
  // For macOS specifically, override the left-click behavior
  if (process.platform === 'darwin') {
    // This prevents the default behavior (showing context menu on left click)
    tray.on('click', (event, bounds) => {
      // Toggle window visibility on left-click
      if (mainWindow.isVisible()) {
        mainWindow.hide();
        app.dock.hide();
      } else {
        app.dock.show();
        mainWindow.show();
      }
    });
  } else {
    // For Windows/Linux, just use the default click handler
    tray.on('click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    });
  }
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
  
  // Simpler macOS menu
  if (process.platform === 'darwin') {
    const appMenu = Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: 'Command+Q',
            click: () => {
              // Just hide instead of quitting
              mainWindow.hide();
              if (process.platform === 'darwin') {
                app.dock.hide();
              }
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
  
  // Handle activation (clicking on dock icon)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
      if (process.platform === 'darwin') {
        app.dock.show();
      }
    }
  });
});

// Prevent app from closing on all windows closed
app.on('window-all-closed', (event) => {
  if (process.platform !== 'darwin') {
    app.quit();
  } else {
    mainWindow.hide();
    app.dock.hide();
  }
});

// Override the before-quit event to just hide unless force quit is triggered
app.on('before-quit', (event) => {
  if (!forceQuit) {
    event.preventDefault();
    mainWindow.hide();
    if (process.platform === 'darwin') {
      app.dock.hide();
    }
  }
});

// Listen for new message events from the preload script
ipcMain.on('notification', (event, arg) => {
  showNotification(arg.title, arg.body);
});