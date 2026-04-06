import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { join } from 'path'
import { registerAllIPC } from './ipc'

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Agent IDE',
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.agent-ide')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerAllIPC()
  const mainWindow = createWindow()
  let forceClose = false
  let closeRequested = false
  let forceCloseTimer: NodeJS.Timeout | null = null

  // 用 Electron 原生 dialog 替代 window.confirm()。
  // window.confirm() 会使 BrowserWindow 失去 OS 键盘焦点，且渲染进程无法自行恢复。
  // dialog.showMessageBox() 由主进程管理，对话框关闭后 Electron 会正确归还键盘焦点。
  ipcMain.handle('dialog:confirm', async (_event, message: string) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Cancel', 'Delete'],
      defaultId: 1,
      cancelId: 0,
      message,
    })
    mainWindow.focus()
    mainWindow.webContents.focus()
    return response === 1
  })

  ipcMain.handle('dialog:unsavedChanges', async (_event, fileName: string) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: `Do you want to save the changes you made to ${fileName}?`,
      detail: "Your changes will be lost if you don't save them.",
    })

    mainWindow.focus()
    mainWindow.webContents.focus()

    if (response === 0) return 'save'
    if (response === 1) return 'dont_save'
    return 'cancel'
  })

  mainWindow.on('close', (event) => {
    if (forceClose) return

    event.preventDefault()
    if (closeRequested) return

    closeRequested = true
    mainWindow.webContents.send('app:requestClose')

    forceCloseTimer = setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        forceClose = true
        mainWindow.close()
      }
    }, 5000)
  })

  ipcMain.handle('app:confirmClose', async () => {
    if (forceCloseTimer) {
      clearTimeout(forceCloseTimer)
      forceCloseTimer = null
    }
    closeRequested = false

    if (!mainWindow.isDestroyed()) {
      forceClose = true
      mainWindow.close()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
