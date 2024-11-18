const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');
const Registry = require('winreg');

function createWindow() {
  const win = new BrowserWindow({
    width: 750,
    height: 500,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'src/preload.js')
    },
    icon: path.join(__dirname, 'src/assets/logo.png'),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    resizable: false
  });

  win.loadFile('src/index.html');
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

ipcMain.handle('get-steam-path', async () => {
  return new Promise((resolve) => {
    const regKey = new Registry({
      hive: Registry.HKLM,
      key: '\\SOFTWARE\\WOW6432Node\\Valve\\Steam'
    });

    regKey.get('InstallPath', (err, item) => {
      if (err) {
        resolve({ success: false, error: 'Steam registry key not found' });
        return;
      }

      const steamPath = item.value;
      if (fs.existsSync(path.join(steamPath, 'steam.exe'))) {
        resolve({ success: true, path: steamPath });
      } else {
        resolve({ success: false, error: 'Steam installation not found at registry path' });
      }
    });
  });
});

ipcMain.on('start-installation', async (event, data) => {
  const appData = process.env.APPDATA;
  
  function sendLog(message) {
    console.log('Debug:', message);
    event.reply('installation-logs', [message]);
  }

  sendLog('Preparing installation...');
  await delay(1000);

  if (data.theme === 'DiscordTheme') {
    const betterDiscordPath = path.join(appData, 'BetterDiscord', 'themes');
    const vencordPath = path.join(appData, 'Vencord', 'themes');
    const vencordThemePath = path.join(vencordPath, 'SpaceTheme.theme.css');
    const betterDiscordThemePath = path.join(betterDiscordPath, 'SpaceTheme.theme.css');
    const themeUrl = 'https://raw.githubusercontent.com/SpaceTheme/Discord/refs/heads/main/SpaceTheme.theme.css';

    async function installTheme(themePath, clientName) {
      try {
        if (!fs.existsSync(themePath)) {
          fs.mkdirSync(themePath, { recursive: true });
          sendLog(`Created directory for ${clientName}`);
        }

        const themeFile = path.join(themePath, 'SpaceTheme.theme.css');
        const file = fs.createWriteStream(themeFile);

        return new Promise((resolve, reject) => {
          sendLog(`Downloading theme for ${clientName}...`);
          https.get(themeUrl, response => {
            response.pipe(file);
            file.on('finish', () => {
              sendLog(`SpaceTheme.theme.css downloaded successfully in ${themePath}`);
              file.close();
              sendLog(`SpaceTheme installed successfully for ${clientName}`);
              resolve();
            });
          }).on('error', error => {
            sendLog(`Error downloading theme for ${clientName}: ${error.message}`);
            reject(error);
          });
        });
      } catch (error) {
        sendLog(`Error installing theme for ${clientName}: ${error.message}`);
        throw error;
      }
    }

    try {
      if (data.option === 'uninstall-theme') {
        let uninstalled = false;
        if (fs.existsSync(vencordThemePath)) {
          fs.unlinkSync(vencordThemePath);
          sendLog('SpaceTheme uninstalled successfully from Vencord');
          uninstalled = true;
        }
        if (fs.existsSync(betterDiscordThemePath)) {
          fs.unlinkSync(betterDiscordThemePath);
          sendLog('SpaceTheme uninstalled successfully from BetterDiscord');
          uninstalled = true;
        }
        if (!uninstalled) {
          sendLog('Discord theme not found in any supported client');
        }
        return;
      }

      if (data.option === 'reset-theme') {
        sendLog('Starting theme reset process...');
        if (fs.existsSync(vencordThemePath)) {
          fs.unlinkSync(vencordThemePath);
          sendLog('Removed existing Vencord theme');
        }
        if (fs.existsSync(betterDiscordThemePath)) {
          fs.unlinkSync(betterDiscordThemePath);
          sendLog('Removed existing BetterDiscord theme');
        }
      }

      let installed = false;
      if (fs.existsSync(betterDiscordPath)) {
        await installTheme(betterDiscordPath, 'BetterDiscord');
        installed = true;
      }
      if (fs.existsSync(vencordPath)) {
        await installTheme(vencordPath, 'Vencord');
        installed = true;
      }
      if (!installed) {
        sendLog('Neither BetterDiscord nor Vencord is installed. Please install one of them first.');
      }
    } catch (error) {
      sendLog(`Installation failed: ${error.message}`);
    }

} else if (data.theme === 'SteamTheme') {
    await delay(1000);
    
    if (data.millenniumInstall) {
      sendLog('Starting Millennium installation...');
      const powershellCommand = `start powershell.exe -ExecutionPolicy Bypass -File "${path.join(__dirname, 'src/assets/millennium.ps1')}"`;
      
      try {
        await new Promise((resolve, reject) => {
          exec(powershellCommand, (error, stdout, stderr) => {
            if (error) {
              sendLog(`Millennium installation error: ${error.message}`);
              reject(error);
              return;
            }
            sendLog('Millennium installation completed successfully');
            resolve();
          });
        });
      } catch (error) {
        sendLog(`Failed to install Millennium: ${error.message}`);
        return;
      }
    }

    const skinsFolder = path.join(data.steamPath, 'steamui', 'skins');
    const destinationFolder = path.join(skinsFolder, 'SpaceTheme For Steam');
    const tempPath = path.join(process.env.TEMP, 'SpaceTheme_for_Steam.zip');
    const extractedFolderPath = path.join(skinsFolder, 'Steam-main');

    function cleanup() {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        if (fs.existsSync(extractedFolderPath)) {
          fs.rmSync(extractedFolderPath, { recursive: true, force: true });
        }
      } catch (error) {
        sendLog(`Cleanup error: ${error.message}`);
      }
    }

    try {
      if (data.option === 'uninstall-theme') {
        sendLog('Starting Steam theme uninstallation...');
        sendLog('Trying to see if you have SteamTheme installed...');
        if (fs.existsSync(destinationFolder)) {
          fs.rmSync(destinationFolder, { recursive: true, force: true });
          sendLog('SteamTheme path was found and deleted!');
          sendLog('SpaceTheme uninstalled successfully for Steam.');
        } else {
          sendLog('Steam theme not found');
        }
        return;
      }

      if (data.option === 'reset-theme') {
        sendLog('Starting Steam theme reset...');
        if (fs.existsSync(destinationFolder)) {
          fs.rmSync(destinationFolder, { recursive: true, force: true });
          sendLog('Removed existing Steam theme installation');
          sendLog('Starting installation...');
        } else {
          sendLog('No existing Steam theme found, proceeding with installation...');
        }
      }

      if (!fs.existsSync(skinsFolder)) {
        sendLog('Steam skins folder not found. Please install Millennium first.');
        return;
      }

      sendLog('Downloading SpaceTheme for Steam...');
      const file = fs.createWriteStream(tempPath);

      await new Promise((resolve, reject) => {
        sendLog('Checking website availability...');
        https.get('https://github.com/SpaceTheme/Steam/archive/refs/heads/main.zip', response => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            https.get(response.headers.location, redirectResponse => {
              if (redirectResponse.statusCode !== 200) {
                reject(new Error(`Download failed with status ${redirectResponse.statusCode}`));
                return;
              }
              redirectResponse.pipe(file);
              file.on('finish', () => {
                file.close();
                resolve();
              });
            }).on('error', reject);
          } else if (response.statusCode === 200) {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          } else {
            reject(new Error(`Unexpected status code: ${response.statusCode}`));
          }
        }).on('error', reject);
      });

      sendLog('Website is available for you!');
      sendLog(`SpaceTheme for Steam was successfully installed in ${tempPath} folder.`);
      sendLog('Extracting files... ');
      const zip = new AdmZip(tempPath);
      zip.extractAllTo(skinsFolder, true);
      sendLog(`SpaceTheme for Steam was successfully extracted to ${skinsFolder} folder.`);

      if (fs.existsSync(extractedFolderPath)) {
        fs.renameSync(extractedFolderPath, destinationFolder);
        sendLog('SpaceTheme installed successfully for Steam.');
      } else {
        throw new Error('Failed to extract theme files');
      }
    } catch (error) {
      sendLog(`Error during Steam theme operation: ${error.message}`);
    } finally {
      cleanup();
    }
  }
});

ipcMain.on('close-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});