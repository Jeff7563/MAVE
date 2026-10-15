import React, { useState } from 'react';
import type { ComparisonCardData } from '../types';
import { CardShell } from '../primitives/CardShell';
import '../tokens.css';

export interface StructuredComparisonCardProps {
  data: ComparisonCardData;
  onOpenWorkspace?: () => void;
}

/**
 * StructuredComparisonCard
 *
 * Presents structured comparisons, small tables, and key-value matrices.
 * Features:
 * - Wide Viewport: Semantic accessible <table> with accessible headers and highlighted rows
 * - Narrow Viewport / Compact: Responsive transformation into vertically stacked key-value records
 * - Layout toggle affordance (Table vs Stacked)
 * - Highlighted row styling and pill badges
 * - Safe string rendering for all cells
 * - Open in Workspace synthetic intent for complex data sets
 */
export const StructuredComparisonCard: React.FC<StructuredComparisonCardProps> = ({
  data,
  onOpenWorkspace
}) => {
  // Respect forced responsiveStack prop or density, while allowing interactive toggle
  const initialStacked = data.responsiveStack ?? data.density === 'compact';
  const [isStacked, setIsStacked] = useState<boolean>(initialStacked);

  const primaryCol = data.columns.find((c) => c.isPrimary) || data.columns[0];

  const formatCellValue = (val: string | number | boolean | undefined): string => {
    if (val === undefined || val === null) return '—';
    if (typeof val === 'boolean') return val ? '✓ Yes' : '✕ No';
    return String(val);
  };

  return (
    <CardShell
      id={data.id}
      badge="COMPARISON"
      badgeColor="var(--mave-v2-accent-listening)"
      title={data.title || 'Structured Comparison'}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsStacked(!isStacked)}
            style={{
              background: 'transparent',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '4px',
              color: 'var(--mave-v2-text-secondary)',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
            data-testid="btn-toggle-comparison-layout"
            aria-label="Toggle between table and stacked record layout"
          >
            {isStacked ? '▦ Table View' : '▤ Stacked View'}
          </button>

          {onOpenWorkspace && (
            <button
              onClick={onOpenWorkspace}
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '4px',
                color: 'var(--mave-v2-accent-listening)',
                padding: '3px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              data-testid="btn-open-comparison-workspace"
              aria-label="Open detailed comparison in Workspace"
            >
              Open in Workspace ⤢
            </button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="comparison-card">
        {/* Caption */}
        {data.caption && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--mave-v2-text-secondary)',
              lineHeight: 1.4
            }}
            data-testid="comparison-caption"
          >
            {data.caption}
          </div>
        )}

        {/* View Mode 1: Table Rendering (Wide Viewport) */}
        {!isStacked && (
          <div
            style={{
              overflowX: 'auto',
              borderRadius: '6px',
              border: '1px solid var(--mave-v2-border-subtle)',
              background: 'rgba(0, 0, 0, 0.3)'
            }}
            data-testid="comparison-table-wrapper"
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: data.density === 'compact' ? '11px' : '12px',
                textAlign: 'left'
              }}
              role="table"
              aria-label={data.title || data.caption || 'Comparison Table'}
              data-testid="comparison-table"
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--mave-v2-border-subtle)', background: 'rgba(255, 255, 255, 0.03)' }}>
                  {data.columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      style={{
                        padding: '8px 10px',
                        color: col.isPrimary ? 'var(--mave-v2-text-primary)' : 'var(--mave-v2-text-dim)',
                        fontWeight: col.isPrimary ? 700 : 600,
                        whiteSpace: 'nowrap'
                      }}
                      data-testid={`comparison-th-${col.key}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: row.highlighted ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                      transition: 'background var(--mave-v2-motion-fast)'
                    }}
                    data-testid={`comparison-row-${row.id}`}
                    data-highlighted={row.highlighted ? 'true' : 'false'}
                  >
                    {data.columns.map((col, cIdx) => {
                      const cellVal = row.values[col.key];
                      const isFirst = cIdx === 0;

                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: '8px 10px',
                            color: col.isPrimary
                              ? 'var(--mave-v2-text-primary)'
                              : 'var(--mave-v2-text-secondary)',
                            fontWeight: col.isPrimary ? 600 : 400
                          }}
                          data-testid={`comparison-cell-${row.id}-${col.key}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{formatCellValue(cellVal)}</span>
                            {isFirst && row.badge && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: 'var(--mave-v2-accent-listening)',
                                  fontWeight: 600
                                }}
                                data-testid={`row-badge-${row.id}`}
                              >
                                {row.badge}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* View Mode 2: Responsive Stacked Records (Narrow Viewport / Compact) */}
        {isStacked && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            data-testid="comparison-stacked-list"
          >
            {data.rows.map((row) => {
              const primaryVal = primaryCol ? row.values[primaryCol.key] : row.id;

              return (
                <div
                  key={row.id}
                  style={{
                    background: row.highlighted
                      ? 'rgba(56, 189, 248, 0.08)'
                      : 'rgba(0, 0, 0, 0.35)',
                    border: row.highlighted
                      ? '1px solid rgba(56, 189, 248, 0.3)'
                      : '1px solid var(--mave-v2-border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                  data-testid={`comparison-stacked-record-${row.id}`}
                  data-highlighted={row.highlighted ? 'true' : 'false'}
                >
                  {/* Record Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      paddingBottom: '4px',
                      marginBottom: '2px'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--mave-v2-text-primary)', fontSize: '12px' }}>
                      {formatCellValue(primaryVal)}
                    </span>
                    {row.badge && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: 'var(--mave-v2-accent-listening)',
                          fontWeight: 600
                        }}
                        data-testid={`stacked-row-badge-${row.id}`}
                      >
                        {row.badge}
                      </span>
                    )}
                  </div>

                  {/* Field values */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px' }}>
                    {data.columns
                      .filter((col) => col.key !== primaryCol?.key)
                      .map((col) => (
                        <div
                          key={col.key}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '2px 0'
                          }}
                        >
                          <span style={{ color: 'var(--mave-v2-text-dim)' }}>
                            {col.label}:
                          </span>
                          <span style={{ color: 'var(--mave-v2-text-secondary)', fontWeight: 500 }}>
                            {formatCellValue(row.values[col.key])}
                          </span>
                        </div>
                      ))}
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

