import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, Switch, TextField,
  Tooltip, Typography
} from '@mui/material';
import { Plus, Search } from 'lucide-react';
import { fetchFrameworkCatalog, FrameworkCatalogEntry, loadBuiltInFramework } from '../../api';
import { GrcControlSet, GrcSoaEntry } from '../../types/GrcTypes';

interface FrameworkPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (controlSet: GrcControlSet, soaEntries: GrcSoaEntry[]) => void;
  existingControlSetNames: string[];
  scopeType: string;
  scopeId: string;
}

const categoryLabels: Record<string, string> = {
  compliance: 'Compliance Standards',
  threat: 'Threat Frameworks',
  government: 'Government / National Standards'
};

const categoryOrder = ['compliance', 'threat', 'government'];

const FrameworkPickerDialog: React.FC<FrameworkPickerDialogProps> = ({
  open, onClose, onAdd, existingControlSetNames, scopeType, scopeId
}) => {
  const [catalog, setCatalog] = useState<FrameworkCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFramework, setLoadingFramework] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [selectedFamilies, setSelectedFamilies] = useState<Record<string, string[]>>({});
  const [baseControlsOnly, setBaseControlsOnly] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetchFrameworkCatalog()
      .then(setCatalog)
      .catch(err => setError(err.message || 'Failed to load catalog'))
      .finally(() => setLoading(false));
  }, [open]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? catalog.filter(e =>
          e.name.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.sourceOrg.toLowerCase().includes(q) ||
          e.frameworkKey.toLowerCase().includes(q))
      : catalog;
    const groups: Record<string, FrameworkCatalogEntry[]> = {};
    for (const entry of filtered) {
      const cat = entry.category || 'compliance';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(entry);
    }
    return groups;
  }, [catalog, search]);

  const isDuplicate = useCallback((entry: FrameworkCatalogEntry) => {
    const normalizedName = `${entry.name} ${entry.version}`.trim().toLowerCase();
    return existingControlSetNames.some(n => n.trim().toLowerCase() === normalizedName);
  }, [existingControlSetNames]);

  const handleAdd = useCallback(async (entry: FrameworkCatalogEntry) => {
    setLoadingFramework(entry.frameworkKey);
    setError(null);
    try {
      const result = await loadBuiltInFramework({
        frameworkKey: entry.frameworkKey,
        selectedFamilies: selectedFamilies[entry.frameworkKey],
        baseControlsOnly: baseControlsOnly[entry.frameworkKey] || false,
        scopeType,
        scopeId
      });
      if (result.controlSet) {
        onAdd(result.controlSet, result.soaEntries || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load framework');
    } finally {
      setLoadingFramework(null);
    }
  }, [onAdd, scopeType, scopeId, selectedFamilies, baseControlsOnly]);

  const toggleFamily = useCallback((frameworkKey: string, family: string) => {
    setSelectedFamilies(prev => {
      const current = prev[frameworkKey] || [];
      const next = current.includes(family)
        ? current.filter(f => f !== family)
        : [...current, family];
      return { ...prev, [frameworkKey]: next };
    });
  }, []);

  const getFamilies = useCallback((entry: FrameworkCatalogEntry): string[] => {
    const catalogEntry = (catalog as any[]).find(c => c.frameworkKey === entry.frameworkKey);
    if (!catalogEntry) return [];
    const known: Record<string, string[]> = {
      'nist-800-53': ['Access Control', 'Awareness and Training', 'Audit and Accountability', 'Assessment, Authorization, and Monitoring', 'Configuration Management', 'Contingency Planning', 'Identification and Authentication', 'Incident Response', 'Maintenance', 'Media Protection', 'Physical and Environmental Protection', 'Planning', 'Program Management', 'Personnel Security', 'PII Processing and Transparency', 'Risk Assessment', 'System and Services Acquisition', 'System and Communications Protection', 'System and Information Integrity', 'Supply Chain Risk Management'],
      'csa-ccm': ['Audit & Assurance', 'Application & Interface Security', 'Business Continuity Management & Operational Resilience', 'Change Control & Configuration Management', 'Cryptography, Encryption & Key Management', 'Datacenter Security', 'Data Security & Privacy Lifecycle Management', 'Governance, Risk & Compliance', 'Human Resources', 'Identity & Access Management', 'Interoperability & Portability', 'Infrastructure & Virtualization Security', 'Logging & Monitoring', 'Security Incident Management, E-Discovery & Cloud Forensics', 'Supply Chain Management, Transparency & Accountability', 'Threat & Vulnerability Management', 'Universal Endpoint Management'],
      'mitre-attack-enterprise': ['Reconnaissance', 'Resource Development', 'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Exfiltration', 'Impact'],
      'mitre-attack-ics': ['Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Evasion', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Inhibit Response Function', 'Impair Process Control', 'Impact'],
      'mitre-attack-mobile': ['Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Exfiltration', 'Impact'],
      'nist-csf-2': ['Govern', 'Identify', 'Protect', 'Detect', 'Respond', 'Recover']
    };
    return known[entry.frameworkKey] || [];
  }, [catalog]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Plus size={20} />
        Add Built-in Framework
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>
        )}

        {!loading && catalog.length > 0 && (
          <>
            <Box sx={{ mb: 2 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search frameworks..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                InputProps={{ startAdornment: <Search size={16} style={{ marginRight: 8, opacity: 0.5 }} /> }}
              />
            </Box>

            {categoryOrder.map(cat => {
              const entries = grouped[cat];
              if (!entries || entries.length === 0) return null;
              return (
                <Box key={cat} sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                    {categoryLabels[cat] || cat}
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 1.5 }}>
                    {entries.map(entry => {
                      const duplicate = isDuplicate(entry);
                      const isLoading = loadingFramework === entry.frameworkKey;
                      const isExpanded = expandedKey === entry.frameworkKey;
                      const families = getFamilies(entry);
                      const selected = selectedFamilies[entry.frameworkKey] || [];
                      const isBaseOnly = baseControlsOnly[entry.frameworkKey] || false;

                      return (
                        <Box
                          key={entry.frameworkKey}
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1.5,
                            p: 1.5,
                            opacity: !entry.dataFileAvailable ? 0.5 : 1
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  {entry.name}
                                </Typography>
                                <Chip size="small" label={`${entry.version} - ${entry.releaseDateLabel}`} sx={{ height: 20, fontSize: '0.65rem' }} />
                                <Chip size="small" label={entry.sourceOrg} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                <Chip
                                  size="small"
                                  label={entry.hasBaseControlsOnlyOption
                                    ? `${isBaseOnly ? entry.baseControlCount : entry.controlCount} controls`
                                    : `${entry.controlCount} controls`}
                                  color="primary"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {entry.description}
                              </Typography>
                              {!entry.dataFileAvailable && (
                                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                                  Data file required — place in server/data/security-knowledge-base/
                                </Typography>
                              )}
                              {duplicate && (
                                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                                  Already added to workspace (will replace existing)
                                </Typography>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end', flexShrink: 0 }}>
                              <Tooltip describeChild title={!entry.dataFileAvailable ? 'Data file not available' : `Add ${entry.name} to workspace`} arrow>
                                <span>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    disabled={!entry.dataFileAvailable || isLoading}
                                    onClick={() => handleAdd(entry)}
                                    startIcon={isLoading ? <CircularProgress size={14} /> : <Plus size={14} />}
                                    sx={{ minWidth: 70 }}
                                  >
                                    {isLoading ? 'Adding...' : 'Add'}
                                  </Button>
                                </span>
                              </Tooltip>
                              {entry.supportsSelectiveLoad && families.length > 0 && (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => setExpandedKey(isExpanded ? null : entry.frameworkKey)}
                                  sx={{ fontSize: '0.7rem', py: 0, minHeight: 24 }}
                                >
                                  {isExpanded ? 'Hide options' : 'Options...'}
                                </Button>
                              )}
                            </Box>
                          </Box>

                          {isExpanded && (
                            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                              {entry.hasBaseControlsOnlyOption && (
                                <FormControlLabel
                                  control={
                                    <Switch
                                      size="small"
                                      checked={isBaseOnly}
                                      onChange={(_, checked) => setBaseControlsOnly(prev => ({ ...prev, [entry.frameworkKey]: checked }))}
                                    />
                                  }
                                  label={
                                    <Typography variant="caption">
                                      Base controls only ({entry.baseControlCount} of {entry.controlCount})
                                    </Typography>
                                  }
                                  sx={{ mb: 1 }}
                                />
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                Select families/domains to include (leave all unchecked for full set):
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                                {families.map(fam => (
                                  <FormControlLabel
                                    key={fam}
                                    control={
                                      <Checkbox
                                        size="small"
                                        checked={selected.includes(fam)}
                                        onChange={() => toggleFamily(entry.frameworkKey, fam)}
                                      />
                                    }
                                    label={<Typography variant="caption">{fam}</Typography>}
                                    sx={{ mr: 1, '& .MuiFormControlLabel-label': { fontSize: '0.75rem' } }}
                                  />
                                ))}
                              </Box>
                              {selected.length > 0 && (
                                <Typography variant="caption" color="primary" sx={{ mt: 0.5, display: 'block' }}>
                                  {selected.length} of {families.length} families selected
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </>
        )}

        {!loading && catalog.length === 0 && !error && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No frameworks available. Ensure the backend server is running.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FrameworkPickerDialog;
