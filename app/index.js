import { app, Menu, BrowserWindow, dialog, ipcMain } from "electron";

app.whenReady().then(() => {
  const win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.maximize();
  Menu.setApplicationMenu(null);

  win.loadFile("./index.html");
});
