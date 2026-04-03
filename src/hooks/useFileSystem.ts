import { useCallback } from 'react'
import type { FileEntry, FileStats } from '@/types/electron'

export function useFileSystem() {
  const readFile = useCallback(async (filePath: string): Promise<string> => {
    try {
      return await window.api.readFile(filePath)
    } catch (error) {
      console.error('Failed to read file:', error)
      throw error
    }
  }, [])

  const writeFile = useCallback(async (filePath: string, content: string): Promise<void> => {
    try {
      await window.api.writeFile(filePath, content)
    } catch (error) {
      console.error('Failed to write file:', error)
      throw error
    }
  }, [])

  const deleteFile = useCallback(async (filePath: string): Promise<void> => {
    try {
      await window.api.deleteFile(filePath)
    } catch (error) {
      console.error('Failed to delete file:', error)
      throw error
    }
  }, [])

  const renameFile = useCallback(async (oldPath: string, newPath: string): Promise<void> => {
    try {
      await window.api.renameFile(oldPath, newPath)
    } catch (error) {
      console.error('Failed to rename file:', error)
      throw error
    }
  }, [])

  const readDirectory = useCallback(async (dirPath: string): Promise<FileEntry[]> => {
    try {
      return await window.api.readDirectory(dirPath)
    } catch (error) {
      console.error('Failed to read directory:', error)
      throw error
    }
  }, [])

  const createDirectory = useCallback(async (dirPath: string): Promise<void> => {
    try {
      await window.api.createDirectory(dirPath)
    } catch (error) {
      console.error('Failed to create directory:', error)
      throw error
    }
  }, [])

  const getFileStats = useCallback(async (filePath: string): Promise<FileStats> => {
    try {
      return await window.api.getFileStats(filePath)
    } catch (error) {
      console.error('Failed to get file stats:', error)
      throw error
    }
  }, [])

  const selectDirectory = useCallback(async (): Promise<string | null> => {
    try {
      return await window.api.selectDirectory()
    } catch (error) {
      console.error('Failed to select directory:', error)
      throw error
    }
  }, [])

  return {
    readFile,
    writeFile,
    deleteFile,
    renameFile,
    readDirectory,
    createDirectory,
    getFileStats,
    selectDirectory,
  }
}
