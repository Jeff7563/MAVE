import React from 'react';
import type { SourceCardData, ComparisonCardData } from '../types';
import { SourceCard } from '../cards/MediaCards';
import { StructuredComparisonCard } from '../cards/StructuredComparisonCard';
import '../tokens.css';

export interface WorkspaceResearchViewProps {
  question?: string;
  summary?: string;
  takeaways?: string[];
  sources?: SourceCardData[];
  comparison?: ComparisonCardData;
  onOpenSource?: (url: string) => void;
  className?: string;
}

/**
 * WorkspaceResearchView
 *
 * Dedicated Level 3 Research Workspace View.
 * Organizes research questions, synthesized findings, comparison tables, and
 * source provenance into a structured analytical workspace.
 *
 * Invariant: Research Workspace does NOT imply autonomous agent execution.
 * It is an information structuring surface.
 */
export const WorkspaceResearchView: React.FC<WorkspaceResearchViewProps> = ({
  question,
  summary,
  takeaways = [],
  sources = [],
  comparison,
  onOpenSource,
  className = ''
}) => {
  return (
    <div
      className={`mave-v2-workspace-research-view ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '14px',
        overflowY: 'auto',
        color: 'var(--mave-v2-text-primary)'
      }}
      data-testid="workspace-research-view"
    >
      {/* 1. Research Question Card */}
      {question && (
        <div
          style={{
            background: 'rgba(18, 22, 38, 0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '16px',
            padding: '14px 18px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
          data-testid="research-question-card"
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--mave-v2-accent-retrieval)',
              textTransform: 'uppercase',
              letterSpacing: '0.4px'
            }}
          >
            Research Objective
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--mave-v2-text-primary)' }}>
            {question}
          </div>
        </div>
      )}

      {/* 2. Synthesized Summary & Key Takeaways */}
      {summary && (
        <div
          style={{
            background: 'rgba(18, 22, 38, 0.82)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
          data-testid="research-summary-card"
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mave-v2-text-secondary)' }}>
            Synthesized Findings
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--mave-v2-text-primary)' }}>
            {summary}
          </div>

          {takeaways.length > 0 && (
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mave-v2-text-muted)', textTransform: 'uppercase' }}>
                Key Takeaways:
              </div>
              {takeaways.map((point, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    color: 'var(--mave-v2-text-secondary)'
                  }}
                >
                  <span style={{ color: 'var(--mave-v2-accent-listening)' }}>✦</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Structured Comparison (if provided) */}
      {comparison && (
        <div style={{ width: '100%' }} data-testid="research-comparison-container">
          <StructuredComparisonCard data={comparison} />
        </div>
      )}

      {/* 4. Supporting Citations & External Sources */}
      {sources.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
          data-testid="research-sources-container"
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mave-v2-text-secondary)', paddingLeft: '2px' }}>
            Authoritative References ({sources.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
            {sources.map((src) => (
              <SourceCard
                key={src.id}
                data={src}
                onOpenSource={onOpenSource}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

