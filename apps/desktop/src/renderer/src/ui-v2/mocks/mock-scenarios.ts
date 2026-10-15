/**
 * MAVE UI V2 — Pure Synthetic Mock Scenarios for UI Lab
 * Track: U0 Adaptive Surface Foundation
 *
 * All data is strictly synthetic. No real credentials, network, or user personal data.
 */

import type { UiV2Snapshot } from '../types';

export interface MockScenario {
  id: string;
  name: string;
  description: string;
  category: 'presence' | 'conversation' | 'workspace' | 'error';
  snapshot: UiV2Snapshot;
}

export const MOCK_SCENARIOS: MockScenario[] = [
  // 01 Presence Idle
  {
    id: '01_presence_idle',
    name: '01 Presence Idle',
    description: 'Minimal ambient MAVE resting in corner. Controls hidden, breathing orb.',
    category: 'presence',
    snapshot: {
      level: 'presence',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'idle',
        messages: [],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Standby',
        status: 'idle',
        steps: []
      }
    }
  },

  // 02 Presence Listening
  {
    id: '02_presence_listening',
    name: '02 Presence Listening',
    description: 'Voice-reactive state with dynamic acoustic bar excursion.',
    category: 'presence',
    snapshot: {
      level: 'presence',
      presence: {
        state: 'listening',
        audioLevel: 0.65
      },
      conversation: {
        status: 'listening',
        messages: [],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Voice Session',
        status: 'idle',
        steps: []
      }
    }
  },

  // 03 Presence Speaking
  {
    id: '03_presence_speaking',
    name: '03 Presence Speaking',
    description: 'Audio output state reacting to synthesized TTS voice frames.',
    category: 'presence',
    snapshot: {
      level: 'presence',
      presence: {
        state: 'speaking',
        audioLevel: 0.82
      },
      conversation: {
        status: 'result',
        messages: [],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Voice Session',
        status: 'idle',
        steps: []
      }
    }
  },

  // 04 Quick Response
  {
    id: '04_quick_response',
    name: '04 Quick Response',
    description: 'Brief text answer card floating above ambient presence capsule.',
    category: 'presence',
    snapshot: {
      level: 'presence',
      presence: {
        state: 'speaking',
        audioLevel: 0.45,
        quickResponse: {
          text: 'วันนี้อากาศแจ่มใส อุณหภูมิประมาณ 28 องศาเซลเซียสครับ',
          sourceLabel: 'Local Fast Brain • Weather'
        }
      },
      conversation: {
        status: 'result',
        messages: [],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Quick Lookup',
        status: 'completed',
        steps: []
      }
    }
  },

  // 05 Chat Only
  {
    id: '05_chat_only',
    name: '05 Chat Only',
    description: 'Narrow side-docked chat panel for multi-tasking alongside other desktop apps.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'idle',
        semanticRuntimeLabel: 'MAVE • Local Fast Brain',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'ช่วยแปลประโยค "I am looking forward to hearing from you" เป็นภาษาไทยหน่อย'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'แปลว่า "ผมรอคอยที่จะได้รับข่าวจากคุณครับ" หรือในบริบททางการ: "หวังเป็นอย่างยิ่งว่าจะได้รับการติดต่อกลับจากท่าน"'
          }
        ],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Casual Chat',
        status: 'idle',
        steps: []
      }
    }
  },

  // 06 Chat + Video Result
  {
    id: '06_chat_video',
    name: '06 Chat + Video Result',
    description: 'Conversation timeline containing a rich video card preview with thumbnail & timestamp.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'richResult',
        semanticRuntimeLabel: 'MAVE • Media Grounding',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'มีคลิปอธิบายวิธีใช้ React 19 Actions แบบสั้นๆ ไหม'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'พบคลิปสอน React 19 Actions ที่กระชับและเข้าใจง่ายครับ:'
          }
        ],
        cards: [
          {
            id: 'v1',
            type: 'video',
            channel: 'Frontend Masters Digest',
            duration: '08:45',
            title: 'Understanding React 19 Server & Form Actions in 8 Minutes',
            summary: 'Comprehensive walkthrough of useActionState and form submission lifecycle without useEffect.'
          }
        ]
      },
      workspace: {
        type: 'research',
        title: 'Video Search',
        status: 'completed',
        steps: []
      }
    }
  },

  // 07 Chat + Multiple Sources
  {
    id: '07_chat_sources',
    name: '07 Chat + Multiple Sources',
    description: 'Conversation grounded with multiple official source citation cards.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'richResult',
        semanticRuntimeLabel: 'MAVE • Research Grounded',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Node.js 22 LTS มีอะไรเปลี่ยนแปลงบ้าง'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Node.js 22 (Jod) กลายเป็น LTS อย่างเป็นทางการ โดยมีฟีเจอร์เด่นคือ require(ESM) เปิดใช้งานเป็นค่าเริ่มต้น และรองรับ WebSocket client ในตัว:'
          }
        ],
        cards: [
          {
            id: 's1',
            type: 'source',
            domain: 'nodejs.org',
            title: 'Node.js 22 is now LTS',
            url: 'https://nodejs.org/en/blog/release/v22.0.0',
            snippet: 'Node.js 22 is officially entering Long-Term Support. Features V8 12.4, Maglev compiler enabled by default, and built-in WebSocket.',
            authorOrDate: 'Oct 2026'
          },
          {
            id: 's2',
            type: 'source',
            domain: 'github.com/nodejs',
            title: 'Changelog: Node v22.11.0 (LTS)',
            url: 'https://github.com/nodejs/node/releases/tag/v22.11.0',
            snippet: 'Full list of security patches, performance improvements, and API stability guarantees.',
            authorOrDate: 'Verified Source'
          }
        ]
      },
      workspace: {
        type: 'research',
        title: 'Technical Research',
        status: 'completed',
        steps: []
      }
    }
  },

  // 08 Conversation Streaming
  {
    id: '08_conversation_streaming',
    name: '08 Conversation Streaming',
    description: 'Active streaming response with honest observable progress ("Analyzing 4 files…").',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'thinking',
        audioLevel: 0
      },
      conversation: {
        status: 'streaming',
        semanticRuntimeLabel: 'MAVE • Deep Reasoning',
        observableProgressText: 'Analyzing 4 files in packages/core…',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'ช่วยตรวจสอบ race condition ใน surface-window-manager ให้หน่อย'
          }
        ],
        cards: [],
        streamingText: 'กำลังตรวจสอบ display metrics transition logic พบว่าเมื่อมีการถอด monitor ออก displayLockManager จะทำการ…'
      },
      workspace: {
        type: 'project',
        title: 'Code Analysis',
        status: 'running',
        steps: []
      }
    }
  },

  // 09 Workspace Agent Running
  {
    id: '09_workspace_agent_running',
    name: '09 Workspace Agent Running',
    description: 'Multi-column agent workspace decomposing plan steps and tracking target workspace files.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: {
        state: 'thinking',
        audioLevel: 0
      },
      conversation: {
        status: 'idle',
        messages: [],
        cards: []
      },
      workspace: {
        type: 'agent',
        title: 'Monorepo Migration Task',
        status: 'running',
        currentObjective: 'Migrate legacy workflow scripts into modern TypeScript skill schemas',
        steps: [
          { id: 'st1', label: 'Scan existing workflow definitions', status: 'completed' },
          { id: 'st2', label: 'Generate target SKILL.md schemas', status: 'active' },
          { id: 'st3', label: 'Run typecheck and linter validation', status: 'pending' },
          { id: 'st4', label: 'Archive deprecated workflow files', status: 'pending' }
        ],
        files: [
          { path: 'packages/skills/migration.ts', status: 'modified' },
          { path: 'skills/workflow/SKILL.md', status: 'created' }
        ],
        outputSummary: 'Parsed 3 legacy YAML files. Generating 3 structured markdown skill specs with YAML frontmatter.'
      }
    }
  },

  // 10 Workspace Waiting Approval
  {
    id: '10_workspace_waiting_approval',
    name: '10 Workspace Waiting Approval',
    description: 'Workspace paused waiting for human approval on high-risk tool execution (M5 Gate).',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: {
        state: 'thinking',
        audioLevel: 0
      },
      conversation: {
        status: 'idle',
        messages: [],
        cards: []
      },
      workspace: {
        type: 'agent',
        title: 'Git Branch Cleanup',
        status: 'waiting_approval',
        currentObjective: 'Delete stale experimental branches after Milestone 4 closeout',
        steps: [
          { id: 'st1', label: 'List merged git branches', status: 'completed' },
          { id: 'st2', label: 'Request user confirmation for branch deletion', status: 'active' },
          { id: 'st3', label: 'Prune remote tracking references', status: 'pending' }
        ],
        activeApproval: {
          id: 'app-01',
          type: 'approval',
          actionRequested: 'Permanently delete local branch: feat/m4-legacy-tests',
          riskLevel: 'Level 3 — Destructive',
          riskClass: 'destructive',
          command: 'git branch -D feat/m4-legacy-tests',
          directory: 'D:\\project\\MAVE',
          status: 'pending'
        }
      }
    }
  },

  // 11 Language Practice Workspace
  {
    id: '11_language_practice',
    name: '11 Language Practice Workspace',
    description: 'Dedicated language coach experience showing language as an experience, not global branding.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: {
        state: 'listening',
        audioLevel: 0.55
      },
      conversation: {
        status: 'idle',
        messages: [],
        cards: []
      },
      workspace: {
        type: 'language',
        title: 'Language Practice',
        status: 'running',
        currentObjective: 'Workplace Japanese & English Speaking Fluency',
        steps: [
          { id: 'l1', label: 'Warm-up: Casual weekend plans', status: 'completed' },
          { id: 'l2', label: 'Work scenario: Declining a meeting politely', status: 'active' },
          { id: 'l3', label: 'Pronunciation review: intonation and pacing', status: 'pending' }
        ],
        languageContext: {
          targetLanguage: 'English & Japanese',
          mode: 'Professional Fluency',
          naturalPhrasing: 'Instead of "I cannot attend your meeting", say "I am tied up with a deadline, but I would love to catch up over email."',
          vocabulary: [
            { term: 'tied up', meaning: 'ติดงาน / ยุ่งมากไม่สามารถปลีกตัวได้' },
            { term: 'catch up', meaning: 'อัปเดตเรื่องราวหรือพูดคุยกันย้อนหลัง' },
            { term: '恐れ入ります (osoreirimasu)', meaning: 'ขออภัยในความไม่สะดวก (สุภาพระดับธุรกิจ)' }
          ]
        }
      }
    }
  },

  // 12 Error / Offline
  {
    id: '12_error_offline',
    name: '12 Error / Offline',
    description: 'Graceful degradation when local provider or speech service is unreachable.',
    category: 'error',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'error',
        audioLevel: 0
      },
      conversation: {
        status: 'error',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'สรุปไฟล์รายงานนี้ให้หน่อย'
          }
        ],
        cards: [
          {
            id: 'err-01',
            type: 'error',
            title: 'Local Fast Brain Offline',
            errorMessage: 'Cannot connect to local Ollama daemon on http://127.0.0.1:11434. Please verify the service is running.',
            recoverable: true,
            suggestedAction: 'Retry Connection'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Diagnostics',
        status: 'error',
        steps: []
      }
    }
  }
];

