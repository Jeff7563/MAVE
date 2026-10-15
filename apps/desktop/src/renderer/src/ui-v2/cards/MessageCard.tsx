import React from 'react';
import type { MessageCardData } from '../types';
import '../tokens.css';

export interface MessageCardProps {
  data: MessageCardData;
}

export const MessageCard: React.FC<MessageCardProps> = ({ data }) => {
  const isUser = data.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
        width: '100%'
      }}
      data-testid={`message-card-${data.role}`}
    >
      <div
        style={{
          maxWidth: '85%',
          background: isUser
            ? 'linear-gradient(135deg, rgba(91, 132, 255, 0.20) 0%, rgba(95, 210, 255, 0.10) 100%)'
            : 'var(--mave-surface)',
          border: isUser
            ? '1px solid rgba(91, 132, 255, 0.32)'
            : '1px solid var(--mave-line)',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          padding: '12px 16px',
          color: 'var(--mave-ink)',
          fontSize: '14px',
          lineHeight: '1.55',
          boxShadow: isUser ? '0 4px 16px rgba(0, 0, 0, 0.3)' : 'var(--mave-shadow-glass)',
          fontFamily: 'var(--mave-font-sans)'
        }}
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>{data.content}</div>
        {data.semanticRuntime && (
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'var(--mave-font-mono)',
              color: 'var(--mave-faint)',
              marginTop: '6px',
              textAlign: isUser ? 'right' : 'left'
            }}
          >
            {data.semanticRuntime}
          </div>
        )}
      </div>
    </div>
  );
};

