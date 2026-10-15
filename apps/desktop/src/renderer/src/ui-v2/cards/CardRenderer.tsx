import React from 'react';
import type { UiV2Card } from '../types';
import { MessageCard } from './MessageCard';
import { TranslationCard } from './TranslationCard';
import { InlineCorrectionCard } from '../language/InlineCorrectionCard';
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
 * Supports all canonical card types in the MAVE UI V2 Taxonomy:
 * 1. message
 * 2. translation
 * 3. correction
 * 4. source
 * 5. source_group
 * 6. video
 * 7. image
 * 8. file
 * 9. code
 * 10. diff
 * 11. comparison
 * 12. task
 * 13. progress
 * 14. approval
 * 15. error
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

    case 'correction': {
      const c = card.correction;
      return (
        <InlineCorrectionCard
          correction={c ? c : {
            id: card.id,
            originalText: card.originalText || '',
            correctedText: card.correctedText || '',
            naturalAlternative: card.naturalAlternative,
            alternativePhrasings: card.alternativePhrasings,
            explanation: card.explanation,
            category: card.category,
            intensity: card.intensity
          }}
          corrections={card.corrections || card.correctionsList}
          intensity={card.intensity || c?.intensity}
          targetLanguage={card.targetLanguage}
        />
      );
    }

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
