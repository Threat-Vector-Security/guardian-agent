import { getDFDCategoryForNodeType, getSuggestedDFDTypes, nodeToDFDCategory } from '../dfdCategoryMappings';
import { SecurityNodeType } from '../../types/SecurityTypes';

describe('DFD Category Mappings', () => {
  describe('getDFDCategoryForNodeType', () => {
    it('should return correct categories for common node types', () => {
      expect(getDFDCategoryForNodeType('user')).toBe('actor');
      expect(getDFDCategoryForNodeType('smartphone')).toBe('actor');
      expect(getDFDCategoryForNodeType('application')).toBe('process');
      expect(getDFDCategoryForNodeType('database')).toBe('dataStore');
      expect(getDFDCategoryForNodeType('securityZone')).toBe('trustBoundary');
    });

    it('should return null for DFD nodes themselves', () => {
      expect(getDFDCategoryForNodeType('dfdActor')).toBe(null);
      expect(getDFDCategoryForNodeType('dfdProcess')).toBe(null);
      expect(getDFDCategoryForNodeType('dfdDataStore')).toBe(null);
      expect(getDFDCategoryForNodeType('dfdTrustBoundary')).toBe(null);
    });

    it('should return null for physical infrastructure', () => {
      expect(getDFDCategoryForNodeType('ups')).toBe(null);
      expect(getDFDCategoryForNodeType('pdu')).toBe(null);
      expect(getDFDCategoryForNodeType('hvac')).toBe(null);
    });

    it('should categorize security nodes correctly', () => {
      expect(getDFDCategoryForNodeType('firewall')).toBe('process');
      expect(getDFDCategoryForNodeType('ids')).toBe('process');
      expect(getDFDCategoryForNodeType('ldap')).toBe('dataStore');
      expect(getDFDCategoryForNodeType('kms')).toBe('dataStore');
    });

    it('should categorize cloud nodes correctly', () => {
      expect(getDFDCategoryForNodeType('cloudService')).toBe('process');
      expect(getDFDCategoryForNodeType('storageAccount')).toBe('dataStore');
      expect(getDFDCategoryForNodeType('containerRegistry')).toBe('dataStore');
    });
  });

  describe('getSuggestedDFDTypes', () => {
    it('should return specific suggestions for known node types', () => {
      const userSuggestions = getSuggestedDFDTypes('user');
      expect(userSuggestions).toContain('End User');
      expect(userSuggestions).toContain('Administrator');

      const databaseSuggestions = getSuggestedDFDTypes('database');
      expect(databaseSuggestions).toContain('User Database');
      expect(databaseSuggestions).toContain('Transaction Store');
    });

    it('should return generic suggestions based on category', () => {
      const suggestions = getSuggestedDFDTypes('generic' as SecurityNodeType, 'process');
      expect(suggestions).toContain('Service');
      expect(suggestions).toContain('Application');
    });

    it('should return empty array for no category', () => {
      const suggestions = getSuggestedDFDTypes('generic' as SecurityNodeType);
      expect(suggestions).toEqual([]);
    });

    it('should use node type category if category not provided', () => {
      const suggestions = getSuggestedDFDTypes('user');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('End User');
    });
  });

  describe('nodeToDFDCategory mapping', () => {
    it('should have mappings for all major node categories', () => {
      // Infrastructure nodes
      expect(nodeToDFDCategory['server']).toBe('process');
      expect(nodeToDFDCategory['router']).toBe('process');
      
      // Application nodes
      expect(nodeToDFDCategory['application']).toBe('process');
      expect(nodeToDFDCategory['database']).toBe('dataStore');
      
      // Security nodes
      expect(nodeToDFDCategory['firewall']).toBe('process');
      expect(nodeToDFDCategory['vault']).toBe('dataStore');
      
      // AI/ML nodes
      expect(nodeToDFDCategory['aiModel']).toBe('process');
      expect(nodeToDFDCategory['dataLake']).toBe('dataStore');
    });

    it('should properly categorize external threat actors', () => {
      expect(nodeToDFDCategory['c2Server']).toBe('actor');
      expect(nodeToDFDCategory['phishingServer']).toBe('actor');
    });

    it('should properly categorize user interfaces as actors', () => {
      expect(nodeToDFDCategory['hmi']).toBe('actor');
      expect(nodeToDFDCategory['notebookServer']).toBe('actor');
      expect(nodeToDFDCategory['socWorkstation']).toBe('actor');
    });
  });
});