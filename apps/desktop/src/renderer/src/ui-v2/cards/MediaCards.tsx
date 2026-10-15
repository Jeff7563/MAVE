import React from 'react';
import type { SourceCardData, VideoCardData } from '../types';
import { CardShell } from '../primitives/CardShell';
import '../tokens.css';

export interface SourceCardProps {
  data: SourceCardData;
}

export const SourceCard: React.FC<SourceCardProps> = ({ data }) => {
  return (
    <CardShell
      id={data.id}
      badge="Source Citation"
      badgeColor="var(--mave-v2-accent-retrieval)"
      title={data.domain}
      timestamp={data.authorOrDate}
      actions={
        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          style={{
            color: 'var(--mave-v2-accent-listening)',
            fontSize: '11px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          View Source ↗
        </a>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mave-v2-text-primary)' }}>
          {data.title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--mave-v2-text-secondary)', lineHeight: 1.4 }}>
          {data.snippet}
        </div>
      </div>
    </CardShell>
  );
};

export interface VideoCardProps {
  data: VideoCardData;
}

export const VideoCard: React.FC<VideoCardProps> = ({ data }) => {
  return (
    <CardShell
      id={data.id}
      badge="Video Result"
      badgeColor="var(--mave-v2-accent-warning)"
      title={data.channel}
      timestamp={data.duration}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Synthetic Video Thumbnail Preview */}
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
          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mave-v2-text-primary)' }}>
            {data.title}
          </div>
          {data.summary && (
            <div style={{ fontSize: '11px', color: 'var(--mave-v2-text-secondary)', marginTop: '2px' }}>
              {data.summary}
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
};

