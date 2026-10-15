import React from 'react';
import type { UiV2Card } from '../types';
import { MessageCard } from './MessageCard';
import { TranslationCard } from './TranslationCard';
import { SourceCard, VideoCard } from './MediaCards';
import { FileCard, CodeCard } from './CodeAndFileCards';
import { TaskCard, ApprovalCard, ErrorCard } from './ActionAndTaskCards';

export interface CardRendererProps {
  card: UiV2Card;
  onAllow?: (id: string) => void;
  onDeny?: (id: string) => void;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onListen?: (text: string) => void;
}

/**
 * CardRenderer
 *
 * Dispatches to the appropriate card renderer component based on card.type.
 */
export const CardRenderer: React.FC<CardRendererProps> = ({
  card,
  onAllow,
  onDeny,
  onRetry,
  onCancel,
  onListen
}) => {
  switch (card.type) {
    case 'message':
      return <MessageCard data={card} />;
    case 'translation':
      return <TranslationCard data={card} onListen={onListen} />;
    case 'source':
      return <SourceCard data={card} />;
    case 'video':
      return <VideoCard data={card} />;
    case 'file':
      return <FileCard data={card} />;
    case 'code':
      return <CodeCard data={card} />;
    case 'task':
      return <TaskCard data={card} onCancel={() => onCancel?.(card.id)} onRetry={() => onRetry?.(card.id)} />;
    case 'approval':
      return <ApprovalCard data={card} onAllow={() => onAllow?.(card.id)} onDeny={() => onDeny?.(card.id)} />;
    case 'error':
      return <ErrorCard data={card} onRetry={() => onRetry?.(card.id)} />;
    default:
      return null;
  }
};

