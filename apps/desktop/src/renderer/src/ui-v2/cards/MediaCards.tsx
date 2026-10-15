import React, { useState } from 'react';
import type {
  SourceCardData,
  SourceGroupCardData,
  VideoCardData,
  ImageCardData
} from '../types';
import { CardShell } from '../primitives/CardShell';
import '../tokens.css';

// ---------------------------------------------------------------------------
// 1. SourceCard
// ---------------------------------------------------------------------------

export interface SourceCardProps {
  data: SourceCardData;
  onOpenSource?: (url: string) => void;
}

export const SourceCard: React.FC<SourceCardProps> = ({ data, onOpenSource }) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const isSnippetLong = data.snippet.length > 120;
  const citationBadge = data.citationIndex !== undefined ? `[${data.citationIndex}]` : 'Source';

  const handleOpen = (e: React.MouseEvent) => {
    if (onOpenSource) {
      e.preventDefault();
      onOpenSource(data.url);
    }
  };

  return (
    <CardShell
      id={data.id}
      badge={citationBadge}
      badgeColor="var(--mave-cyan)"
      title={data.domain}
      timestamp={data.authorOrDate}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          onClick={handleOpen}
          aria-label={`View source: ${data.title}`}
          style={{
            color: 'var(--mave-cyan)',
            fontSize: '12px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 500
          }}
          data-testid="link-view-source"
        >
          View Source ↗
        </a>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div
          style={{ fontWeight: 600, fontSize: '15px', color: 'var(--mave-ink)', lineHeight: 1.4 }}
          data-testid="source-card-title"
        >
          {data.title}
        </div>

        <div
          style={{
            fontSize: '13px',
            color: 'var(--mave-dim)',
            lineHeight: 1.5
          }}
          data-testid="source-card-snippet"
        >
          {expanded || !isSnippetLong ? data.snippet : `${data.snippet.slice(0, 120)}…`}
        </div>

        {isSnippetLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Show less snippet' : 'Show full snippet'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--mave-faint)',
              fontSize: '11px',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              marginTop: '2px',
              fontFamily: 'var(--mave-font-mono)'
            }}
            data-testid="btn-toggle-snippet"
          >
            {expanded ? '▲ Show less' : '▼ Read more'}
          </button>
        )}
      </div>
    </CardShell>
  );
};

// ---------------------------------------------------------------------------
// 2. SourceGroupCard (Structured Composite of multiple sources)
// ---------------------------------------------------------------------------

export interface SourceGroupCardProps {
  data: SourceGroupCardData;
  onOpenSource?: (url: string) => void;
}

export const SourceGroupCard: React.FC<SourceGroupCardProps> = ({ data, onOpenSource }) => {
  const [expanded, setExpanded] = useState<boolean>(data.defaultExpanded ?? false);
  const count = data.sources.length;

  return (
    <CardShell
      id={data.id}
      badge={`Sources · ${count}`}
      badgeColor="var(--mave-cyan)"
      intent={data.intent || 'quiet'}
      density={data.density || 'standard'}
      actions={
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Collapse sources list' : `Expand all ${count} sources`}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--mave-cyan)',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 500,
            fontFamily: 'var(--mave-font-mono)'
          }}
          data-testid="btn-toggle-source-group"
        >
          {expanded ? '▲ Collapse list' : `▼ Expand all (${count})`}
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Compact summary rows when collapsed */}
        {!expanded && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
            data-testid="source-group-summary-list"
          >
            {data.sources.slice(0, 5).map((src, idx) => (
              <div
                key={src.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: 'var(--mave-dim)',
                  padding: '3px 0'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--mave-cyan)', fontWeight: 600, fontFamily: 'var(--mave-font-mono)' }}>
                    [{src.citationIndex ?? idx + 1}]
                  </span>
                  <span style={{ fontWeight: 500, color: 'var(--mave-ink)' }}>
                    {src.title}
                  </span>
                </span>
                <span style={{ color: 'var(--mave-faint)', fontSize: '11px', fontFamily: 'var(--mave-font-mono)' }}>
                  {src.domain}
                </span>
              </div>
            ))}
            {count > 5 && (
              <div style={{ fontSize: '11px', color: 'var(--mave-faint)', fontStyle: 'italic', fontFamily: 'var(--mave-font-mono)' }}>
                +{count - 5} more sources…
              </div>
            )}
          </div>
        )}

        {/* Full stacked source rows when expanded (no nested CardShell) */}
        {expanded && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}
            data-testid="source-group-expanded-list"
          >
            {data.sources.map((src, idx) => {
              const citIndex = src.citationIndex ?? idx + 1;
              const isPrimary = idx === 0;

              return (
                <div
                  key={src.id}
                  style={{
                    padding: isPrimary ? '12px 14px' : '10px 12px',
                    borderRadius: '12px',
                    background: isPrimary ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                    border: isPrimary ? '1px solid var(--mave-line)' : 'none',
                    borderTop: !isPrimary ? '1px solid var(--mave-line)' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--mave-font-mono)',
                          fontSize: '11px',
                          color: 'var(--mave-cyan)',
                          fontWeight: 600,
                          background: 'rgba(95, 210, 255, 0.08)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        [{citIndex}]
                      </span>
                      <span
                        style={{
                          fontWeight: isPrimary ? 600 : 500,
                          fontSize: isPrimary ? '14px' : '13px',
                          color: 'var(--mave-ink)'
                        }}
                        data-testid="source-card-title"
                      >
                        {src.title}
                      </span>
                    </div>
                    <span style={{ color: 'var(--mave-faint)', fontSize: '11px', fontFamily: 'var(--mave-font-mono)' }}>
                      {src.domain}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--mave-dim)',
                      lineHeight: 1.45
                    }}
                    data-testid="source-card-snippet"
                  >
                    {src.snippet}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        if (onOpenSource) {
                          e.preventDefault();
                          onOpenSource(src.url);
                        }
                      }}
                      aria-label={`View source: ${src.title}`}
                      style={{
                        color: 'var(--mave-cyan)',
                        fontSize: '11px',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 500
                      }}
                      data-testid="link-view-source"
                    >
                      View Source ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CardShell>
  );
};

