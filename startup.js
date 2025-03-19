const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Enable or disable application startup with the OS
 * @param {boolean} enable - Whether to enable or disable startup
 * @param {string} customAppPath - Optional custom path to the application
 */
function configureStartup(enable = true, customAppPath = null) {
    const platform = os.platform();
    const appName = 'GoogleChatClient';
    
    // Determine the correct app path based on platform
    let appPath;
    if (customAppPath) {
        appPath = customAppPath;
    } else if (process.env.PORTABLE_EXECUTABLE_DIR) {
        // If running as packaged app
        appPath = process.execPath;
    } else {
        // Development environment
        appPath = process.argv[0];
    }
    
    try {
        if (platform === 'darwin') {
            const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${appName}.plist`);
            
            if (enable) {
                // macOS: Create a .plist file in ~/Library/LaunchAgents
                const plistContent = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${appName}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${appPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
                `;
                fs.writeFileSync(plistPath, plistContent);
                console.log(`Startup enabled for macOS. Plist created at: ${plistPath}`);
            } else {
                // Remove the plist file if it exists
                if (fs.existsSync(plistPath)) {
                    fs.unlinkSync(plistPath);
                    console.log(`Startup disabled for macOS. Plist removed from: ${plistPath}`);
                }
            }
        } else if (platform === 'win32') {
            // Windows: Add or remove registry entry
            const regKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`;
            
            if (enable) {
                const command = `REG ADD "${regKey}" /V "${appName}" /D "${appPath}" /F`;
                execSync(command);
                console.log(`Startup enabled for Windows. Registry entry added for: ${appName}`);
            } else {
                const command = `REG DELETE "${regKey}" /V "${appName}" /F`;
                try {
                    execSync(command);
                    console.log(`Startup disabled for Windows. Registry entry removed for: ${appName}`);
                } catch (e) {
                    // If the entry doesn't exist, that's fine
                    console.log(`No registry entry found for: ${appName}`);
                }
            }
        } else if (platform === 'linux') {
            // Linux: Create or remove a .desktop file in ~/.config/autostart
            const autostartDir = path.join(os.homedir(), '.config', 'autostart');
            const desktopPath = path.join(autostartDir, `${appName}.desktop`);
            
            if (enable) {
                // Create autostart directory if it doesn't exist
                if (!fs.existsSync(autostartDir)) {
                    fs.mkdirSync(autostartDir, { recursive: true });
                }
                
                const desktopContent = `
[Desktop Entry]
Type=Application
Exec=${appPath}
Hidden=false
NoDisplay=false
Name=${appName}
Comment=Google Chat Client
X-GNOME-Autostart-enabled=true
                `;
                fs.writeFileSync(desktopPath, desktopContent);
                console.log(`Startup enabled for Linux. Desktop entry created at: ${desktopPath}`);
            } else {
                // Remove the desktop file if it exists
                if (fs.existsSync(desktopPath)) {
                    fs.unlinkSync(desktopPath);
                    console.log(`Startup disabled for Linux. Desktop entry removed from: ${desktopPath}`);
                }
            }
        } else {
            console.log('Unsupported platform for startup configuration.');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error configuring startup:', error);
        return false;
    }
}

module.exports = { configureStartup };
