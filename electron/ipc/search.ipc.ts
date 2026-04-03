import { ipcMain, IpcMainInvokeEvent } from 'electron'
import SearchService, { SearchOptions } from '../services/search.service'

const searchService = new SearchService()

export function registerSearchIPC(): void {
  ipcMain.handle(
    'search:files',
    (_event: IpcMainInvokeEvent, rootPath: string, query: string, options?: SearchOptions) => {
      return searchService.searchFiles(rootPath, query, options)
    },
  )

  ipcMain.handle(
    'search:fileNames',
    (_event: IpcMainInvokeEvent, rootPath: string, pattern: string) => {
      return searchService.searchFileNames(rootPath, pattern)
    },
  )
}
