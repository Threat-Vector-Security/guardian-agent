/**
 * Service for managing session-specific storage
 * Uses sessionStorage instead of localStorage for data that should only persist during the session
 */
export class SessionStorageService {
  private static readonly UPGRADE_PROMPT_KEY = 'contextcypher_upgrade_prompt_shown';
  
  /**
   * Check if the upgrade prompt has been shown in this session
   */
  static hasShownUpgradePrompt(): boolean {
    try {
      const hasShown = sessionStorage.getItem(this.UPGRADE_PROMPT_KEY) === 'true';
      console.log('[SessionStorageService] Checking if upgrade prompt shown:', hasShown);
      return hasShown;
    } catch (error) {
      console.error('[SessionStorageService] Error checking upgrade prompt status:', error);
      return false;
    }
  }
  
  /**
   * Mark that the upgrade prompt has been shown in this session
   */
  static markUpgradePromptShown(): void {
    try {
      sessionStorage.setItem(this.UPGRADE_PROMPT_KEY, 'true');
    } catch (error) {
      console.error('[SessionStorageService] Error marking upgrade prompt as shown:', error);
    }
  }
  
  /**
   * Clear the upgrade prompt shown flag (for testing purposes)
   */
  static clearUpgradePromptFlag(): void {
    try {
      console.log('[SessionStorageService] Clearing upgrade prompt flag');
      sessionStorage.removeItem(this.UPGRADE_PROMPT_KEY);
    } catch (error) {
      console.error('[SessionStorageService] Error clearing upgrade prompt flag:', error);
    }
  }
  
  /**
   * Clear all session storage data for this app
   */
  static clearAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('contextcypher_')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.error('[SessionStorageService] Error clearing session storage:', error);
    }
  }
}

export default SessionStorageService;