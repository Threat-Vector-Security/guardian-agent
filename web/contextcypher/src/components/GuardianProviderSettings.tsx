import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { discoverAIModels, guardianOperation, type GuardianAIModel } from '../services/guardianApi';
import { updateAIProvider } from '../services/settingsApi';
import { AIProvider } from '../types/SettingsTypes';

type Provider = { name: string; displayName: string; requiresCredential: boolean };
type Configuration = { provider: string; model: string; hasCredential: boolean; ready: boolean; temperature?: number; maxTokens?: number };
export interface GuardianProviderSettingsHandle {
  saveIfDirty(): Promise<boolean>;
  isDirty(): boolean;
  discard(): void;
}
const GuardianProviderSettings = forwardRef<GuardianProviderSettingsHandle>(function GuardianProviderSettings(_props, ref) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(16000);
  const [models, setModels] = useState<GuardianAIModel[]>([]);
  const [discovered, setDiscovered] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const discovery = useRef<{ sequence: number; controller?: AbortController }>({ sequence: 0 });
  const mounted = useRef(true);
  const actionInProgress = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void guardianOperation('ai.providers.list', {}, controller.signal).then(result => {
      if (!mounted.current) return;
      setProviders(result.providers);
      setConfiguration(result.configuration);
      if (result.configuration) {
        setProvider(result.configuration.provider); setModel(result.configuration.model);
        setTemperature(result.configuration.temperature ?? 0.2); setMaxTokens(result.configuration.maxTokens ?? 16000);
      } else if (result.providers.length) setProvider(result.providers[0].name);
    }).catch(cause => { if (!controller.signal.aborted && mounted.current) setError(cause.message); });
    return () => { mounted.current = false; controller.abort(); discovery.current.controller?.abort(); };
  }, []);

  const selectedProvider = providers.find(item => item.name === provider);
  const hasSessionKey = configuration?.provider === provider && configuration.hasCredential;
  const canDiscover = !!selectedProvider && (!selectedProvider.requiresCredential || !!apiKey.trim() || hasSessionKey);
  const currentOption = models.find(item => item.id === model);
  const configuredOption: GuardianAIModel | null = model && configuration?.provider === provider && configuration.model === model
    ? { id: model, name: model, provider } : null;
  // Preserve the saved selection without presenting it as a newly discovered model.
  const options = !currentOption && configuredOption ? [configuredOption, ...models] : models;
  const dirty = !!apiKey || (configuration
    ? provider !== configuration.provider || model !== configuration.model || temperature !== (configuration.temperature ?? 0.2) || maxTokens !== (configuration.maxTokens ?? 16000)
    : !!model || temperature !== 0.2 || maxTokens !== 16000);
  useImperativeHandle(ref, () => ({
    saveIfDirty: async () => dirty ? act('save') : true,
    isDirty: () => dirty || actionInProgress.current,
    discard: () => {
      if (actionInProgress.current) return;
      invalidateDiscovery(); setApiKey(''); setError(''); setMessage('');
      setProvider(configuration?.provider || providers[0]?.name || '');
      setModel(configuration?.model || '');
      setTemperature(configuration?.temperature ?? 0.2);
      setMaxTokens(configuration?.maxTokens ?? 16000);
    },
  }));
  function invalidateDiscovery() {
    discovery.current.controller?.abort(); discovery.current.sequence++;
    setDiscovering(false); setModels([]); setDiscovered(false);
  }
  function changeProvider(next: string) {
    invalidateDiscovery(); setProvider(next); setApiKey(''); setMessage(''); setError('');
    setModel(configuration?.provider === next ? configuration.model : '');
  }
  async function discover() {
    if (!canDiscover || busy) return;
    discovery.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++discovery.current.sequence;
    discovery.current.controller = controller;
    setDiscovering(true); setMessage(''); setError('');
    try {
      const result = await discoverAIModels(provider, apiKey.trim() || undefined, controller.signal);
      if (!mounted.current || sequence !== discovery.current.sequence) return;
      setModels(result); setDiscovered(true);
      setMessage(result.length ? `${result.length} models returned by ${selectedProvider?.displayName}.` : 'This provider returned no models for these credentials.');
    } catch (cause) {
      if (!mounted.current || controller.signal.aborted || sequence !== discovery.current.sequence) return;
      setError(cause instanceof Error ? cause.message : 'Model discovery failed');
      setDiscovered(false);
    } finally {
      if (mounted.current && sequence === discovery.current.sequence) setDiscovering(false);
    }
  }
  async function act(action: 'save' | 'test'): Promise<boolean> {
    if (actionInProgress.current) return false;
    if (action === 'save' && (!model || !canDiscover || !Number.isFinite(temperature) || temperature < 0 || temperature > 2 || !Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > 16000)) {
      setError('Choose a model, provide any required API key, and check the temperature and output-token limits before saving.');
      return false;
    }
    discovery.current.controller?.abort();
    actionInProgress.current = true;
    setBusy(true); setMessage(''); setError('');
    try {
      if (action === 'save') {
        const result = await updateAIProvider({
          provider: (provider === 'ollama' ? 'local' : provider) as AIProvider, model,
          apiKey: apiKey.trim() || undefined, temperature, maxTokens,
        });
        if (!result.success || !result.configuration) throw new Error(result.message || 'Guardian did not confirm the saved configuration.');
        // Discard the browser input immediately after Guardian accepts it.
        setApiKey('');
        if (!mounted.current) return false;
        setConfiguration(result.configuration); setMessage(result.message);
      } else {
        await guardianOperation('ai.test');
        if (mounted.current) setMessage('The configured model responded successfully.');
      }
      return true;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Provider operation failed');
      return false;
    } finally { actionInProgress.current = false; if (mounted.current) setBusy(false); }
  }
  const chosen = currentOption || configuredOption;
  return <Stack spacing={2}>
    <Typography variant="h6">Built-in security AI</Typography>
    <Typography variant="body2">Choose a provider, load its available models and save your selection. API keys stay in Guardian's memory only until the backend restarts; enter the key again after a restart. Keys are never saved to disk or browser storage.</Typography>
    {configuration && <Typography variant="body2" color="text.secondary">Current configuration: {configuration.provider} / {configuration.model}. {configuration.ready ? 'Ready to use.' : 'Enter the API key again to enable this session.'}</Typography>}
    {error && <Alert severity="error">{error}</Alert>}
    {message && <Alert severity={discovered && !models.length ? 'info' : 'success'}>{message}</Alert>}
    <TextField select label="AI provider" value={provider} disabled={busy} onChange={event => changeProvider(event.target.value)}>
      {providers.map(item => <MenuItem key={item.name} value={item.name}>{item.displayName}</MenuItem>)}
    </TextField>
    {selectedProvider?.requiresCredential && <TextField label="API key" type="password" autoComplete="off" disabled={busy} value={apiKey} onChange={event => {
      invalidateDiscovery(); setApiKey(event.target.value);
      setModel(configuration?.provider === provider ? configuration.model : '');
    }} helperText={hasSessionKey ? 'A key is available in Guardian memory for this provider. Leave empty to use it, or enter a replacement.' : 'Enter a key to discover models and enable this provider for the current Guardian session.'} />}
    <Button variant="outlined" disabled={busy || discovering || !canDiscover} onClick={() => void discover()}>
      {discovering ? 'Loading models…' : 'Load available models'}
    </Button>
    <Autocomplete
      options={options} value={chosen} loading={discovering} disabled={busy}
      getOptionLabel={option => option.name === option.id ? option.id : `${option.name} — ${option.id}`}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      onChange={(_event, option) => setModel(option?.id || '')}
      noOptionsText={discovering ? 'Loading models…' : discovered ? 'No models returned by this provider' : 'Load available models first'}
      renderOption={(props, option) => <li {...props} key={option.id}>
        <Box><Typography variant="body2">{option.name}</Typography>
          <Typography variant="caption" color="text.secondary">{option.id}{option.contextWindow ? ` · ${option.contextWindow.toLocaleString()} context tokens` : ''}{!models.some(item => item.id === option.id) ? ' · saved selection; not verified in this model list' : ''}</Typography>
        </Box>
      </li>}
      renderInput={params => <TextField {...params} label="Search available models" helperText={chosen && !currentOption ? 'Saved model preserved. Load models to verify current availability.' : 'Search the provider’s live model list by name or ID.'}
        InputProps={{ ...params.InputProps, endAdornment: <>{discovering ? <CircularProgress size={18} /> : null}{params.InputProps.endAdornment}</> }} />}
    />
    <Box sx={{ display: 'flex', gap: 2 }}>
      <TextField label="Temperature" type="number" value={temperature} disabled={busy} onChange={event => setTemperature(Number(event.target.value))} inputProps={{ min: 0, max: 2, step: 0.1 }} helperText="0–2; provider support varies." />
      <TextField label="Maximum output tokens" type="number" value={maxTokens} disabled={busy} onChange={event => setMaxTokens(Number(event.target.value))} inputProps={{ min: 256, max: 16000, step: 256 }} helperText="256–16,000 tokens." />
    </Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      <Button variant="contained" disabled={busy || discovering || !provider || !model || !canDiscover || !Number.isFinite(temperature) || temperature < 0 || temperature > 2 || !Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > 16000} onClick={() => void act('save')}>Save AI configuration</Button>
      <Button disabled={busy || discovering || !configuration?.ready} onClick={() => void act('test')}>Test configured model</Button>
    </Box>
    {busy && <Typography role="status">Waiting for Guardian…</Typography>}
  </Stack>;
});
export default GuardianProviderSettings;
