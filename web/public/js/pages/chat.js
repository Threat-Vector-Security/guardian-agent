/**
 * Chat page — agent selector, message history, text input.
 * Shows LLM connection status and a thinking indicator while waiting.
 */

import { api } from '../api.js';

let chatHistory = [];

export async function renderChat(container) {
  container.innerHTML = '<h2 class="page-title">Chat</h2><div class="loading">Loading...</div>';

  let agents = [];
  let providers = [];
  try {
    [agents, providers] = await Promise.all([
      api.agents().catch(() => []),
      api.providersStatus().catch(() => api.providers().catch(() => [])),
    ]);
  } catch {
    // Continue with empty lists
  }

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'chat-container';

  // Provider status bar
  const providerBar = document.createElement('div');
  providerBar.style.cssText = 'display:flex;gap:0.75rem;margin-bottom:0.75rem;flex-wrap:wrap;';
  for (const p of providers) {
    const chip = document.createElement('span');
    const isConnected = p.connected !== false;
    const locality = p.locality === 'local' ? 'Local' : 'API';
    chip.className = `badge ${isConnected ? 'badge-idle' : 'badge-errored'}`;
    chip.style.cssText = 'padding:0.3rem 0.6rem;font-size:0.7rem;';
    chip.textContent = `${p.name}: ${p.model} (${locality}) ${isConnected ? 'Connected' : 'Disconnected'}`;
    providerBar.appendChild(chip);
  }
  if (providers.length === 0) {
    const chip = document.createElement('span');
    chip.className = 'badge badge-errored';
    chip.style.cssText = 'padding:0.3rem 0.6rem;font-size:0.7rem;';
    chip.textContent = 'No LLM providers configured';
    providerBar.appendChild(chip);
  }
  wrapper.appendChild(providerBar);

  // Toolbar with agent selector
  const toolbar = document.createElement('div');
  toolbar.className = 'chat-toolbar';

  const label = document.createElement('label');
  label.textContent = 'Agent:';
  label.style.fontSize = '0.8rem';
  label.style.color = 'var(--text-muted)';

  const select = document.createElement('select');
  select.id = 'chat-agent-select';
  if (agents.length === 0) {
    select.innerHTML = '<option value="">No agents available</option>';
  } else {
    select.innerHTML = agents.map(a =>
      `<option value="${esc(a.id)}">${esc(a.name)} (${esc(a.id)})${a.provider ? ' - ' + esc(a.provider) : ''}</option>`
    ).join('');
  }

  toolbar.append(label, select);
  wrapper.appendChild(toolbar);

  // Chat history
  const history = document.createElement('div');
  history.className = 'chat-history';
  history.id = 'chat-history';

  // Render previous messages
  for (const msg of chatHistory) {
    history.appendChild(createMessageEl(msg.role, msg.content));
  }

  wrapper.appendChild(history);

  // Input area
  const inputArea = document.createElement('div');
  inputArea.className = 'chat-input-area';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type a message...';
  input.id = 'chat-input';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'btn btn-primary';
  sendBtn.textContent = 'Send';

  const send = async () => {
    const text = input.value.trim();
    if (!text) return;

    const agentId = select.value;
    if (!agentId) return;

    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    // Add user message
    chatHistory.push({ role: 'user', content: text });
    history.appendChild(createMessageEl('user', text));

    // Add thinking indicator
    const thinkingEl = createThinkingEl();
    history.appendChild(thinkingEl);
    history.scrollTop = history.scrollHeight;

    try {
      const response = await api.sendMessage(text, agentId);
      // Remove thinking indicator
      thinkingEl.remove();
      chatHistory.push({ role: 'agent', content: response.content });
      history.appendChild(createMessageEl('agent', response.content));
    } catch (err) {
      thinkingEl.remove();
      const errorMsg = err.message === 'AUTH_FAILED'
        ? 'Authentication failed'
        : err.message || 'Failed to get response';
      chatHistory.push({ role: 'agent', content: `Error: ${errorMsg}` });
      history.appendChild(createMessageEl('error', `Error: ${errorMsg}`));
    }

    history.scrollTop = history.scrollHeight;
    input.disabled = false;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    input.focus();
  };

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send();
  });

  inputArea.append(input, sendBtn);
  wrapper.appendChild(inputArea);

  container.appendChild(wrapper);
  input.focus();
}

function createThinkingEl() {
  const el = document.createElement('div');
  el.className = 'chat-message agent';
  el.innerHTML = `
    <div class="msg-header">Agent</div>
    <div class="msg-body thinking">
      <span class="thinking-dots">Thinking<span class="dot1">.</span><span class="dot2">.</span><span class="dot3">.</span></span>
    </div>
  `;
  // Animate dots
  const style = document.createElement('style');
  style.textContent = `
    .thinking-dots .dot1 { animation: blink 1.4s infinite 0s; }
    .thinking-dots .dot2 { animation: blink 1.4s infinite 0.2s; }
    .thinking-dots .dot3 { animation: blink 1.4s infinite 0.4s; }
    @keyframes blink { 0%, 20% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
  `;
  if (!document.querySelector('#thinking-style')) {
    style.id = 'thinking-style';
    document.head.appendChild(style);
  }
  return el;
}

function createMessageEl(role, content) {
  const msg = document.createElement('div');
  const cssClass = role === 'error' ? 'agent' : role;
  msg.className = `chat-message ${cssClass}`;
  const label = role === 'user' ? 'You' : 'Agent';
  msg.innerHTML = `
    <div class="msg-header">${label}</div>
    <div class="msg-body" ${role === 'error' ? 'style="color:var(--error);"' : ''}>${esc(content)}</div>
  `;
  return msg;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
