const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function enableStartup(appName, appPath) {
    const platform = os.platform();

    if (platform === 'darwin') {
        // macOS: Create a .plist file in ~/Library/LaunchAgents
        const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${appName}.plist`);
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
    } else if (platform === 'win32') {
        // Windows: Add a registry entry
        const regKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`;
        const command = `REG ADD "${regKey}" /V "${appName}" /D "${appPath}" /F`;
        execSync(command);
        console.log(`Startup enabled for Windows. Registry entry added for: ${appName}`);
    } else {
        console.error('Unsupported platform for startup configuration.');
    }
}

// Example usage
const appName = 'MyApp';
const appPath = path.resolve(__dirname, 'my-app.exe'); // Replace with your app's executable path
enableStartup(appName, appPath);
