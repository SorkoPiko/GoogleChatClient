const { contextBridge, ipcRenderer } = require('electron');

// Listen for message events from the page
window.addEventListener('message', (event) => {
  // Only accept messages from the same frame
  if (event.source !== window) return;
  
  // We only accept message events with specific properties
  if (event.data.type && event.data.type === 'NEW_MESSAGE') {
    // Extract notification info from the title
    const title = event.data.title;
    let body = 'You have a new message';
    
    // Try to extract sender name or other details
    const match = title.match(/\((\d+)\) (.+)/);
    if (match) {
      body = `You have ${match[1]} new messages from ${match[2]}`;
    }
    
    // Send to main process
    ipcRenderer.send('notification', { title: 'Google Chat', body });
  }
});

// Expose safe API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any API functions you want to expose here
});