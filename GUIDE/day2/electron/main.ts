import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

function createWindow(): void {
  // 创建主窗口：Day 1 只负责搭建可运行骨架，不注入业务逻辑。
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      // preload 负责桥接安全 API（渲染进程不能直接拿到 Node 高权限能力）。
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // 等待页面资源准备好再显示窗口，避免用户看到白屏闪烁。
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 阻止新窗口在应用内打开，统一交给系统浏览器处理外链。
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发环境走 Vite dev server，生产环境加载打包后的 html。
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  
  // Day 1 默认打开开发者工具，便于教学阶段观察运行状态。
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }
}

app.whenReady().then(() => {
  // Windows 平台任务栏与通知等系统行为依赖该 AppUserModelId。
  electronApp.setAppUserModelId('com.electron')

  // 注册开发期快捷键行为（例如 F12 / Ctrl+R）以贴合本地调试习惯。
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Day 2: 提供最小可用终端命令执行能力，供渲染进程通过 IPC 调用。
  ipcMain.handle('terminal:run-command', async (_event, command: string) => {
    if (!command || !command.trim()) {
      return { stdout: '', stderr: '命令为空。', code: 1 }
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        windowsHide: true,
        maxBuffer: 1024 * 1024
      })

      return { stdout, stderr, code: 0 }
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; message?: string; code?: number }

      return {
        stdout: execError.stdout ?? '',
        stderr: execError.stderr ?? execError.message ?? '命令执行失败。',
        code: execError.code ?? 1
      }
    }
  })

  createWindow()

  app.on('activate', function () {
    // macOS 上关闭所有窗口后，点击 Dock 图标通常会重新创建窗口。
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 遵循 macOS 约定：仅非 darwin 平台在关窗后直接退出进程。
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
