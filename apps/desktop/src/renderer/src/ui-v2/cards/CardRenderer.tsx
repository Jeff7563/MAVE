import React from 'react';
import type { UiV2Card } from '../types';
import { MessageCard } from './MessageCard';
import { TranslationCard } from './TranslationCard';
import { SourceCard, SourceGroupCard, VideoCard, ImageCard } from './MediaCards';
import { FileCard, CodeCard, DiffCard } from './CodeAndFileCards';
import { StructuredComparisonCard } from './StructuredComparisonCard';
import { TaskCard, ProgressCard, ApprovalCard, ErrorCard } from './ActionAndTaskCards';

export interface CardRendererProps {
  card: UiV2Card;
  onAllow?: (id: string) => void;
  onDeny?: (id: string) => void;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onListen?: (text: string) => void;
  onInspectFile?: (path: string) => void;
  onOpenSource?: (url: string) => void;
  onCopyCode?: (code: string) => void;
  onOpenWorkspace?: () => void;
}

/**
 * CardRenderer
 *
 * Dispatches to the appropriate card renderer component based on card.type.
 * Supports all 14 canonical card types in the MAVE UI V2 Taxonomy:
 * 1. message
 * 2. translation
 * 3. source
 * 4. source_group
 * 5. video
 * 6. image
 * 7. file
 * 8. code
 * 9. diff
 * 10. comparison
 * 11. task
 * 12. progress
 * 13. approval
 * 14. error
 */
export const CardRenderer: React.FC<CardRendererProps> = ({
  card,
  onAllow,
  onDeny,
  onRetry,
  onCancel,
  onListen,
  onInspectFile,
  onOpenSource,
  onCopyCode,
  onOpenWorkspace
}) => {
  switch (card.type) {
    case 'message':
      return <MessageCard data={card} />;

    case 'translation':
      return <TranslationCard data={card} onListen={onListen} onCopy={onCopyCode} />;

    case 'source':
      return <SourceCard data={card} onOpenSource={onOpenSource} />;

    case 'source_group':
      return <SourceGroupCard data={card} onOpenSource={onOpenSource} />;

    case 'video':
      return <VideoCard data={card} />;

    case 'image':
      return <ImageCard data={card} />;

    case 'file':
      return <FileCard data={card} onInspect={onInspectFile} />;

    case 'code':
      return <CodeCard data={card} onCopy={onCopyCode} />;

    case 'diff':
      return (
        <DiffCard
          data={card}
          onInspect={onInspectFile}
          onOpenWorkspace={onOpenWorkspace}
        />
      );

    case 'comparison':
      return (
        <StructuredComparisonCard
          data={card}
          onOpenWorkspace={onOpenWorkspace}
        />
      );

    case 'task':
      return (
        <TaskCard
          data={card}
          onCancel={() => onCancel?.(card.id)}
          onRetry={() => onRetry?.(card.id)}
        />
      );

    case 'progress':
      return (
        <ProgressCard
          data={card}
          onCancel={() => onCancel?.(card.id)}
        />
      );

    case 'approval':
      return (
        <ApprovalCard
          data={card}
          onAllowMock={() => onAllow?.(card.id)}
          onDenyMock={() => onDeny?.(card.id)}
          onAllow={() => onAllow?.(card.id)}
          onDeny={() => onDeny?.(card.id)}
        />
      );

    case 'error':
      return (
        <ErrorCard
          data={card}
          onRetry={() => onRetry?.(card.id)}
        />
      );

    default:
      return null;
  }
};
