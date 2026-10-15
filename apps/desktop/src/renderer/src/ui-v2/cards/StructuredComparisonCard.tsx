import React, { useState } from 'react';
import type { ComparisonCardData } from '../types';
import { CardShell } from '../primitives/CardShell';
import { TableIcon, StackedIcon, ExpandIcon } from '../primitives/Icons';
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
  // Narrow / Sidecar defaults to stacked key-value presentation; wide table otherwise
  const initialStacked = data.responsiveStack ?? (data.density === 'compact' || Boolean(data.columns && data.columns.length > 3));
  const [isStacked, setIsStacked] = useState<boolean>(initialStacked);

  const primaryCol = data.columns.find((c) => c.isPrimary) || data.columns[0];

  const formatCellValue = (val: string | number | boolean | undefined): string => {
    if (val === undefined || val === null) return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  return (
    <CardShell
      id={data.id}
      badge="COMPARISON"
      badgeColor="var(--mave-cyan)"
      title={data.title || 'Structured Comparison'}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsStacked(!isStacked)}
            style={{
              background: 'transparent',
              border: '1px solid var(--mave-line)',
              borderRadius: '8px',
              color: 'var(--mave-dim)',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: 'var(--mave-font-mono)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-testid="btn-toggle-comparison-layout"
            aria-label="Toggle between table and stacked record layout"
          >
            {isStacked ? (
              <>
                <TableIcon size={12} color="var(--mave-dim)" />
                <span>Table View</span>
              </>
            ) : (
              <>
                <StackedIcon size={12} color="var(--mave-dim)" />
                <span>Stacked View</span>
              </>
            )}
          </button>

          {onOpenWorkspace && (
            <button
              onClick={onOpenWorkspace}
              style={{
                background: 'rgba(91, 132, 255, 0.14)',
                border: '1px solid rgba(91, 132, 255, 0.35)',
                borderRadius: '8px',
                color: 'var(--mave-cyan)',
                padding: '4px 12px',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'var(--mave-font-mono)',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              data-testid="btn-open-comparison-workspace"
              aria-label="Open detailed comparison in Workspace"
            >
              <span>Open in Workspace</span>
              <ExpandIcon size={12} color="var(--mave-cyan)" />
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
              fontSize: '13px',
              color: 'var(--mave-dim)',
              lineHeight: 1.45
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
              borderRadius: '12px',
              border: '1px solid var(--mave-line)',
              background: '#0a0c18'
            }}
            data-testid="comparison-table-wrapper"
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: data.density === 'compact' ? '12px' : '13px',
                textAlign: 'left'
              }}
              role="table"
              aria-label={data.title || data.caption || 'Comparison Table'}
              data-testid="comparison-table"
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--mave-line)', background: 'var(--mave-raised)' }}>
                  {data.columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      style={{
                        padding: '10px 14px',
                        color: col.isPrimary ? 'var(--mave-ink)' : 'var(--mave-faint)',
                        fontWeight: col.isPrimary ? 700 : 600,
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--mave-font-mono)',
                        fontSize: '12px',
                        letterSpacing: '0.04em'
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
                      background: row.highlighted ? 'rgba(95, 210, 255, 0.08)' : 'transparent',
                      transition: 'background var(--mave-dur-quick) ease'
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
                            padding: '10px 14px',
                            color: col.isPrimary
                              ? 'var(--mave-ink)'
                              : 'var(--mave-dim)',
                            fontWeight: col.isPrimary ? 600 : 400
                          }}
                          data-testid={`comparison-cell-${row.id}-${col.key}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{formatCellValue(cellVal)}</span>
                            {isFirst && row.badge && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(95, 210, 255, 0.14)',
                                  color: 'var(--mave-cyan)',
                                  fontWeight: 600,
                                  fontFamily: 'var(--mave-font-mono)'
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
                      ? 'rgba(95, 210, 255, 0.06)'
                      : '#0a0c18',
                    border: row.highlighted
                      ? '1px solid rgba(95, 210, 255, 0.35)'
                      : '1px solid var(--mave-line)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
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
                      borderBottom: '1px solid var(--mave-line)',
                      paddingBottom: '6px',
                      marginBottom: '2px'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--mave-ink)', fontSize: '13px' }}>
                      {formatCellValue(primaryVal)}
                    </span>
                    {row.badge && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(95, 210, 255, 0.14)',
                          color: 'var(--mave-cyan)',
                          fontWeight: 600,
                          fontFamily: 'var(--mave-font-mono)'
                        }}
                        data-testid={`stacked-row-badge-${row.id}`}
                      >
                        {row.badge}
                      </span>
                    )}
                  </div>

                  {/* Field values */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px' }}>
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
                          <span style={{ color: 'var(--mave-faint)', fontFamily: 'var(--mave-font-mono)', fontSize: '11px' }}>
                            {col.label}:
                          </span>
                          <span style={{ color: 'var(--mave-dim)', fontWeight: 500 }}>
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