// ---------------------------------------------------------------------------
// 3. VideoCard
// ---------------------------------------------------------------------------

export interface VideoCardProps {
  data: VideoCardData;
  onOpenVideo?: (url?: string) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ data, onOpenVideo }) => {
  const handleOpen = (e: React.MouseEvent) => {
    if (onOpenVideo) {
      e.preventDefault();
      onOpenVideo(data.url);
    }
  };

  return (
    <CardShell
      id={data.id}
      badge="Video Result"
      badgeColor="var(--mave-cyan)"
      title={data.channel}
      timestamp={data.duration}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        <a
          href={data.url || '#'}
          target="_blank"
          rel="noreferrer"
          onClick={handleOpen}
          aria-label={`Watch video: ${data.title}`}
          style={{
            color: 'var(--mave-cyan)',
            fontSize: '12px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 500
          }}
          data-testid="link-watch-video"
        >
          Watch Video ↗
        </a>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Synthetic Video Thumbnail Preview (Dark Glass Spec) */}
        <div
          style={{
            height: '130px',
            background: 'linear-gradient(180deg, rgba(20, 24, 46, 0.9) 0%, rgba(10, 12, 24, 0.95) 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            border: '1px solid var(--mave-line)',
            overflow: 'hidden'
          }}
          data-testid="video-thumbnail-placeholder"
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'var(--mave-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(91, 132, 255, 0.45)'
            }}
          >
            <span style={{ color: '#ffffff', fontSize: '15px', marginLeft: '3px' }}>▶</span>
          </div>
          <span
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '10px',
              background: 'rgba(5, 6, 13, 0.85)',
              border: '1px solid var(--mave-line)',
              color: 'var(--mave-ink)',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'var(--mave-font-mono)',
              fontWeight: 600
            }}
          >
            {data.duration}
          </span>
        </div>

        {/* Video Metadata */}
        <div>
          <div
            style={{ fontWeight: 600, fontSize: '15px', color: 'var(--mave-ink)', lineHeight: 1.4 }}
            data-testid="video-card-title"
          >
            {data.title}
          </div>
          {data.summary && (
            <div
              style={{ fontSize: '13px', color: 'var(--mave-dim)', marginTop: '4px', lineHeight: 1.45 }}
              data-testid="video-card-summary"
            >
              {data.summary}
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
};

// ---------------------------------------------------------------------------
// 4. ImageCard (Media Reference)
// ---------------------------------------------------------------------------

export interface ImageCardProps {
  data: ImageCardData;
  onOpenImage?: (url?: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ data, onOpenImage }) => {
  return (
    <CardShell
      id={data.id}
      badge="Media"
      badgeColor="var(--mave-cyan)"
      title={data.provenance?.domain || 'Image Preview'}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        onOpenImage && (
          <button
            onClick={() => onOpenImage(data.url)}
            aria-label={`Open image: ${data.caption}`}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--mave-cyan)',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 500
            }}
            data-testid="btn-open-image"
          >
            Open Media ↗
          </button>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Synthetic Media Canvas Preview */}
        <div
          style={{
            height: '130px',
            background: 'linear-gradient(180deg, rgba(20, 24, 46, 0.8) 0%, rgba(10, 12, 24, 0.95) 100%)',
            borderRadius: '12px',
            border: '1px solid var(--mave-line)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--mave-dim)',
            fontSize: '12px',
            gap: '6px'
          }}
          data-testid="image-canvas-placeholder"
        >
          <span style={{ fontSize: '24px' }}>🖼</span>
          <span>{data.altText || data.caption}</span>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--mave-dim)', lineHeight: 1.45 }}>
          {data.caption}
        </div>
      </div>
    </CardShell>
  );
};
