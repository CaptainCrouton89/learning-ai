import { CourseManager } from '../services/courseManager.js';
import { MongoCourseManager } from '../services/mongoCourseManager.js';

export type StorageType = 'file' | 'mongodb';

export const STORAGE_TYPE: StorageType = 'mongodb'; // Change this to switch storage types

export async function getCourseManager(): Promise<CourseManager | MongoCourseManager> {
  if (STORAGE_TYPE === 'mongodb') {
    const manager = new MongoCourseManager();
    await manager.initialize();
    return manager;
  } else {
    return new CourseManager();
  }
}