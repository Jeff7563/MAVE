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
        marginBottom: '10px',
        width: '100%'
      }}
      data-testid={`message-card-${data.role}`}
    >
      <div
        style={{
          maxWidth: '85%',
          background: isUser
            ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(56, 189, 248, 0.15) 100%)'
            : 'var(--mave-v2-surface-elevated)',
          border: isUser
            ? '1px solid rgba(56, 189, 248, 0.3)'
            : '1px solid var(--mave-v2-border-subtle)',
          borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
          padding: '10px 14px',
          color: 'var(--mave-v2-text-primary)',
          fontSize: '13px',
          lineHeight: '1.5',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
        }}
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>{data.content}</div>
        {data.semanticRuntime && (
          <div
            style={{
              fontSize: '10px',
              color: 'var(--mave-v2-text-dim)',
              marginTop: '4px',
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

