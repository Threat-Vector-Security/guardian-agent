/**
 * Storage Abstraction Interface
 * 
 * This interface abstracts storage operations to support both:
 * 1. Browser app - using localStorage
 * 2. Future SaaS version - using backend API
 * 
 * This allows the licensing system to work seamlessly across platforms
 * without changing the business logic.
 */

export interface StorageProvider {
  /**
   * Get an item from storage
   * @param key The storage key
   * @returns The stored value or null if not found
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Set an item in storage
   * @param key The storage key
   * @param value The value to store
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Remove an item from storage
   * @param key The storage key
   */
  removeItem(key: string): Promise<void>;

  /**
   * Clear all items from storage (optional)
   */
  clear?(): Promise<void>;

  /**
   * Get all keys in storage (optional)
   */
  keys?(): Promise<string[]>;
}

/**
 * LocalStorage implementation for browser app
 */
export class LocalStorageProvider implements StorageProvider {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('LocalStorage getItem error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('LocalStorage setItem error:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('LocalStorage removeItem error:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('LocalStorage clear error:', error);
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.error('LocalStorage keys error:', error);
      return [];
    }
  }
}

/**
 * API Storage implementation for future SaaS version
 * This would communicate with a backend API to store user-specific data
 */
export class ApiStorageProvider implements StorageProvider {
  private apiUrl: string;
  private authToken?: string;

  constructor(apiUrl: string, authToken?: string) {
    this.apiUrl = apiUrl;
    this.authToken = authToken;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Storage API error: ${response.status}`);
      }

      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error('ApiStorage getItem error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value })
      });

      if (!response.ok) {
        throw new Error(`Storage API error: ${response.status}`);
      }
    } catch (error) {
      console.error('ApiStorage setItem error:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Storage API error: ${response.status}`);
      }
    } catch (error) {
      console.error('ApiStorage removeItem error:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/clear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Storage API error: ${response.status}`);
      }
    } catch (error) {
      console.error('ApiStorage clear error:', error);
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/keys`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Storage API error: ${response.status}`);
      }

      const data = await response.json();
      return data.keys || [];
    } catch (error) {
      console.error('ApiStorage keys error:', error);
      return [];
    }
  }
}

/**
 * Storage factory to create the appropriate storage provider
 */
export class StorageFactory {
  private static instance: StorageProvider | null = null;

  /**
   * Get the storage provider instance
   * @param forceProvider Optional: force a specific provider type
   */
  static getProvider(forceProvider?: 'local' | 'api'): StorageProvider {
    if (!this.instance || forceProvider) {
      // Determine which provider to use
      const isSaaSEnvironment = this.detectSaaSEnvironment();
      
      if (forceProvider === 'api' || (isSaaSEnvironment && !forceProvider)) {
        // For SaaS, we'd need to get the API URL and auth token from somewhere
        const apiUrl = process.env.REACT_APP_STORAGE_API_URL || '';
        const authToken = this.getAuthToken();
        this.instance = new ApiStorageProvider(apiUrl, authToken);
      } else {
        // Default to localStorage for browser app
        this.instance = new LocalStorageProvider();
      }
    }

    return this.instance;
  }

  /**
   * Detect if we're running in a SaaS environment
   */
  private static detectSaaSEnvironment(): boolean {
    // Check for SaaS-specific environment variable
    if (process.env.REACT_APP_SAAS_MODE === 'true') {
      return true;
    }

    // Default to browser mode
    return false;
  }

  /**
   * Get auth token for API storage (would be implemented based on auth system)
   */
  private static getAuthToken(): string | undefined {
    // This would integrate with your auth system
    // For now, return undefined
    return undefined;
  }

  /**
   * Set a custom storage provider (useful for testing)
   */
  static setProvider(provider: StorageProvider): void {
    this.instance = provider;
  }
}

/**
 * Helper class to migrate data between storage providers
 */
export class StorageMigration {
  /**
   * Migrate data from one storage provider to another
   * @param from Source storage provider
   * @param to Destination storage provider
   * @param keyPrefix Optional: only migrate keys with this prefix
   */
  static async migrate(
    from: StorageProvider, 
    to: StorageProvider, 
    keyPrefix?: string
  ): Promise<void> {
    try {
      // Get all keys from source
      const allKeys = await from.keys?.() || [];
      
      // Filter keys if prefix specified
      const keysToMigrate = keyPrefix 
        ? allKeys.filter(key => key.startsWith(keyPrefix))
        : allKeys;

      console.log(`[StorageMigration] Migrating ${keysToMigrate.length} keys...`);

      // Migrate each key
      for (const key of keysToMigrate) {
        const value = await from.getItem(key);
        if (value !== null) {
          await to.setItem(key, value);
          console.log(`[StorageMigration] Migrated: ${key}`);
        }
      }

      console.log('[StorageMigration] Migration completed successfully');
    } catch (error) {
      console.error('[StorageMigration] Migration failed:', error);
      throw error;
    }
  }
}