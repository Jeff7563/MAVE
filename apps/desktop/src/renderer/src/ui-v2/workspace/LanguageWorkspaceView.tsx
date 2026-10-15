import React from 'react';
import type { WorkspaceState } from '../types';
import '../tokens.css';

export interface LanguageWorkspaceViewProps {
  state: WorkspaceState;
}

/**
 * LanguageWorkspaceView
 *
 * Demonstrates that Language Learning is an EXPERIENCE CONTEXT inside MAVE,
 * not a global product identity.
 * Displays:
 * - Contextual label: "Language Practice • Japanese/English"
 * - Conversational dialogue & real-time pronunciation tips
 * - Vocabulary bank and recurring grammar takeaways
 */
export const LanguageWorkspaceView: React.FC<LanguageWorkspaceViewProps> = ({ state }) => {
  const context = state.languageContext;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: '16px',
        height: '100%',
        overflow: 'hidden'
      }}
      data-testid="language-workspace-view"
    >
      {/* Main Conversation & Speaking Practice Region */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto'
        }}
      >
        <div
          style={{
            background: 'var(--mave-v2-surface-elevated)',
            border: '1px solid var(--mave-v2-border-subtle)',
            borderRadius: 'var(--mave-v2-radius-card)',
            padding: '14px 16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mave-v2-accent-listening)', textTransform: 'uppercase' }}>
              Speaking Session • {context?.targetLanguage ?? 'Bilingual Practice'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)' }}>
              Mode: {context?.mode ?? 'Conversational'}
            </span>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
              <strong style={{ color: 'var(--mave-v2-accent-listening)' }}>MAVE Coach:</strong> Try expressing your plan for this weekend using natural phrasing.
            </div>

            {context?.naturalPhrasing && (
              <div
                style={{
                  borderLeft: '3px solid var(--mave-v2-accent-listening)',
                  paddingLeft: '10px',
                  fontSize: '12px',
                  color: 'var(--mave-v2-text-secondary)'
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--mave-v2-text-primary)' }}>Natural Suggestion:</div>
                <div>{context.naturalPhrasing}</div>
              </div>
            )}
          </div>
        </div>

        {/* Practice Exercises / Prompts */}
        <div
          style={{
            background: 'var(--mave-v2-surface-elevated)',
            border: '1px solid var(--mave-v2-border-subtle)',
            borderRadius: 'var(--mave-v2-radius-card)',
            padding: '14px 16px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mave-v2-text-secondary)', marginBottom: '8px' }}>
            Interactive Practice Queue
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {state.steps?.map((step) => (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: step.status === 'completed' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  fontSize: '12px'
                }}
              >
                <span style={{ color: step.status === 'completed' ? 'var(--mave-v2-text-muted)' : 'var(--mave-v2-text-primary)' }}>
                  {step.label}
                </span>
                <span style={{ fontSize: '10px', color: step.status === 'completed' ? 'var(--mave-v2-accent-success)' : 'var(--mave-v2-text-dim)', fontWeight: 600 }}>
                  {step.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Side Vocabulary & Grammar Bank */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto'
        }}
      >
        <div
          style={{
            background: 'var(--mave-v2-surface-elevated)',
            border: '1px solid var(--mave-v2-border-subtle)',
            borderRadius: 'var(--mave-v2-radius-card)',
            padding: '14px 16px'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mave-v2-accent-thinking)', textTransform: 'uppercase', marginBottom: '10px' }}>
            Session Vocabulary Recap
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {context?.vocabulary?.map((v, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  fontSize: '11px'
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--mave-v2-text-primary)' }}>{v.term}</div>
                <div style={{ color: 'var(--mave-v2-text-secondary)', marginTop: '2px' }}>{v.meaning}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

