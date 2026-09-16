// ============================================================
//  CHAT UI — In-game multiplayer chat with mobile keyboard
// ============================================================

import { NetworkManager } from '../network/NetworkManager';

export class ChatUI {
  private container: HTMLElement;
  private messagesEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private sendBtn: HTMLElement;
  private toggleBtn: HTMLElement;
  private network: NetworkManager;
  private isOpen: boolean = false;
  private maxMessages: number = 50;
  private messages: ChatMessage[] = [];

  constructor(network: NetworkManager) {
    this.network = network;
    this.container = document.getElementById('chat-container')!;
    this.messagesEl = document.getElementById('chat-messages')!;
    this.inputEl = document.getElementById('chat-input') as HTMLInputElement;
    this.sendBtn = document.getElementById('chat-send')!;
    this.toggleBtn = document.getElementById('chat-toggle')!;

    this.bindEvents();
    this.addSystemMessage('Welcome to OpenWorld! Press 💬 to chat.');
  }

  private bindEvents(): void {
    this.toggleBtn.addEventListener('click', () => this.toggle());

    this.sendBtn.addEventListener('click', () => this.sendMessage());

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
      e.stopPropagation(); // Prevent game controls while typing
    });

    // Network chat callback
    this.network.onChatMessage = (sender, message) => {
      this.addMessage(sender, message);
    };
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.container.classList.toggle('hidden', !this.isOpen);
    if (this.isOpen) {
      this.inputEl.focus();
    }
  }

  private sendMessage(): void {
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.network.sendChatMessage(text);
    this.addMessage('You', text, true);
    this.inputEl.value = '';
  }

  addMessage(sender: string, text: string, isLocal: boolean = false): void {
    this.messages.push({ sender, text, time: Date.now(), isLocal });
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
    this.renderMessages();

    // Auto-open chat briefly on new message
    if (!this.isOpen && !isLocal) {
      this.container.classList.remove('hidden');
      setTimeout(() => {
        if (!this.isOpen) this.container.classList.add('hidden');
      }, 4000);
    }
  }

  addSystemMessage(text: string): void {
    this.addMessage('⚙️ System', text);
  }

  private renderMessages(): void {
    const html = this.messages.map(m => {
      const time = new Date(m.time).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit'
      });
      const cls = m.isLocal ? 'msg-local' : '';
      const senderColor = m.isLocal ? '#4ade80' : '#60a5fa';
      return `
        <div class="chat-msg ${cls}">
          <span class="msg-time">${time}</span>
          <span class="msg-sender" style="color:${senderColor}">${m.sender}:</span>
          <span class="msg-text">${this.escapeHtml(m.text)}</span>
        </div>
      `;
    }).join('');

    this.messagesEl.innerHTML = html;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

interface ChatMessage {
  sender: string;
  text: string;
  time: number;
  isLocal: boolean;
}
