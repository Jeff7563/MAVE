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
      badgeColor="var(--mave-v2-accent-retrieval)"
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
            color: 'var(--mave-v2-accent-listening)',
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
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mave-v2-text-primary)' }}
          data-testid="source-card-title"
        >
          {data.title}
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'var(--mave-v2-text-secondary)',
            lineHeight: 1.45
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
              color: 'var(--mave-v2-text-dim)',
              fontSize: '11px',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              marginTop: '2px'
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
      badgeColor="var(--mave-v2-accent-retrieval)"
      intent={data.intent || 'quiet'}
      density={data.density || 'standard'}
      actions={
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Collapse sources list' : `Expand all ${count} sources`}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--mave-v2-accent-listening)',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 500
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
            style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
            data-testid="source-group-summary-list"
          >
            {data.sources.slice(0, 5).map((src, idx) => (
              <div
                key={src.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--mave-v2-text-secondary)',
                  padding: '2px 0'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--mave-v2-accent-listening)', fontWeight: 600 }}>
                    [{src.citationIndex ?? idx + 1}]
                  </span>
                  <span style={{ fontWeight: 500, color: 'var(--mave-v2-text-primary)' }}>
                    {src.title}
                  </span>
                </span>
                <span style={{ color: 'var(--mave-v2-text-dim)', fontSize: '10px' }}>
                  {src.domain}
                </span>
              </div>
            ))}
            {count > 5 && (
              <div style={{ fontSize: '10px', color: 'var(--mave-v2-text-dim)', fontStyle: 'italic' }}>
                +{count - 5} more sources…
              </div>
            )}
          </div>
        )}

        {/* Full stacked cards when expanded */}
        {expanded && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}
            data-testid="source-group-expanded-list"
          >
            {data.sources.map((src, idx) => (
              <SourceCard
                key={src.id}
                data={{
                  ...src,
                  citationIndex: src.citationIndex ?? idx + 1,
                  density: 'compact'
                }}
                onOpenSource={onOpenSource}
              />
            ))}
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
      badgeColor="var(--mave-v2-accent-warning)"
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
            color: 'var(--mave-v2-accent-listening)',
            fontSize: '11px',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Synthetic Video Thumbnail Preview (Zero external network dependencies) */}
        <div
          style={{
            height: '110px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            border: '1px solid var(--mave-v2-border-subtle)',
            overflow: 'hidden'
          }}
          data-testid="video-thumbnail-placeholder"
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(56, 189, 248, 0.5)'
            }}
          >
            <span style={{ color: '#0f172a', fontSize: '14px', marginLeft: '2px' }}>▶</span>
          </div>
          <span
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '8px',
              background: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600
            }}
          >
            {data.duration}
          </span>
        </div>

        {/* Video Metadata */}
        <div>
          <div
            style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mave-v2-text-primary)' }}
            data-testid="video-card-title"
          >
            {data.title}
          </div>
          {data.summary && (
            <div
              style={{ fontSize: '12px', color: 'var(--mave-v2-text-secondary)', marginTop: '2px', lineHeight: 1.4 }}
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
      badgeColor="var(--mave-v2-accent-listening)"
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
              color: 'var(--mave-v2-accent-listening)',
              fontSize: '11px',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Synthetic Media Canvas Preview */}
        <div
          style={{
            height: '120px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
            borderRadius: '8px',
            border: '1px solid var(--mave-v2-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--mave-v2-text-dim)',
            fontSize: '11px',
            gap: '4px'
          }}
          data-testid="image-canvas-placeholder"
        >
          <span style={{ fontSize: '20px' }}>🖼</span>
          <span>{data.altText || data.caption}</span>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--mave-v2-text-secondary)', lineHeight: 1.4 }}>
          {data.caption}
        </div>
      </div>
    </CardShell>
  );
};
