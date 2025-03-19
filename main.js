const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, shell } = require('electron');
const path = require('path');
const { configureStartup } = require('./startup');

app.setName('Google Chat');

// Keep a global reference to prevent garbage collection
let mainWindow;
let tray;
let forceQuit = false;

// Configure app to start at system boot
app.whenReady().then(() => {
  // Enable auto-start at system boot
  configureStartup(true);

  // Request notification permissions immediately
  if (Notification.isSupported()) {
    Notification.requestPermission().then(permission => {
      console.log('Notification permission:', permission);
    }).catch(err => {
      console.error('Error requesting notification permission:', err);
    });
  }
});

function createWindow() {
  // Hide from dock initially if on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Create window hidden initially
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icons/icon.png')
  });

  // Load Google Chat
  mainWindow.loadURL('https://chat.google.com');

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open all links in default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

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
      // Request notification permission immediately
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission);
        }).catch(err => {
          console.error('Error requesting notification permission:', err);
        });
      }

      // Insert our custom styles
      const style = document.createElement('style');
      style.textContent = \`
        .notification-prompt {
          position: fixed;
          top: 16px;
          right: 16px;
          background: white;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 300px;
          border: 1px solid #e0e0e0;
        }
        .notification-prompt.hidden {
          display: none;
        }
        .notification-prompt button {
          background: #1a73e8;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .notification-prompt button:hover {
          background: #1557b0;
        }
      \`;
      document.head.appendChild(style);

      // Create and add notification prompt
      const prompt = document.createElement('div');
      prompt.className = 'notification-prompt';
      prompt.innerHTML = \`
        <div>
          <strong>Enable notifications?</strong>
          <p>Get notified when you receive new messages in Google Chat.</p>
        </div>
        <button id="enableNotifications">Enable Notifications</button>
      \`;
      document.body.appendChild(prompt);

      // Handle notification permission
      document.getElementById('enableNotifications').addEventListener('click', async () => {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            prompt.classList.add('hidden');
          } else {
            prompt.innerHTML = \`
              <div>
                <strong>Notifications blocked</strong>
                <p>Please enable notifications in your system preferences to receive message alerts.</p>
              </div>
            \`;
          }
        } catch (error) {
          console.error('Error requesting notification permission:', error);
        }
      });

      // Check if we already have permission
      if (Notification.permission === 'granted') {
        prompt.classList.add('hidden');
      } else if (Notification.permission === 'denied') {
        prompt.innerHTML = \`
          <div>
            <strong>Notifications blocked</strong>
            <p>Please enable notifications in your system preferences to receive message alerts.</p>
          </div>
        \`;
      }

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
  
  // Set the context menu for all platforms
  tray.setContextMenu(contextMenu);
  
  // Only add click handler for non-macOS platforms
  // This allows macOS to use the default behavior which shows context menu on click
  if (process.platform !== 'darwin') {
    // For Windows/Linux, toggle window on left-click
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
  // Check if notifications are supported and permitted
  if (!Notification.isSupported()) {
    console.log('Notifications not supported');
    return;
  }

  const notification = new Notification({
    title: title || 'Google Chat',
    body: body || 'You have a new message',
    icon: path.join(__dirname, 'icons/icon.png'),
    silent: false
  });
  
  notification.on('click', () => {
    if (process.platform === 'darwin') {
      app.dock.show();
    }
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
