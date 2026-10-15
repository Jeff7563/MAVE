/**
 * MAVE UI V2 — Pure Synthetic Mock Scenarios for UI Lab
 * Tracks: U0 Foundation, U1 Presence Identity, U2 Conversation Surface
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

// ---------------------------------------------------------------------------
// U2 Specific Conversation Scenarios (Prompt Section 35)
// ---------------------------------------------------------------------------

export const U2_CONVERSATION_SCENARIOS: MockScenario[] = [
  // 01 Short Text Conversation
  {
    id: 'u2_01_short_text',
    name: '01 Short Text Conversation',
    description: 'Direct concise textual answer without rich card overhead.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'MAVE คืออะไร'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'MAVE เป็น adaptive desktop assistant ที่ออกแบบมาให้ปรับเปลี่ยนรูปแบบการแสดงผลตามบริบทของการใช้งาน ตั้งแต่ ambient presence ไปจนถึง conversation และ workspace ครับ'
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

  // 02 Multi-turn Voice Conversation
  {
    id: 'u2_02_multiturn_voice',
    name: '02 Multi-turn Voice Conversation',
    description: 'Multi-turn dialogue history preserved cleanly in timeline without visual clutter.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'idle',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'สวัสดี MAVE ตอนนี้กี่โมงแล้ว',
            isTranscript: true
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'ขณะนี้เวลา 10:30 น. ครับ'
          },
          {
            id: 'm3',
            type: 'message',
            role: 'user',
            content: 'แล้วอากาศข้างนอกเป็นยังไงบ้าง',
            isTranscript: true
          },
          {
            id: 'm4',
            type: 'message',
            role: 'assistant',
            content: 'สภาพอากาศตอนนี้แจ่มใส อุณหภูมิประมาณ 28°C เหมาะสำหรับการออกกำลังกายครับ'
          },
          {
            id: 'm5',
            type: 'message',
            role: 'user',
            content: 'แนะนำร้านกาแฟเงียบๆ แถวนี้หน่อย',
            isTranscript: true
          },
          {
            id: 'm6',
            type: 'message',
            role: 'assistant',
            content: 'แนะนำ "Craft & Quiet" ห่างออกไป 400 เมตร มีที่นั่งทำงานและ Wi-Fi ความเร็วสูงครับ'
          }
        ],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Voice Dialogue',
        status: 'idle',
        steps: []
      }
    }
  },

  // 03 Streaming Long Answer
  {
    id: 'u2_03_streaming_long_answer',
    name: '03 Streaming Long Answer',
    description: 'Long-form response actively streaming with in-place token updates and honest progress.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'thinking',
        audioLevel: 0
      },
      conversation: {
        status: 'streaming',
        streamingStatus: 'streaming',
        observableProgressText: 'Generating structured explanation…',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'อธิบายสถาปัตยกรรม Adaptive Surface ของ MAVE อย่างละเอียดหน่อย'
          }
        ],
        cards: [],
        streamingText: 'สถาปัตยกรรม Adaptive Surface ของ MAVE แบ่งออกเป็น 3 ระดับหลัก:\n\n1. Level 1 — Presence Surface: ทำหน้าที่เป็น ambient capsule ขนาดกะทัดรัด แสดงสถานะ idle, listening, thinking และ speaking พร้อม acoustic waveform ที่ตอบสนองต่อเสียงพูด\n\n2. Level 2 — Conversation Surface: แคนวาสสำหรับการสนทนาเมื่อมี visual interaction need รองรับการสตรีมข้อความ การจัดกลุ่มแหล่งอ้างอิง และการแสดงการ์ดข้อมูล\n\n3. Level 3 — Workspace Surface: พื้นที่ทำงานสำหรับ multi-step workflows, file diffs และงานวิจัยที่ต้องใช้การทำงานต่อเนื่อง…'
      },
      workspace: {
        type: 'project',
        title: 'Architecture Overview',
        status: 'running',
        steps: []
      }
    }
  },

  // 04 Answer + One Source (Legitimate vendor citation)
  {
    id: 'u2_04_answer_one_source',
    name: '04 Answer + One Source',
    description: 'Answer grounded with genuine vendor content provenance ("OpenAI Documentation") while technical substrate remains isolated.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'API Structured Outputs ของ OpenAI มีข้อจำกัดอะไรบ้าง'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'ฟีเจอร์ Structured Outputs กำหนดให้ JSON Schema ต้องระบุ additionalProperties: false ในทุก object และฟิลด์ทั้งหมดต้องอยู่ใน required array ครับ:'
          }
        ],
        cards: [
          {
            id: 'src-openai-docs',
            type: 'source',
            domain: 'platform.openai.com',
            title: 'OpenAI Documentation',
            url: 'https://platform.openai.com/docs/guides/structured-outputs',
            snippet: 'Structured Outputs ensures model output strictly matches your supplied JSON schema with 100% adherence.',
            authorOrDate: 'Verified Citation',
            provenance: {
              title: 'OpenAI Documentation',
              sourceType: 'documentation',
              domain: 'platform.openai.com',
              url: 'https://platform.openai.com/docs/guides/structured-outputs',
              snippet: 'Structured Outputs ensures model output strictly matches your supplied JSON schema.'
            }
          }
        ],
        executionSubstrate: {
          providerId: 'openai',
          modelId: 'gpt-4o'
        }
      },
      workspace: {
        type: 'research',
        title: 'API Research',
        status: 'completed',
        steps: []
      }
    }
  },

  // 05 Answer + Multiple Sources
  {
    id: 'u2_05_answer_multiple_sources',
    name: '05 Answer + Multiple Sources',
    description: 'Conversation grounded with multiple official source citation cards in structured hierarchy.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'richResult',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'TypeScript 5.6 มีอะไรใหม่บ้าง'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'TypeScript 5.6 แนะนำการตรวจสอบ Disallowed Nullish and Truthy Checks, Iterator Helper methods, และการปรับปรุงประสิทธิภาพการ build:'
          }
        ],
        cards: [
          {
            id: 's1',
            type: 'source',
            domain: 'devblogs.microsoft.com',
            title: 'Announcing TypeScript 5.6',
            url: 'https://devblogs.microsoft.com/typescript/announcing-typescript-5-6/',
            snippet: 'TypeScript 5.6 is now available with new language features and compiler optimizations.',
            authorOrDate: 'Microsoft DevBlogs'
          },
          {
            id: 's2',
            type: 'source',
            domain: 'github.com',
            title: 'TypeScript 5.6 Release Notes',
            url: 'https://github.com/microsoft/TypeScript/releases/tag/v5.6.2',
            snippet: 'Release notes, breaking changes, and complete API stabilization list.',
            authorOrDate: 'GitHub'
          },
          {
            id: 's3',
            type: 'source',
            domain: 'tc39.es',
            title: 'JavaScript Iterator Helpers Spec',
            url: 'https://tc39.es/proposal-iterator-helpers/',
            snippet: 'ECMAScript proposal for adding functional helper methods to iterators.',
            authorOrDate: 'TC39'
          }
        ]
      },
      workspace: {
        type: 'research',
        title: 'TypeScript Research',
        status: 'completed',
        steps: []
      }
    }
  },

  // 06 Answer + Video
  {
    id: 'u2_06_answer_video',
    name: '06 Answer + Video',
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

  // 07 Translation Conversation
  {
    id: 'u2_07_translation_conversation',
    name: '07 Translation Conversation',
    description: 'Language translation with structured cards and contextual follow-up suggestion chips.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'richResult',
        contextLabel: 'Language Practice',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'แปลประโยค "I am looking forward to hearing from you" เป็นภาษาไทย'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'นี่คือคำแปลที่เหมาะสมทั้งในบริบททั่วไปและแบบเป็นทางการครับ:'
          }
        ],
        cards: [
          {
            id: 't1',
            type: 'translation',
            targetLanguage: 'Thai',
            originalText: 'I am looking forward to hearing from you',
            translatedText: 'ผมรอคอยที่จะได้รับข่าวจากคุณครับ',
            naturalAlternative: 'หวังเป็นอย่างยิ่งว่าจะได้รับการติดต่อกลับจากท่าน',
            grammarNote: 'look forward to ตามด้วย Gerund (V-ing) หรือ Noun เสมอ',
            vocabulary: [
              { term: 'look forward to', meaning: 'ตั้งตารอคอย / หวังเป็นอย่างยิ่ง' },
              { term: 'hearing from', meaning: 'ได้รับการติดต่อหรือข่าวสารจาก' }
            ]
          }
        ],
        followUpSuggestions: ['Explain grammar', 'More natural', 'Practice speaking']
      },
      workspace: {
        type: 'language',
        title: 'Language Coach',
        status: 'idle',
        steps: []
      }
    }
  },

  // 08 Code Answer
  {
    id: 'u2_08_code_answer',
    name: '08 Code Answer',
    description: 'Technical answer with formatted syntax-highlighted code block card.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'richResult',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'เขียน custom hook สำหรับ debounce input ใน React ให้หน่อย'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'นี่คือตัวอย่าง useDebounce hook พร้อม TypeScript types สำหรับ React:'
          }
        ],
        cards: [
          {
            id: 'c1',
            type: 'code',
            language: 'typescript',
            filename: 'useDebounce.ts',
            code: 'import { useState, useEffect } from "react";\n\nexport function useDebounce<T>(value: T, delayMs: number = 300): T {\n  const [debounced, setDebounced] = useState<T>(value);\n  useEffect(() => {\n    const timer = setTimeout(() => setDebounced(value), delayMs);\n    return () => clearTimeout(timer);\n  }, [value, delayMs]);\n  return debounced;\n}'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Code Snippets',
        status: 'completed',
        steps: []
      }
    }
  },

  // 09 Cancelled Streaming Response
  {
    id: 'u2_09_cancelled_streaming',
    name: '09 Cancelled Streaming Response',
    description: 'Response stopped mid-flight by user; preserves accumulated text and displays [Stopped] tag.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'idle',
        streamingStatus: 'cancelled',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'เขียนบทความวิจัยขนาดยาวเกี่ยวกับประวัติศาสตร์คอมพิวเตอร์'
          }
        ],
        cards: [],
        timelineGroups: [
          {
            id: 'group-cancelled',
            userMessage: {
              id: 'm1',
              type: 'message',
              role: 'user',
              content: 'เขียนบทความวิจัยขนาดยาวเกี่ยวกับประวัติศาสตร์คอมพิวเตอร์'
            },
            answerText: 'คอมพิวเตอร์ยุคแรกเริ่มต้นจากแนวคิดของ Charles Babbage ในการสร้าง Analytical Engine ซึ่งเป็นต้นแบบของเครื่องประมวลผลเชิงกล…',
            isCancelled: true,
            streamingStatus: 'cancelled'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Research Draft',
        status: 'idle',
        steps: []
      }
    }
  },

  // 10 Failed Request + Retry
  {
    id: 'u2_10_failed_request_retry',
    name: '10 Failed Request + Retry',
    description: 'Recoverable network or provider failure rendered locally near the failed turn with retry action.',
    category: 'conversation',
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
            content: 'ดึงข้อมูลสรุปจากเซิร์ฟเวอร์วิจัย'
          }
        ],
        cards: [],
        timelineGroups: [
          {
            id: 'group-error',
            userMessage: {
              id: 'm1',
              type: 'message',
              role: 'user',
              content: 'ดึงข้อมูลสรุปจากเซิร์ฟเวอร์วิจัย'
            },
            error: {
              message: 'Cannot connect to upstream service (connection timeout 5000ms).',
              recoverable: true,
              suggestedAction: 'Retry Request',
              technicalDetails: 'ECONNREFUSED 127.0.0.1:11434'
            }
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Network Operations',
        status: 'error',
        steps: []
      }
    }
  },

  // 11 User Scrolled Up While Streaming
  {
    id: 'u2_11_scrolled_up_streaming',
    name: '11 User Scrolled Up While Streaming',
    description: 'User scrolled upward to inspect prior context during active streaming; "New response ↓" pill appears without forcibly yanking viewport.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'thinking',
        audioLevel: 0
      },
      conversation: {
        status: 'streaming',
        streamingStatus: 'streaming',
        isScrolledUp: true,
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'ตรวจสอบ memory leak ในระบบ'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'เริ่มต้นการตรวจสอบ memory profile ย้อนหลัง 24 ชั่วโมง…'
          },
          {
            id: 'm3',
            type: 'message',
            role: 'user',
            content: 'พบจุดผิดปกติในโมดูลไหนบ้าง'
          }
        ],
        cards: [],
        streamingText: 'กำลังวิเคราะห์ log ย้อนหลังพบว่า memory allocation มีการเติบโตอย่างต่อเนื่องตั้งแต่ turn ที่ 3 ใน surface-window-manager…'
      },
      workspace: {
        type: 'project',
        title: 'Diagnostic Inspection',
        status: 'running',
        steps: []
      }
    }
  },

  // 12 Presence → Conversation Continuity
  {
    id: 'u2_12_presence_conversation_continuity',
    name: '12 Presence → Conversation Continuity',
    description: 'Demonstrates deterministic handoff: quick response started in Presence expands into Conversation with identical request ID and accumulated text.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'speaking',
        audioLevel: 0.5,
        quickResponse: {
          text: 'การประชุม Milestone 4 ได้ข้อสรุปว่า surface lifecycle ทั้ง 3 ระดับมีความพร้อมสำหรับการทดสอบ UI V2…',
          requestId: 'req-cont-12',
          streaming: true
        }
      },
      conversation: {
        status: 'streaming',
        activeRequestId: 'req-cont-12',
        streamingStatus: 'streaming',
        streamingText: 'การประชุม Milestone 4 ได้ข้อสรุปว่า surface lifecycle ทั้ง 3 ระดับมีความพร้อมสำหรับการทดสอบ UI V2…',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'สรุปผลการประชุม Milestone 4'
          }
        ],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Milestone 4 Closeout',
        status: 'running',
        steps: []
      }
    }
  },

  // 13 Conversation → Presence Collapse
  {
    id: 'u2_13_conversation_presence_collapse',
    name: '13 Conversation → Presence Collapse',
    description: 'Conversation collapsed back to Presence surface; context preserved, quick response shows active snippet.',
    category: 'presence',
    snapshot: {
      level: 'presence',
      presence: {
        state: 'speaking',
        audioLevel: 0.42,
        quickResponse: {
          text: 'ผลการประชุมสรุปว่าสถาปัตยกรรมพร้อมแล้วครับ',
          requestId: 'req-cont-12',
          canExpand: true
        }
      },
      conversation: {
        status: 'idle',
        activeRequestId: 'req-cont-12',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'สรุปผลการประชุม Milestone 4'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'ผลการประชุมสรุปว่าสถาปัตยกรรมพร้อมแล้วครับ'
          }
        ],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Standby',
        status: 'completed',
        steps: []
      }
    }
  },

  // 14 Conversation Eligible for Workspace Escalation
  {
    id: 'u2_14_workspace_escalation_eligible',
    name: '14 Conversation Eligible for Workspace Escalation',
    description: 'Complex multi-step task flagged for Workspace escalation based on interaction complexity, not token length.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: {
        state: 'idle',
        audioLevel: 0
      },
      conversation: {
        status: 'result',
        workspaceEligible: true,
        workspaceReason: 'Task involves multi-file refactoring and pending tool execution.',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'ช่วย refactor ระบบ intelligence routing และสร้าง workflow ทดสอบ 5 ไฟล์'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'ตรวจพบงานที่ต้องแก้ไขหลายไฟล์ (multi-step workflow) และต้องการการอนุมัติการทำงานเครื่องมือ (Tool Execution Approval):'
          }
        ],
        cards: [
          {
            id: 'task-refactor',
            type: 'task',
            taskName: 'Intelligence Routing Refactor',
            status: 'running',
            currentStep: 'Step 2/5: Update provider registry',
            progressPercent: 40
          },
          {
            id: 'app-write-files',
            type: 'approval',
            actionRequested: 'Write 5 new TypeScript test fixtures',
            riskLevel: 'Level 1 — Safe Local',
            riskClass: 'safe_local',
            directory: 'packages/core/src/intelligence',
            status: 'pending'
          }
        ]
      },
      workspace: {
        type: 'agent',
        title: 'Intelligence Refactor',
        status: 'running',
        steps: [
          { id: 's1', label: 'Scan existing router contracts', status: 'completed' },
          { id: 's2', label: 'Update provider registry', status: 'active' },
          { id: 's3', label: 'Generate test fixtures', status: 'pending' }
        ]
      }
    }
  }
];

// ---------------------------------------------------------------------------
// U0 Baseline Scenarios (Preserved for existing test suites & harness)
// ---------------------------------------------------------------------------

export const BASELINE_SCENARIOS: MockScenario[] = [
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

// ---------------------------------------------------------------------------
// U3 Specific Rich Card Scenarios (Prompt Section 38)
// ---------------------------------------------------------------------------

export const U3_RICH_CARD_SCENARIOS: MockScenario[] = [
  // U3-01 Single Source
  {
    id: 'u3_01_single_source',
    name: 'U3-01 Single Source',
    description: 'Answer supported by a single verified source citation with provenance.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'What is the React 19 Compiler?'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'The React Compiler automatically memoizes components and hooks to optimize rendering performance without requiring manual useMemo or useCallback.'
          }
        ],
        cards: [
          {
            id: 'src-react-1',
            type: 'source',
            citationIndex: 1,
            title: 'React Compiler Overview',
            domain: 'react.dev',
            url: 'https://react.dev/learn/react-compiler',
            snippet: 'React Compiler is an optimizing compiler that deeply understands JavaScript and the Rules of React to safely memoize values.',
            authorOrDate: 'React Team · 2024',
            provenance: {
              id: 'prov-1',
              title: 'React Documentation',
              sourceType: 'web',
              domain: 'react.dev',
              url: 'https://react.dev/learn/react-compiler'
            }
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'React Research',
        status: 'idle',
        steps: []
      }
    }
  },

  // U3-02 Source Group
  {
    id: 'u3_02_source_group',
    name: 'U3-02 Source Group',
    description: 'Composite card grouping multiple citations (OpenAI, Microsoft, GitHub, Local).',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Compare subscription runtime architectures across OpenAI, Microsoft, and local models.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Modern agent architectures favor flat monthly subscription CLI runtimes over metered pay-per-token APIs for sustained reasoning tasks, backed by local fast brains for low-latency ambient operations.'
          }
        ],
        cards: [
          {
            id: 'src-group-1',
            type: 'source_group',
            sources: [
              {
                id: 'sg-1',
                type: 'source',
                citationIndex: 1,
                title: 'OpenAI Platform Documentation',
                domain: 'platform.openai.com',
                url: 'https://platform.openai.com/docs',
                snippet: 'API specifications and streaming token architectures for OpenAI language models.',
                authorOrDate: 'OpenAI Docs · 2024'
              },
              {
                id: 'sg-2',
                type: 'source',
                citationIndex: 2,
                title: 'Microsoft Learn: CLI Agent Patterns',
                domain: 'learn.microsoft.com',
                url: 'https://learn.microsoft.com/ai/agents',
                snippet: 'Subscription runtime patterns and isolated process execution models.',
                authorOrDate: 'Microsoft · Oct 2024'
              },
              {
                id: 'sg-3',
                type: 'source',
                citationIndex: 3,
                title: 'MAVE GitHub Architecture Discussion #42',
                domain: 'github.com/mave-ai/desktop',
                url: 'https://github.com/mave-ai/desktop/issues/42',
                snippet: 'Analysis of billing policies and subscription-first routing in desktop AI.',
                authorOrDate: 'MAVE Core · 2026'
              },
              {
                id: 'sg-4',
                type: 'source',
                citationIndex: 4,
                title: 'Local Knowledge Base: Runtime Audit',
                domain: 'local:docs/architecture/spec.md',
                url: 'local:///docs/architecture/spec.md',
                snippet: 'Internal specification locking the Subscription-First Intelligence Foundation.',
                authorOrDate: 'Local File · Current'
              }
            ]
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Architecture Audit',
        status: 'idle',
        steps: []
      }
    }
  },

  // U3-03 Video Result
  {
    id: 'u3_03_video_result',
    name: 'U3-03 Video Result',
    description: 'Instructional video recommendation card with synthetic preview and duration.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Can you recommend a tutorial on TypeScript type predicates?'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Here is an excellent technical walkthrough on automatic type narrowing and inferred predicate functions in modern TypeScript:'
          }
        ],
        cards: [
          {
            id: 'vid-1',
            type: 'video',
            title: 'Mastering TypeScript 5.5 Inferred Type Predicates',
            channel: 'TechCraft Engineering',
            duration: '14:20',
            summary: 'Comprehensive tutorial on how TypeScript 5.5 automatically narrows union types from filter functions without manual type predicates.',
            url: 'https://youtube.com/watch?v=mock_ts_predicates'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Learning',
        status: 'idle',
        steps: []
      }
    }
  },

  // U3-04 Translation Compact
  {
    id: 'u3_04_translation_compact',
    name: 'U3-04 Translation Compact',
    description: 'Compact density translation card focusing strictly on natural phrasing.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Translate "Je vous en prie" to English'
          }
        ],
        cards: [
          {
            id: 'trans-compact-1',
            type: 'translation',
            originalText: 'Je vous en prie',
            translatedText: 'You are welcome',
            targetLanguage: 'English',
            pronunciation: 'zhuh voo zahn pree',
            density: 'compact'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Quick Translation',
        status: 'idle',
        steps: []
      }
    }
  },

  // U3-05 Translation Expanded
  {
    id: 'u3_05_translation_expanded',
    name: 'U3-05 Translation Expanded',
    description: 'Expanded density translation card with pronunciation, grammar note, and vocabulary.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Translate and explain: "Es gibt keinen Zweifel daran"'
          }
        ],
        cards: [
          {
            id: 'trans-expanded-1',
            type: 'translation',
            originalText: 'Es gibt keinen Zweifel daran',
            translatedText: 'There is no doubt about that',
            targetLanguage: 'German',
            naturalAlternative: 'Das steht völlig außer Frage',
            pronunciation: 'es gipt KY-nən TSY-fəl DAH-rahn',
            grammarNote: '“Es gibt” takes an accusative object (“keinen Zweifel”). “Daran” is a pronominal adverb connecting to the ensuing clause.',
            vocabulary: [
              { term: 'Zweifel', meaning: 'doubt (masculine)' },
              { term: 'daran', meaning: 'about it / in that' },
              { term: 'außer Frage', meaning: 'out of the question / beyond doubt' }
            ],
            density: 'expanded'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'German Practice',
        status: 'idle',
        steps: []
      }
    }
  },

  // U3-06 Code Result
  {
    id: 'u3_06_code_result',
    name: 'U3-06 Code Result',
    description: 'Syntax-highlighted code card with line numbers and safe clipboard copy action.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Write a TypeScript memoize function.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Here is an in-memory memoization utility with strong generic typing:'
          }
        ],
        cards: [
          {
            id: 'code-1',
            type: 'code',
            language: 'typescript',
            filename: 'memoize.ts',
            lineNumbers: true,
            explanation: 'Pure memoization wrapper supporting single-argument generic functions.',
            code: `export function memoize<T, R>(fn: (arg: T) => R): (arg: T) => R {
  const cache = new Map<T, R>();
  return (arg: T): R => {
    if (cache.has(arg)) {
      return cache.get(arg)!;
    }
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}`
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Code Assistance',
        status: 'idle',
        steps: []
      }
    }
  },

  // U3-07 File + Diff
  {
    id: 'u3_07_file_diff',
    name: 'U3-07 File + Diff',
    description: 'Coordinated FileCard and DiffCard showing file changes with additions/deletions.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Update the billing policy in runtime.ts to prioritize subscriptions.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'I have updated the default runtime strategy in `runtime.ts` to enforce subscription-first execution:'
          }
        ],
        cards: [
          {
            id: 'file-diff-file-1',
            type: 'file',
            path: 'src/config/runtime.ts',
            fileType: 'typescript',
            linesModified: 10,
            previewSnippet: 'export const DEFAULT_RUNTIME = "subscription";'
          },
          {
            id: 'file-diff-diff-1',
            type: 'diff',
            filename: 'runtime.ts',
            path: 'src/config/runtime.ts',
            additions: 8,
            deletions: 2,
            compactPreview: [
              '- export const DEFAULT_PROVIDER = "openai_api";',
              '+ export const DEFAULT_PROVIDER = "subscription_runtime";',
              '+ export const FALLBACK_PROVIDER = "local_fast_brain";'
            ],
            lines: [
              { type: 'context', text: 'import { ProviderPolicy } from "./types";', oldLineNumber: 1, newLineNumber: 1 },
              { type: 'context', text: '', oldLineNumber: 2, newLineNumber: 2 },
              { type: 'remove', text: 'export const DEFAULT_PROVIDER = "openai_api";', oldLineNumber: 3 },
              { type: 'remove', text: 'export const ALLOW_PAID_API = true;', oldLineNumber: 4 },
              { type: 'add', text: 'export const DEFAULT_PROVIDER = "subscription_runtime";', newLineNumber: 3 },
              { type: 'add', text: 'export const FALLBACK_PROVIDER = "local_fast_brain";', newLineNumber: 4 },
              { type: 'add', text: 'export const ALLOW_PAID_API = false; // Default-deny', newLineNumber: 5 },
              { type: 'context', text: '', oldLineNumber: 5, newLineNumber: 6 },
              { type: 'context', text: 'export function getActivePolicy(): ProviderPolicy {', oldLineNumber: 6, newLineNumber: 7 }
            ]
          }
        ]
      },
      workspace: {
        type: 'diff_review',
        title: 'Runtime Config',
        status: 'idle',
        targetFiles: [{ path: 'src/config/runtime.ts', status: 'modified' }],
        diffArtifacts: [
          {
            filePath: 'src/config/runtime.ts',
            additions: 8,
            deletions: 2,
            diffLines: [
              { type: 'context', text: 'import { ProviderPolicy } from "./types";', oldLineNumber: 1, newLineNumber: 1 },
              { type: 'context', text: '', oldLineNumber: 2, newLineNumber: 2 },
              { type: 'deletion', text: 'export const DEFAULT_PROVIDER = "openai_api";', oldLineNumber: 3 },
              { type: 'deletion', text: 'export const ALLOW_PAID_API = true;', oldLineNumber: 4 },
              { type: 'addition', text: 'export const DEFAULT_PROVIDER = "subscription_runtime";', newLineNumber: 3 },
              { type: 'addition', text: 'export const FALLBACK_PROVIDER = "local_fast_brain";', newLineNumber: 4 },
              { type: 'addition', text: 'export const ALLOW_PAID_API = false; // Default-deny', newLineNumber: 5 },
              { type: 'context', text: '', oldLineNumber: 5, newLineNumber: 6 },
              { type: 'context', text: 'export function getActivePolicy(): ProviderPolicy {', oldLineNumber: 6, newLineNumber: 7 }
            ]
          }
        ],
        steps: []
      }
    }
  },

  // U3-08 Small Comparison
  {
    id: 'u3_08_small_comparison',
    name: 'U3-08 Small Comparison',
    description: 'Semantic comparison table presenting subscription runtime models on desktop.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Compare the different intelligence execution lanes in MAVE.'
          }
        ],
        cards: [
          {
            id: 'comp-table-1',
            type: 'comparison',
            title: 'MAVE Intelligence Substrate Comparison',
            caption: 'Evaluating subscription runtimes versus local hardware and paid APIs.',
            columns: [
              { key: 'runtime', label: 'Runtime', isPrimary: true },
              { key: 'type', label: 'Category' },
              { key: 'quota', label: 'Billing Model' },
              { key: 'cost', label: 'Incremental Cost' }
            ],
            rows: [
              {
                id: 'codex',
                badge: 'Primary',
                highlighted: true,
                values: {
                  runtime: 'Codex CLI',
                  type: 'Subscription',
                  quota: 'Flat Monthly',
                  cost: '$0.00 / token'
                }
              },
              {
                id: 'claude',
                badge: 'Secondary',
                values: {
                  runtime: 'Claude Code',
                  type: 'Subscription',
                  quota: 'Flat Monthly',
                  cost: '$0.00 / token'
                }
              },
              {
                id: 'ollama',
                values: {
                  runtime: 'Ollama Fast Brain',
                  type: 'Local Hardware',
                  quota: 'Infinite',
                  cost: '$0.00'
                }
              },
              {
                id: 'openai',
                values: {
                  runtime: 'OpenAI Direct API',
                  type: 'Paid API',
                  quota: 'Token Metered',
                  cost: 'Pay-per-token (Deny default)'
                }
              }
            ]
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Strategy',
        status: 'idle',
        steps: []
      }
    }
  },

  // U3-09 Responsive Comparison Narrow
  {
    id: 'u3_09_responsive_comparison_narrow',
    name: 'U3-09 Responsive Comparison Narrow',
    description: 'Comparison card automatically transformed into stacked key-value records for narrow viewports.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Show intelligence substrate comparison in narrow layout.'
          }
        ],
        cards: [
          {
            id: 'comp-stacked-1',
            type: 'comparison',
            title: 'Substrate Comparison (Stacked)',
            responsiveStack: true,
            density: 'compact',
            columns: [
              { key: 'runtime', label: 'Runtime', isPrimary: true },
              { key: 'type', label: 'Category' },
              { key: 'quota', label: 'Billing Model' },
              { key: 'cost', label: 'Incremental Cost' }
            ],
            rows: [
              {
                id: 'codex',
                badge: 'Primary',
                highlighted: true,
                values: {
                  runtime: 'Codex CLI',
                  type: 'Subscription',
                  quota: 'Flat Monthly',
                  cost: '$0.00 / token'
                }
              },
              {
                id: 'claude',
                badge: 'Secondary',
                values: {
                  runtime: 'Claude Code',
                  type: 'Subscription',
                  quota: 'Flat Monthly',
                  cost: '$0.00 / token'
                }
              },
              {
                id: 'ollama',
                values: {
                  runtime: 'Ollama Fast Brain',
                  type: 'Local Hardware',
                  quota: 'Infinite',
                  cost: '$0.00'
                }
              }
            ]
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Strategy',
        status: 'idle',
        steps: []
      }
    }
  },

  // U3-10 Determinate Task Progress
  {
    id: 'u3_10_determinate_task_progress',
    name: 'U3-10 Determinate Task Progress',
    description: 'Progress card with bounded step counts and exact percentage (Progress Truthfulness).',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'thinking', audioLevel: 0.2 },
      conversation: {
        status: 'thinking',
        observableProgressText: 'Indexing repository codebase (Step 3/5)…',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Index this project for semantic search.'
          }
        ],
        cards: [
          {
            id: 'prog-determinate-1',
            type: 'progress',
            label: 'Codebase Symbol Indexing',
            determinate: true,
            completedSteps: 3,
            totalSteps: 5,
            percent: 60,
            currentStep: 'Extracting TypeScript AST definitions from /packages/core'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Index Task',
        status: 'running',
        steps: []
      }
    }
  },

  // U3-11 Indeterminate Task Activity
  {
    id: 'u3_11_indeterminate_task_activity',
    name: 'U3-11 Indeterminate Task Activity',
    description: 'Progress card for ongoing work without fabricated percentage numbers (Progress Truthfulness).',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'thinking', audioLevel: 0.1 },
      conversation: {
        status: 'thinking',
        observableProgressText: 'Running integration test matrix…',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Run full verification suite.'
          }
        ],
        cards: [
          {
            id: 'prog-indeterminate-1',
            type: 'progress',
            label: 'Integration Test Matrix',
            determinate: false,
            currentStep: 'Executing suite 4: desktop-e2e-contracts',
            statusMessage: 'Awaiting async browser process completion…'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Test Matrix',
        status: 'running',
        steps: []
      }
    }
  },

  // U3-12 Approval Mock
  {
    id: 'u3_12_approval_mock',
    name: 'U3-12 Approval Mock',
    description: 'Action approval card in UI prototype mode (synthetic callbacks only, zero system execution).',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Clean up disk space by purging node_modules cache.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'I have prepared the cleanup action. Because this permanently removes cached directories, your confirmation is required:'
          }
        ],
        cards: [
          {
            id: 'appr-mock-1',
            type: 'approval',
            actionRequested: 'Purge cache directory to reclaim 3.8 GB storage space.',
            riskLevel: 'Level 3 — Destructive',
            riskClass: 'destructive',
            command: 'rm -rf ./node_modules/.cache',
            directory: 'D:\\project\\MAVE',
            status: 'pending',
            riskExplanation: 'Permanent deletion of cached artifacts on local filesystem.'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Maintenance',
        status: 'idle',
        steps: []
      }
    }
  },

  // U3-13 Error + Retry
  {
    id: 'u3_13_error_retry',
    name: 'U3-13 Error + Retry',
    description: 'Human-readable error card with collapsible technical details and retry action.',
    category: 'error',
    snapshot: {
      level: 'conversation',
      presence: { state: 'error', audioLevel: 0 },
      conversation: {
        status: 'error',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Summarize the latest meeting transcript.'
          }
        ],
        cards: [
          {
            id: 'err-card-1',
            type: 'error',
            title: 'Local Fast Brain Offline',
            errorMessage: 'Cannot connect to local Ollama daemon on http://127.0.0.1:11434. Please verify the service is running.',
            recoverable: true,
            suggestedAction: 'Retry Connection',
            technicalDetails: 'ECONNREFUSED 127.0.0.1:11434 at TCPConnectWrap.afterConnect [as oncomplete]'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Error Diagnostic',
        status: 'error',
        steps: []
      }
    }
  },

  // U3-14 Mixed Technical Response
  {
    id: 'u3_14_mixed_technical_response',
    name: 'U3-14 Mixed Technical Response',
    description: 'Composite response combining answer text, CodeCard, DiffCard, and Source citations.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'How do we fix the race condition in audio normalizer?'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'We need to decouple instantaneous normalization gain from the temporal exponential smoothing filter. Here is the corrected implementation and diff:'
          }
        ],
        cards: [
          {
            id: 'mixed-code-1',
            type: 'code',
            language: 'typescript',
            filename: 'presence-rules.ts',
            lineNumbers: true,
            code: `export function normalizeAudioRms(rms: number, peakHistory: number[]): number {
  const peak = Math.max(0.01, ...peakHistory);
  return Math.min(1.0, rms / peak);
}`
          },
          {
            id: 'mixed-diff-1',
            type: 'diff',
            filename: 'presence-rules.ts',
            path: 'src/presence/presence-rules.ts',
            additions: 3,
            deletions: 1,
            compactPreview: [
              '- const gain = rms * 2.5;',
              '+ const peak = Math.max(0.01, ...peakHistory);',
              '+ return Math.min(1.0, rms / peak);'
            ]
          },
          {
            id: 'mixed-src-1',
            type: 'source',
            citationIndex: 1,
            title: 'Web Audio API: DynamicsCompressorNode Specification',
            domain: 'developer.mozilla.org',
            url: 'https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode',
            snippet: 'Dynamic range compression principles for multi-frame digital audio RMS calculations.'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Audio Pipeline',
        status: 'idle',
        steps: []
      }
    }
  },

  // U3-15 Rich Response Narrow Width
  {
    id: 'u3_15_rich_response_narrow_width',
    name: 'U3-15 Rich Response Narrow Width',
    description: 'Rich card set verified inside a 360px viewport preset without horizontal overflow.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Status update on today’s vocabulary and background indexing.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Here is your daily vocabulary card along with the active background task status:'
          }
        ],
        cards: [
          {
            id: 'narrow-trans-1',
            type: 'translation',
            originalText: 'Bonjour le monde',
            translatedText: 'Hello world',
            targetLanguage: 'French',
            pronunciation: 'bohn-zhoor luh mohnd',
            density: 'compact'
          },
          {
            id: 'narrow-comp-1',
            type: 'comparison',
            title: 'Quick Metrics',
            responsiveStack: true,
            density: 'compact',
            columns: [
              { key: 'metric', label: 'Metric', isPrimary: true },
              { key: 'val', label: 'Value' }
            ],
            rows: [
              { id: '1', values: { metric: 'Cache Hits', val: '98.4%' } },
              { id: '2', values: { metric: 'Latency', val: '42ms' } }
            ]
          },
          {
            id: 'narrow-prog-1',
            type: 'progress',
            label: 'Background Memory Consolidation',
            determinate: false,
            density: 'compact',
            currentStep: 'Re-indexing episodic entities…'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Daily Review',
        status: 'idle',
        steps: []
      }
    }
  }
];

// ---------------------------------------------------------------------------
// U4 Specific Chat-Only / Sidecar Scenarios (Prompt Section 37)
// ---------------------------------------------------------------------------

export const U4_CHAT_ONLY_SCENARIOS: MockScenario[] = [
  // U4-01 Empty Sidecar
  {
    id: 'u4_01_empty_sidecar',
    name: 'U4-01 Empty Sidecar',
    description: 'Minimal empty sidecar companion showing greeting and quick-suggestion chips without visual clutter.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'idle',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        isPinned: false,
        messages: [],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Sidecar Companion',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-02 Short Conversation
  {
    id: 'u4_02_short_conversation',
    name: 'U4-02 Short Conversation',
    description: 'Direct concise answer rendered in compact sidecar presentation mode alongside active user work.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'What is the syntax for Array.prototype.flatMap in TypeScript?'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'In TypeScript/JavaScript, `arr.flatMap(callback)` maps each element using a mapping function, then flattens the result into a new array by 1 level: `[1, 2].flatMap(x => [x, x * 2]) // [1, 2, 2, 4]`.'
          }
        ],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'TypeScript Helpers',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-03 Streaming Conversation
  {
    id: 'u4_03_streaming_conversation',
    name: 'U4-03 Streaming Conversation',
    description: 'Active streaming response in narrow sidecar showing subtle pulse without token-by-token visual jitter.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'thinking', audioLevel: 0 },
      conversation: {
        status: 'streaming',
        streamingStatus: 'streaming',
        activeRequestId: 'req-u4-stream-01',
        streamingText: 'useMemo caches the result of a computation, while useCallback caches the function definition itself between renders.',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Explain the difference between useMemo and useCallback.'
          }
        ],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'React Reference',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-04 Video Result
  {
    id: 'u4_04_video_result',
    name: 'U4-04 Video Result',
    description: 'Compact video tutorial card with thumbnail, duration badge, and timestamp links fitting sidecar width.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Find a quick video on React 19 Actions'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Here is a 4-minute overview of React 19 Actions and useActionState:'
          }
        ],
        cards: [
          {
            id: 'card-vid-04',
            type: 'video',
            title: 'React 19 Actions in 4 Minutes',
            channel: 'React Core Team',
            duration: '4:15',
            url: 'https://youtube.com/watch?v=synthetic_demo_actions',
            density: 'compact',
            summary: 'Concise walkthrough of React 19 form actions and optimistic UI mutations.'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'React 19 Research',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-05 Source Group
  {
    id: 'u4_05_source_group',
    name: 'U4-05 Source Group',
    description: 'Grouped external citations collapsed cleanly in sidecar mode without horizontal clipping.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Where is the documentation for CSS Subgrid?'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'CSS Subgrid is part of CSS Grid Layout Module Level 2. Here are the authoritative references:'
          }
        ],
        cards: [
          {
            id: 'src-1',
            type: 'source',
            title: 'CSS Grid Layout Module Level 2: Subgrid',
            domain: 'w3.org',
            url: 'https://www.w3.org/TR/css-grid-2/#subgrid',
            snippet: 'Subgrid feature allows a grid item with its own grid context to align with the parent grid tracks.',
            density: 'compact'
          },
          {
            id: 'src-2',
            type: 'source',
            title: 'MDN Web Docs: CSS Subgrid',
            domain: 'developer.mozilla.org',
            url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid',
            snippet: 'Practical usage, browser compatibility tables, and examples of subgrid nesting.',
            density: 'compact'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'CSS Specs',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-06 Translation Result
  {
    id: 'u4_06_translation_result',
    name: 'U4-06 Translation Result',
    description: 'Bilingual translation card with phonetic guide and pronunciation button in compact sidecar layout.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Translate "Have a productive day" to Japanese'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Here is the Japanese translation:'
          }
        ],
        cards: [
          {
            id: 'card-trans-06',
            type: 'translation',
            originalText: 'Have a productive day',
            translatedText: '実りある一日をお過ごしください',
            targetLanguage: 'Japanese',
            pronunciation: 'Minori aru ichinichi o osugoshi kudasai',
            density: 'compact'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Language Helper',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-07 Code Result
  {
    id: 'u4_07_code_result',
    name: 'U4-07 Code Result',
    description: 'Syntax-highlighted code block with language indicator and copy action formatted for narrow column.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Write a helper to debounce function calls.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Here is a TypeScript debounce implementation:'
          }
        ],
        cards: [
          {
            id: 'card-code-07',
            type: 'code',
            language: 'typescript',
            filename: 'debounce.ts',
            density: 'compact',
            code: 'export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 300) {\n  let timer: NodeJS.Timeout;\n  return (...args: Parameters<T>) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  };\n}'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Utilities',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-08 Compact Diff
  {
    id: 'u4_08_compact_diff',
    name: 'U4-08 Compact Diff',
    description: 'Small focused inline unified diff (<40 modifications) inspectable directly within sidecar companion.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Show the change to fix the timeout bug.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Here is the unified patch:'
          }
        ],
        cards: [
          {
            id: 'card-diff-08',
            type: 'diff',
            filename: 'src/network/client.ts',
            density: 'compact',
            additions: 2,
            deletions: 1,
            compactPreview: [
              '@@ -24,3 +24,4 @@',
              ' const options = {',
              '-  timeout: 5000',
              '+  timeout: 15000,',
              '+  keepAlive: true',
              ' };'
            ],
            lines: [
              { type: 'context', text: 'const options = {', oldLineNumber: 24, newLineNumber: 24 },
              { type: 'remove', text: '  timeout: 5000', oldLineNumber: 25 },
              { type: 'add', text: '  timeout: 15000,', newLineNumber: 25 },
              { type: 'add', text: '  keepAlive: true', newLineNumber: 26 },
              { type: 'context', text: '};', oldLineNumber: 26, newLineNumber: 27 }
            ]
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Bugfix',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-09 Error + Retry
  {
    id: 'u4_09_error_retry',
    name: 'U4-09 Error + Retry',
    description: 'Non-destructive inline error state with retry action button in sidecar presentation mode.',
    category: 'error',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'error',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        activeRequestId: 'req-err-09',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Analyze the active project branch.'
          }
        ],
        cards: [
          {
            id: 'card-err-09',
            type: 'error',
            title: 'Analysis Unavailable',
            errorMessage: 'Temporary connection timeout while querying branch analysis.',
            suggestedAction: 'Please retry or verify local repository status.',
            recoverable: true,
            density: 'compact'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Project Analysis',
        status: 'error',
        steps: []
      }
    }
  },

  // U4-10 Office Mode
  {
    id: 'u4_10_office_mode',
    name: 'U4-10 Office Mode',
    description: 'Sidecar running under Office Mode: voice TTS muted, subtle text cursor, and discreet presence ring.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'speaking', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Review meeting agenda for quarterly review'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Agenda summarized quietly (Office Mode active, TTS suppressed):\n1. Architecture review\n2. Milestone 5 schedule\n3. Budget review'
          }
        ],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Meeting Notes',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-11 User Scrolled Up
  {
    id: 'u4_11_user_scrolled_up',
    name: 'U4-11 User Scrolled Up',
    description: 'User reading earlier turn in sidecar while new response completes: auto-scroll locks with "Scroll to latest" button.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        isScrolledUp: true,
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'What is step 1 of the migration plan?' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Step 1 is standardizing all presentation layer mode contracts.' },
          { id: 'm3', type: 'message', role: 'user', content: 'And step 2?' },
          { id: 'm4', type: 'message', role: 'assistant', content: 'Step 2 is verifying that visual dismiss does not cancel the background stream.' },
          { id: 'm5', type: 'message', role: 'user', content: 'And step 3?' },
          { id: 'm6', type: 'message', role: 'assistant', content: 'Step 3 is completing the test suite with zero regression.' }
        ],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Migration Steps',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-12 Conversation → Sidecar Continuity
  {
    id: 'u4_12_conversation_to_sidecar',
    name: 'U4-12 Conversation → Sidecar Continuity',
    description: 'Seamless mode transition from Floating Conversation to Sidecar: exact same session and messages preserved.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Let us prepare the release notes for UI V2 U4.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Preserving full conversation context across floating and sidecar layout transitions.'
          }
        ],
        cards: [
          {
            id: 'card-task-12',
            type: 'task',
            taskName: 'Sidecar Presentation Contract',
            status: 'completed',
            density: 'compact'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Release Notes',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-13 Sidecar → Conversation Continuity
  {
    id: 'u4_13_sidecar_to_conversation',
    name: 'U4-13 Sidecar → Conversation Continuity',
    description: 'Expanding from narrow Sidecar back to Floating Conversation expands canvas width while preserving all state.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'floating',
      sidecarPlacement: 'floating',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'floating',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Expand conversation to see detailed comparison.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Floating conversation surface active. All session history and card data retained.'
          }
        ],
        cards: [
          {
            id: 'card-comp-13',
            type: 'comparison',
            title: 'Surface Level vs Presentation Mode',
            columns: [
              { key: 'property', label: 'Dimension', isPrimary: true },
              { key: 'level', label: 'Surface Level' },
              { key: 'mode', label: 'Presentation Mode' }
            ],
            rows: [
              { id: 'r1', values: { property: 'Meaning', level: 'Information complexity', mode: 'Physical window layout' } },
              { id: 'r2', values: { property: 'Values', level: 'presence | conversation | workspace', mode: 'ambient | floating | sidecar | full' } }
            ]
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Architecture Overview',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-14 Sidecar → Presence Minimize
  {
    id: 'u4_14_sidecar_to_presence',
    name: 'U4-14 Sidecar → Presence Minimize',
    description: 'Minimizing sidecar to Presence surface retains full multi-turn conversation in memory without reset.',
    category: 'presence',
    snapshot: {
      level: 'presence',
      presentationMode: 'ambient',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Keep this context handy while I switch to editing.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Minimized to Presence capsule. Your conversation context remains active and ready.'
          }
        ],
        cards: []
      },
      workspace: {
        type: 'project',
        title: 'Standby Context',
        status: 'idle',
        steps: []
      }
    }
  },

  // U4-15 Workspace Eligible Result
  {
    id: 'u4_15_workspace_eligible',
    name: 'U4-15 Workspace Eligible Result',
    description: 'Complex multi-step task result offering generic Workspace handoff banner without taking over screen.',
    category: 'workspace',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        workspaceEligible: true,
        workspaceReason: 'Complex diff across 12 files requires sustained structured review.',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Refactor the desktop multi-window manager across 12 files.'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'I have analyzed the architecture changes. Since this spans 12 files and requires structured review, you can open it in Workspace when you are ready.'
          }
        ],
        cards: [
          {
            id: 'card-task-15',
            type: 'task',
            taskName: 'Multi-Window Refactoring Plan',
            status: 'running',
            progressPercent: 65,
            density: 'compact'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Multi-Window Refactoring Plan',
        status: 'idle',
        steps: []
      }
    }
  }
];

// ---------------------------------------------------------------------------
// U5 Specific Workspace Surface Scenarios (Prompt Section 42)
// ---------------------------------------------------------------------------

export const U5_WORKSPACE_SCENARIOS: MockScenario[] = [
  // U5-01 Empty Generic Workspace
  {
    id: 'u5_01_empty_generic_workspace',
    name: 'U5-01 Empty Generic Workspace',
    description: 'Clean generic workspace ready for task execution with empty artifact canvas and calm standby status.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-01',
        type: 'generic',
        title: 'New Workspace',
        status: 'idle',
        userFacingState: 'Ready',
        currentObjective: 'Standby for complex task instruction',
        steps: [],
        artifacts: []
      }
    }
  },

  // U5-02 Project Workspace
  {
    id: 'u5_02_project_workspace',
    name: 'U5-02 Project Workspace',
    description: 'Project workspace displaying primary architecture artifact, multi-step checklist, and conversation rail.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Generate the architecture spec for UI V2 Workspace.' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Architecture specification generated and placed in Primary Work Area.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-02',
        type: 'project',
        title: 'UI V2 Workspace Spec',
        status: 'running',
        userFacingState: 'Working',
        currentObjective: 'Draft and review Level 3 Workspace architectural contracts',
        steps: [
          { id: 's1', label: 'Define composable region boundaries', status: 'completed' },
          { id: 's2', label: 'Decouple Workspace from Agent runtime', status: 'completed' },
          { id: 's3', label: 'Verify continuity across layout transitions', status: 'active' },
          { id: 's4', label: 'Run validation gates with zero AI calls', status: 'pending' }
        ],
        artifacts: [
          {
            id: 'art-spec-1',
            type: 'document',
            title: 'MAVE_WORKSPACE_SPEC.md',
            language: 'markdown',
            content: '# MAVE Workspace Architecture Specification\n\n## 1. Principles\n- Surface Level != Presentation Mode\n- Workspace != Agent Runtime\n- Surface State != Task State\n\n## 2. Regions\n1. Conversation Rail\n2. Primary Work Area\n3. Supporting Context\n4. Activity / Plan'
          }
        ]
      }
    }
  },

  // U5-03 Diff Review Single File
  {
    id: 'u5_03_diff_review_single',
    name: 'U5-03 Diff Review Single File',
    description: 'Dedicated diff review workspace inspecting focused changes in a single critical source file.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Review the fix for network client timeout.' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Here is the unified diff for src/network/client.ts.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-03',
        type: 'diff_review',
        title: 'Diff Review: Network Client',
        status: 'idle',
        userFacingState: 'Ready for Review',
        currentObjective: 'Review network timeout and keep-alive configuration patch',
        files: [
          { path: 'src/network/client.ts', status: 'modified' }
        ],
        steps: [],
        artifacts: [
          {
            id: 'art-diff-03',
            type: 'diff',
            title: 'src/network/client.ts',
            diffData: {
              id: 'diff-single-03',
              type: 'diff',
              filename: 'src/network/client.ts',
              additions: 2,
              deletions: 1,
              lines: [
                { type: 'context', text: 'export const defaultClientOptions = {', oldLineNumber: 22, newLineNumber: 22 },
                { type: 'context', text: '  headers: { "Content-Type": "application/json" },', oldLineNumber: 23, newLineNumber: 23 },
                { type: 'remove', text: '-  timeout: 5000,', oldLineNumber: 24 },
                { type: 'add', text: '+  timeout: 15000,', newLineNumber: 24 },
                { type: 'add', text: '+  keepAlive: true,', newLineNumber: 25 },
                { type: 'context', text: '  retries: 3', oldLineNumber: 25, newLineNumber: 26 },
                { type: 'context', text: '};', oldLineNumber: 26, newLineNumber: 27 }
              ]
            }
          }
        ]
      }
    }
  },

  // U5-04 Diff Review Multi-file
  {
    id: 'u5_04_diff_review_multi',
    name: 'U5-04 Diff Review Multi-file',
    description: 'Multi-file diff review workspace with tabbed file navigation and structured approve/revision actions.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Review the changes across auth, client, and tests.' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Found 3 modified files in the review set.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-04',
        type: 'diff_review',
        title: 'Review: Auth & Client Session',
        status: 'idle',
        userFacingState: 'Ready for Review',
        files: [
          { path: 'src/auth/session.ts', status: 'modified' },
          { path: 'src/network/client.ts', status: 'modified' },
          { path: 'tests/auth.test.ts', status: 'created' }
        ],
        steps: [],
        artifacts: [
          {
            id: 'art-diff-04-1',
            type: 'diff',
            title: 'src/auth/session.ts',
            diffData: {
              id: 'diff-04-1',
              type: 'diff',
              filename: 'src/auth/session.ts',
              additions: 4,
              deletions: 1,
              lines: [
                { type: 'context', text: 'export class SessionManager {', oldLineNumber: 10, newLineNumber: 10 },
                { type: 'remove', text: '-  private token: string | null = null;', oldLineNumber: 11 },
                { type: 'add', text: '+  private token: string | null = null;', newLineNumber: 11 },
                { type: 'add', text: '+  private refreshToken: string | null = null;', newLineNumber: 12 },
                { type: 'add', text: '+  private expiryTimestamp = 0;', newLineNumber: 13 },
                { type: 'add', text: '+  private readonly skewMs = 5000;', newLineNumber: 14 }
              ]
            }
          }
        ]
      }
    }
  },

  // U5-05 Research Workspace
  {
    id: 'u5_05_research_workspace',
    name: 'U5-05 Research Workspace',
    description: 'Research workspace organizing analytical findings, key takeaways, comparison table, and cited sources.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Compare React 19 Actions with TanStack Query mutations.' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Compiled comparative research and authoritative documentation citations.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-05',
        type: 'research',
        title: 'React 19 vs TanStack Query',
        status: 'completed',
        userFacingState: 'Synthesis Complete',
        currentObjective: 'Evaluate mutation patterns, caching lifecycles, and optimistic updates',
        steps: [],
        artifacts: [
          {
            id: 'art-res-05',
            type: 'research',
            title: 'Mutation Framework Comparison',
            researchFindings: {
              question: 'How do React 19 Actions compare to TanStack Query for desktop data mutation?',
              summary: 'React 19 Actions natively integrate with HTML forms, pending transitions, and optimistic state. TanStack Query remains superior for multi-tiered caching, offline persistence, and complex invalidation graphs.',
              takeaways: [
                'React 19 Actions handle UI pending states natively without third-party libraries.',
                'TanStack Query provides durable cache serialization for desktop application sessions.',
                'Hybrid usage allows Actions for simple mutations while retaining Query for server caches.'
              ]
            },
            comparisonData: {
              id: 'comp-05',
              type: 'comparison',
              title: 'Feature Matrix',
              columns: [
                { key: 'feature', label: 'Feature', isPrimary: true },
                { key: 'actions', label: 'React 19 Actions' },
                { key: 'query', label: 'TanStack Query' }
              ],
              rows: [
                { id: '1', values: { feature: 'Form Binding', actions: 'Native HTML form action', query: 'Manual onSubmit handler' } },
                { id: '2', values: { feature: 'Cache Invalidation', actions: 'Router revalidation', query: 'QueryClient.invalidateQueries' } },
                { id: '3', values: { feature: 'Bundle Overhead', actions: '0 kB (Built into React)', query: '~12 kB' } }
              ]
            },
            sources: [
              {
                id: 'src-res-1',
                type: 'source',
                title: 'React 19 Actions Specification',
                domain: 'react.dev',
                url: 'https://react.dev/reference/rsc/server-actions',
                snippet: 'Actions allow components to handle form submissions and async updates natively.'
              },
              {
                id: 'src-res-2',
                type: 'source',
                title: 'TanStack Query Mutations Guide',
                domain: 'tanstack.com',
                url: 'https://tanstack.com/query/latest/docs/framework/react/guides/mutations',
                snippet: 'Durable mutation lifecycles, retries, and cache synchronization.'
              }
            ]
          }
        ]
      }
    }
  },

  // U5-06 Agent Workspace Working
  {
    id: 'u5_06_agent_workspace_working',
    name: 'U5-06 Agent Workspace Working',
    description: 'Synthetic Agent Workspace showing real observable plan progress and active task output.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'thinking', audioLevel: 0 },
      conversation: {
        status: 'streaming',
        activeRequestId: 'req-agent-06',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Refactor desktop window coordinator across 4 files.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-06',
        type: 'agent',
        title: 'Window Coordinator Refactor',
        status: 'running',
        userFacingState: 'Working',
        currentObjective: 'Refactor desktop window coordinator to decouple layout mode from surface level',
        steps: [
          { id: 's1', label: 'Audit current window bounds and placement', status: 'completed' },
          { id: 's2', label: 'Extract layout modes into PresentationMode type', status: 'active' },
          { id: 's3', label: 'Verify multi-monitor snap boundaries', status: 'pending' },
          { id: 's4', label: 'Compile test suites', status: 'pending' }
        ],
        files: [
          { path: 'src/main/surface-window-manager.ts', status: 'modified' },
          { path: 'src/renderer/types.ts', status: 'modified' }
        ],
        outputSummary: 'Decoupling SurfaceLevel from PresentationMode...\nUpdating window manager event dispatchers.'
      }
    }
  },

  // U5-07 Agent Workspace Waiting Approval
  {
    id: 'u5_07_agent_workspace_approval',
    name: 'U5-07 Agent Workspace Waiting Approval',
    description: 'Agent Workspace pausing execution to wait for user confirmation on a Level 2 external operation.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Execute repository cleanup and re-indexing.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-07',
        type: 'agent',
        title: 'Repository Re-indexing',
        status: 'waiting_approval',
        userFacingState: 'Waiting for Approval',
        currentObjective: 'Clean ephemeral build caches and trigger fresh vector index rebuild',
        steps: [
          { id: 's1', label: 'Scan workspace directory structure', status: 'completed' },
          { id: 's2', label: 'Request user approval for cache prune', status: 'active' },
          { id: 's3', label: 'Execute rebuild', status: 'pending' }
        ],
        activeApproval: {
          id: 'appr-07',
          type: 'approval',
          actionRequested: 'Prune build cache and temp artifacts',
          riskLevel: 'Level 2 — External',
          riskClass: 'mutation',
          command: 'rmdir /s /q .cache && pnpm build:index',
          directory: 'D:\\project\\MAVE',
          riskExplanation: 'Modifies local workspace temp files. Requires user authorization.'
        }
      }
    }
  },

  // U5-08 Workspace Completed
  {
    id: 'u5_08_workspace_completed',
    name: 'U5-08 Workspace Completed',
    description: 'Calm completed state: all checklist items green, progress indicator quiet, final artifacts ready.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Build the release changelog for UI V2 U5.' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Changelog drafted, reviewed, and finalized.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-08',
        type: 'project',
        title: 'Release Changelog U5',
        status: 'completed',
        userFacingState: 'Completed',
        currentObjective: 'Finalize changelog for UI V2 U5 milestone',
        steps: [
          { id: 's1', label: 'Collect commits from feat/ui-v2-foundation', status: 'completed' },
          { id: 's2', label: 'Draft release highlights and breaking changes', status: 'completed' },
          { id: 's3', label: 'Verify against test coverage matrix', status: 'completed' }
        ],
        artifacts: [
          {
            id: 'art-changelog-08',
            type: 'document',
            title: 'CHANGELOG_U5.md',
            language: 'markdown',
            content: '# Changelog — MAVE UI V2 U5\n\n## Highlights\n- Added Level 3 Workspace Surface\n- Implemented Workspace != Agent invariant\n- Diff Review, Research, and Project composable regions\n- Determinate and indeterminate progress truthfulness\n- Full regression test suite'
          }
        ]
      }
    }
  },

  // U5-09 Workspace Failed
  {
    id: 'u5_09_workspace_failed',
    name: 'U5-09 Workspace Failed',
    description: 'Non-destructive failure state: preserves conversation, completed steps, and offers synthetic retry intent.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Synchronize remote design tokens.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-09',
        type: 'project',
        title: 'Token Synchronization',
        status: 'error',
        userFacingState: 'Failed',
        currentObjective: 'Fetch updated design tokens from shared repository',
        steps: [
          { id: 's1', label: 'Parse local tokens.css', status: 'completed' },
          { id: 's2', label: 'Fetch remote token definition', status: 'failed' }
        ],
        outputSummary: 'Error: Connection timeout after 15000ms while reaching token registry.'
      }
    }
  },

  // U5-10 Workspace Waiting Clarification
  {
    id: 'u5_10_workspace_waiting_clarification',
    name: 'U5-10 Workspace Waiting Clarification',
    description: 'Workspace waiting for user input: distinctly highlights need for user guidance without aggressive red alerts.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Generate database schema migrations.' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Would you prefer SQLite WAL mode or standard rollback journal for the memory store?' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-10',
        type: 'project',
        title: 'Database Migration',
        status: 'paused',
        userFacingState: 'Waiting for Clarification',
        currentObjective: 'Awaiting journal mode selection from user',
        steps: [
          { id: 's1', label: 'Analyze current database schema', status: 'completed' },
          { id: 's2', label: 'Select SQLite journal configuration', status: 'active' }
        ]
      }
    }
  },

  // U5-11 Focus Artifact Mode
  {
    id: 'u5_11_focus_artifact_mode',
    name: 'U5-11 Focus Artifact Mode',
    description: 'Focus Mode active: conversation and context panels collapsed, primary artifact takes maximal width.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-11',
        type: 'diff_review',
        title: 'Deep Diff Inspection',
        status: 'idle',
        userFacingState: 'Focus Mode',
        files: [{ path: 'src/renderer/WorkspaceShell.tsx', status: 'modified' }],
        steps: [],
        artifacts: [
          {
            id: 'art-diff-11',
            type: 'diff',
            title: 'WorkspaceShell.tsx',
            diffData: {
              id: 'diff-11',
              type: 'diff',
              filename: 'src/renderer/WorkspaceShell.tsx',
              additions: 45,
              deletions: 12,
              lines: [
                { type: 'context', text: 'export const WorkspaceShell: React.FC = () => {', oldLineNumber: 26, newLineNumber: 26 },
                { type: 'add', text: '+  const [isFocusMode, setIsFocusMode] = useState(true);', newLineNumber: 27 },
                { type: 'context', text: '  return (', oldLineNumber: 27, newLineNumber: 28 }
              ]
            }
          }
        ]
      }
    }
  },

  // U5-12 Collapsed Context Panel
  {
    id: 'u5_12_collapsed_context_panel',
    name: 'U5-12 Collapsed Context Panel',
    description: 'Secondary supporting context collapsed while conversation and primary artifact remain side-by-side.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Keep conversation visible while I inspect the document.' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Conversation rail active on the left. Secondary context collapsed.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-12',
        type: 'project',
        title: 'Architecture Review',
        status: 'idle',
        userFacingState: 'Ready',
        steps: [],
        artifacts: [
          {
            id: 'art-doc-12',
            type: 'document',
            title: 'ARCHITECTURE_OVERVIEW.md',
            language: 'markdown',
            content: '# MAVE Architecture Overview\n\nDual-rail presentation layout active.'
          }
        ]
      }
    }
  },

  // U5-13 Conversation → Workspace Continuity
  {
    id: 'u5_13_conversation_to_workspace',
    name: 'U5-13 Conversation → Workspace Continuity',
    description: 'Seamless escalation from Conversation to Workspace: exact same session, turn history, and request preserved.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'full',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        activeRequestId: 'req-escalate-13',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'This task requires sustained structured review.' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Escalating to Level 3 Workspace. All conversation history and active turn context preserved.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-13',
        taskId: 'task-escalate-13',
        type: 'project',
        title: 'Structured Review Task',
        status: 'running',
        userFacingState: 'Working',
        currentObjective: 'Conduct structured multi-step code and test review',
        steps: [
          { id: 's1', label: 'Preserve conversation context', status: 'completed' },
          { id: 's2', label: 'Mount primary work artifact', status: 'active' }
        ]
      }
    }
  },

  // U5-14 Workspace → Conversation Continuity
  {
    id: 'u5_14_workspace_to_conversation',
    name: 'U5-14 Workspace → Conversation Continuity',
    description: 'Minimizing from Workspace back to Conversation: preserves task in memory, does not abort or reset session.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'floating',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        activeRequestId: 'req-escalate-13',
        workspaceEligible: true,
        workspaceReason: 'Active task remains ready in Workspace.',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Collapse back to conversational floating window.' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Minimized to Conversation. Workspace state and task progress remain safely active.' }
        ],
        cards: [
          {
            id: 'card-task-14',
            type: 'task',
            taskName: 'Structured Review Task',
            status: 'running',
            progressPercent: 50,
            userFacingState: 'Working in Background'
          }
        ]
      },
      workspace: {
        type: 'project',
        title: 'Structured Review Task',
        status: 'running',
        steps: []
      }
    }
  },

  // U5-15 Workspace → Presence Minimize
  {
    id: 'u5_15_workspace_to_presence',
    name: 'U5-15 Workspace → Presence Minimize',
    description: 'Minimizing Workspace all the way to Presence: capsule shows truthful MAVE • Working state without reset.',
    category: 'presence',
    snapshot: {
      level: 'presence',
      presentationMode: 'ambient',
      presence: {
        state: 'idle',
        audioLevel: 0,
        quickResponse: {
          text: 'Workspace running in background. Click to reopen.',
          sourceLabel: 'MAVE Workspace'
        }
      },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        type: 'project',
        title: 'Background Build Task',
        status: 'running',
        userFacingState: 'Working',
        steps: []
      }
    }
  },

  // U5-16 Narrow Workspace Adaptation
  {
    id: 'u5_16_narrow_workspace',
    name: 'U5-16 Narrow Workspace Adaptation',
    description: 'Workspace viewed in narrow desktop dimension (720px): side panels gracefully adapt without layout breakage.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'floating',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-16',
        type: 'project',
        title: 'Responsive Workspace',
        status: 'idle',
        userFacingState: 'Ready',
        steps: [
          { id: 's1', label: 'Primary artifact preserves visibility', status: 'completed' },
          { id: 's2', label: 'Side rails collapse gracefully', status: 'completed' }
        ],
        artifacts: [
          {
            id: 'art-resp-16',
            type: 'document',
            title: 'ResponsiveLayout.md',
            language: 'markdown',
            content: '# Responsive Workspace Layout\n\nPreserves artifact primacy at any screen dimension.'
          }
        ]
      }
    }
  }
];

// =============================================================================
// MAVE UI V2 — U6: LANGUAGE EXPERIENCE SCENARIOS (U6-01 through U6-18)
// Canonical Language Experience across Presence, Conversation/Sidecar, and Workspace.
// =============================================================================
export const U6_LANGUAGE_SCENARIOS: MockScenario[] = [
  // U6-01 Quick Translation Presence
  {
    id: 'u6_01_quick_translation_presence',
    name: 'U6-01 Quick Translation Presence',
    description: 'Presence surface handling quick language query without expanding into Workspace. Simple, ambient, instantaneous.',
    category: 'presence',
    snapshot: {
      level: 'presence',
      presence: {
        state: 'idle',
        audioLevel: 0,
        quickResponse: {
          text: 'actually = จริง ๆ / ที่จริงแล้ว (ใช้เน้นข้อเท็จจริงหรือแก้ความเข้าใจผิด)',
          sourceLabel: 'Language Reference • Quick Look'
        }
      },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: { type: 'language', status: 'idle', steps: [] }
    }
  },

  // U6-02 Short Correction Conversation
  {
    id: 'u6_02_short_correction_conversation',
    name: 'U6-02 Short Correction Conversation',
    description: 'Conversation surface showing gentle, non-punitive sentence correction alongside natural empathetic dialogue.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          {
            id: 'u6-m1',
            type: 'message',
            role: 'user',
            content: 'I go to work yesterday and very tired.'
          },
          {
            id: 'u6-m2',
            type: 'message',
            role: 'assistant',
            content: 'I hear you! It sounds like you had a long day. Get some rest tonight.'
          }
        ],
        cards: [
          {
            id: 'u6-card-corr-1',
            type: 'correction',
            originalText: 'I go to work yesterday and very tired.',
            correctedText: 'I went to work yesterday and was very tired.',
            naturalAlternative: 'Work was really exhausting yesterday.',
            explanation: 'Use past tense ("went", "was") for completed events in the past.',
            category: 'grammar',
            intensity: 'balanced',
            targetLanguage: 'English'
          }
        ],
        followUpSuggestions: ['Why "was very tired"?', 'More natural ways to say tired', 'Practice past tense']
      },
      workspace: { type: 'language', status: 'idle', steps: [] }
    }
  },

  // U6-03 Sidecar Writing Help
  {
    id: 'u6_03_sidecar_writing_help',
    name: 'U6-03 Sidecar Writing Help',
    description: 'Chat-only sidecar companion offering polite phrasing assistance next to user document or email editor.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presentationMode: 'sidecar',
      sidecarPlacement: 'right',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        presentationMode: 'sidecar',
        sidecarPlacement: 'right',
        messages: [
          {
            id: 'u6-m3',
            type: 'message',
            role: 'user',
            content: 'How to make this email sound more polite? "Send me the report now."'
          },
          {
            id: 'u6-m4',
            role: 'assistant',
            type: 'message',
            content: 'Here are three natural, professional alternatives depending on urgency:'
          }
        ],
        cards: [
          {
            id: 'u6-card-corr-email',
            type: 'correction',
            originalText: 'Send me the report now.',
            correctedText: 'Could you please send over the report when you have a moment?',
            naturalAlternative: 'Whenever you get a chance, could you share the latest report?',
            explanation: '"Send me now" sounds demanding in professional English. Soften with "Could you please" or "when you have a moment".',
            category: 'naturalness',
            intensity: 'balanced',
            targetLanguage: 'Business English'
          }
        ],
        followUpSuggestions: ['Urgent version', 'Formal version', 'Friendly peer version']
      },
      workspace: { type: 'language', status: 'idle', steps: [] }
    }
  },

  // U6-04 Free Conversation Workspace
  {
    id: 'u6_04_free_conversation_workspace',
    name: 'U6-04 Free Conversation Workspace',
    description: 'Level 3 Language Workspace hosting open English conversation with supportive in-flow correction and context vocabulary.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'listening', audioLevel: 0.35 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm-conv-1', type: 'message', role: 'assistant', content: 'What are you working on this afternoon?' },
          { id: 'm-conv-2', type: 'message', role: 'user', content: 'I am building a new interface for my application.' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-u6-04',
        type: 'language',
        title: 'Free Conversation',
        status: 'running',
        userFacingState: 'Conversing in English',
        languageSession: {
          sessionId: 'sess-04',
          targetLanguage: 'English',
          practiceType: 'free_conversation',
          topic: 'Daily Work & Engineering',
          sessionGoal: 'Speak comfortably about your current development tasks',
          currentPrompt: 'That sounds exciting! What part of the interface are you most focused on right now?',
          correctionIntensity: 'balanced',
          showTranslation: true,
          status: 'practicing',
          observableStateText: 'Ready for your reply…',
          corrections: [
            {
              id: 'corr-04',
              originalText: 'I am building a new interface for my application.',
              correctedText: 'I’m building a new UI for my app.',
              naturalAlternative: 'I’m working on a brand-new user interface today.',
              explanation: 'Your sentence was 100% grammatically correct! Using contractions ("I’m") makes everyday conversation sound more native.',
              category: 'naturalness',
              intensity: 'balanced'
            }
          ],
          vocabulary: [
            { id: 'v1', term: 'Interface', meaning: 'Point of interaction between user and system', partOfSpeech: 'noun', status: 'practiced', isSavedMock: false },
            { id: 'v2', term: 'Contraction', meaning: 'Shortened word form like "I’m" or "don’t"', partOfSpeech: 'noun', status: 'seen', isSavedMock: true }
          ]
        },
        steps: [
          { id: 'st1', label: 'Work topic introduction', status: 'completed' },
          { id: 'st2', label: 'Discuss architecture details', status: 'active' },
          { id: 'st3', label: 'Session vocabulary recap', status: 'pending' }
        ]
      }
    }
  },

  // U6-05 Roleplay Coffee Shop
  {
    id: 'u6_05_roleplay_coffee_shop',
    name: 'U6-05 Roleplay Coffee Shop',
    description: 'Immersive roleplay scenario where MAVE speaks as Barista while remaining MAVE, with clear escape affordance.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-u6-05',
        type: 'language',
        title: 'Roleplay Practice',
        status: 'running',
        userFacingState: 'Roleplay: Coffee Shop',
        languageSession: {
          sessionId: 'sess-05',
          targetLanguage: 'English',
          practiceType: 'roleplay',
          topic: 'Ordering at a Specialty Cafe',
          sessionGoal: 'Order customized coffee with alternative milk and syrup adjustment',
          roleplayScenario: {
            role: 'Barista',
            userRole: 'Customer',
            situation: 'You just walked into a busy Tokyo specialty cafe. Order an iced oat milk latte with less sweetness.',
            location: 'Shibuya Coffee Roasters'
          },
          currentPrompt: 'Hi there! Welcome to Shibuya Roasters. What can I get started for you today?',
          correctionIntensity: 'balanced',
          showTranslation: true,
          status: 'waiting_user',
          observableStateText: 'Waiting for your answer…',
          vocabulary: [
            { id: 'v-rp1', term: 'Oat milk', meaning: 'Plant-based milk made from oats', partOfSpeech: 'noun', status: 'seen' },
            { id: 'v-rp2', term: 'Half-sweet', meaning: 'Prepared with half the standard amount of syrup/sugar', partOfSpeech: 'adj', status: 'seen' }
          ]
        },
        steps: [
          { id: 's1', label: 'Greeting & main beverage order', status: 'active' },
          { id: 's2', label: 'Milk choice & sweetness customization', status: 'pending' },
          { id: 's3', label: 'Payment & takeaway confirmation', status: 'pending' }
        ]
      }
    }
  },

  // U6-06 Roleplay With Explanation Break
  {
    id: 'u6_06_roleplay_explanation_break',
    name: 'U6-06 Roleplay With Explanation Break',
    description: 'User breaks out of roleplay to ask "อธิบายคำนี้หน่อย". MAVE steps out of role cleanly, explains, and prepares to resume.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'speaking', audioLevel: 0.2 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm-rp-1', type: 'message', role: 'assistant', content: '[Barista]: Do you want standard whole milk or an oat milk substitution?' },
          { id: 'm-rp-2', type: 'message', role: 'user', content: 'อธิบายคำว่า substitution หน่อย ใช้ในบริบทอื่นได้ไหม' },
          { id: 'm-rp-3', type: 'message', role: 'assistant', content: 'ได้เลยครับ! (Stepping out of role)\n\n"Substitution" มาจากคำกริยา "substitute" แปลว่า "การแทนที่ / ของทดแทน"\n• ในร้านกาแฟ: oat milk substitution = เปลี่ยนเป็นนมโอ๊ตแทน\n• ในกีฬา: player substitution = การเปลี่ยนตัวผู้เล่น\n• ในสูตรอาหาร: honey substitution = ใช้น้ำผึ้งแทนน้ำตาล\n\nพร้อมกลับเข้าบทบาทไหมครับ?' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-u6-06',
        type: 'language',
        title: 'Roleplay Practice',
        status: 'running',
        userFacingState: 'Roleplay Paused • Explanation',
        languageSession: {
          sessionId: 'sess-06',
          targetLanguage: 'English',
          nativeLanguage: 'Thai',
          practiceType: 'roleplay',
          topic: 'Ordering at a Specialty Cafe',
          sessionGoal: 'Understand vocabulary and resume coffee shop roleplay',
          roleplayScenario: {
            role: 'Barista',
            userRole: 'Customer',
            situation: 'Paused for vocabulary explanation: "substitution".',
            location: 'Shibuya Coffee Roasters'
          },
          currentPrompt: 'Ready to continue ordering? Try saying: "I’d like oat milk instead, please."',
          correctionIntensity: 'detailed',
          showTranslation: true,
          status: 'practicing',
          observableStateText: 'Explanation provided • Ready to resume',
          vocabulary: [
            { id: 'v-sub', term: 'Substitution', meaning: 'The action of replacing someone or something with another', partOfSpeech: 'noun', exampleSentence: 'Is there an extra charge for oat milk substitution?', exampleTranslation: 'มีค่าบริการเพิ่มเติมสำหรับการเปลี่ยนเป็นนมโอ๊ตไหมครับ', status: 'reviewed', isSavedMock: true }
          ]
        }
      }
    }
  },

  // U6-07 Translation Deep Dive
  {
    id: 'u6_07_translation_deep_dive',
    name: 'U6-07 Translation Deep Dive',
    description: 'Expanded translation card demonstrating phonetic spelling, grammar notes, contextual nuance, and related vocabulary.',
    category: 'conversation',
    snapshot: {
      level: 'conversation',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm-tr-1', type: 'message', role: 'user', content: 'Translate and explain: "Serendipity"' }
        ],
        cards: [
          {
            id: 'card-tr-deep',
            type: 'translation',
            originalText: 'Serendipity',
            translatedText: 'การพบเจอสิ่งดี ๆ โดยบังเอิญ',
            targetLanguage: 'Thai',
            pronunciation: '/ˌser.ənˈdɪp.ə.ti/',
            naturalAlternative: 'A pleasant surprise or fortunate accident',
            grammarNote: 'Noun (uncountable). Often describes discovering valuable or agreeable things not sought for.',
            vocabulary: [
              { term: 'Fortunate', meaning: 'โชคดี / เป็นมงคล' },
              { term: 'Coincidence', meaning: 'ความบังเอิญที่เกิดขึ้นพร้อมกัน' }
            ]
          }
        ],
        followUpSuggestions: ['Example sentences with serendipity', 'Similar words', 'Opposite concept']
      },
      workspace: { type: 'language', status: 'idle', steps: [] }
    }
  },

  // U6-08 Grammar Correction Group
  {
    id: 'u6_08_grammar_correction_group',
    name: 'U6-08 Grammar Correction Group',
    description: 'Grouped corrections ("Corrections · 3") with progressive disclosure, keeping multiple improvements clean and supportive.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-u6-08',
        type: 'language',
        title: 'Writing Feedback',
        status: 'idle',
        userFacingState: 'Reviewing 3 Corrections',
        languageSession: {
          sessionId: 'sess-08',
          targetLanguage: 'English',
          practiceType: 'sentence_correction',
          topic: 'Project Status Update Review',
          sessionGoal: 'Review 3 grammar and natural phrasing refinements on drafted report',
          correctionIntensity: 'detailed',
          status: 'reviewing',
          corrections: [
            {
              id: 'corr-g1',
              originalText: 'We discuss about the roadmap.',
              correctedText: 'We discussed the roadmap.',
              explanation: '"Discuss" takes a direct object without the preposition "about".',
              category: 'grammar',
              intensity: 'detailed'
            },
            {
              id: 'corr-g2',
              originalText: 'All team member agree.',
              correctedText: 'All team members agreed.',
              explanation: '"All" requires the plural noun "members", and past context requires "agreed".',
              category: 'grammar',
              intensity: 'detailed'
            },
            {
              id: 'corr-g3',
              originalText: 'The project will be more fast.',
              correctedText: 'The project will be faster.',
              naturalAlternative: 'The project will speed up significantly.',
              explanation: 'One-syllable adjectives form comparatives with -er ("faster"), not "more fast".',
              category: 'naturalness',
              intensity: 'detailed'
            }
          ]
        }
      }
    }
  },

  // U6-09 Vocabulary Review
  {
    id: 'u6_09_vocabulary_review',
    name: 'U6-09 Vocabulary Review',
    description: 'Dedicated vocabulary inspection canvas displaying items, definitions, pronunciation hints, and mock save buttons.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-u6-09',
        type: 'language',
        title: 'Vocabulary Bank',
        status: 'idle',
        userFacingState: '5 Words Encountered',
        languageSession: {
          sessionId: 'sess-09',
          targetLanguage: 'English',
          practiceType: 'vocabulary',
          topic: 'Software Architecture Terms',
          sessionGoal: 'Review and bookmark key vocabulary encountered during technical discussion',
          correctionIntensity: 'balanced',
          status: 'reviewing',
          vocabulary: [
            { id: 'v-b1', term: 'Idempotent', meaning: 'Denoting an operation that can be applied multiple times without changing the result', partOfSpeech: 'adj', pronunciationHint: '/aɪˈdɛm.pə.tənt/', status: 'practiced', isSavedMock: true },
            { id: 'v-b2', term: 'Throughput', meaning: 'The amount of data moved successfully from one place to another in a given time', partOfSpeech: 'noun', status: 'seen', isSavedMock: false },
            { id: 'v-b3', term: 'Backpressure', meaning: 'Resistance or opposition to the desired flow of data in software pipelines', partOfSpeech: 'noun', status: 'seen', isSavedMock: true },
            { id: 'v-b4', term: 'Deterministic', meaning: 'Always producing the same output given the same input', partOfSpeech: 'adj', status: 'reviewed', isSavedMock: false },
            { id: 'v-b5', term: 'Latency', meaning: 'The delay before a transfer of data begins following an instruction', partOfSpeech: 'noun', status: 'practiced', isSavedMock: false }
          ]
        }
      }
    }
  },

  // U6-10 Pronunciation Guidance No Score
  {
    id: 'u6_10_pronunciation_guidance_no_score',
    name: 'U6-10 Pronunciation Guidance (No Fake Score)',
    description: 'Pronunciation guidance enforcing the Truthfulness Invariant: IPA, phonetic guide, and mouth shape shown with ZERO fake scores.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-u6-10',
        type: 'language',
        title: 'Pronunciation Guide',
        status: 'idle',
        userFacingState: 'Truthful Pronunciation Reference',
        languageSession: {
          sessionId: 'sess-10',
          targetLanguage: 'English',
          practiceType: 'speaking',
          topic: 'Challenging English Consonants',
          sessionGoal: 'Learn syllable stress and phonetic placement without fabricated scores',
          correctionIntensity: 'balanced',
          status: 'practicing',
          pronunciationGuide: {
            phrase: 'Particularly challenging',
            ipa: 'pərˈtɪk.jə.lər.li ˈtʃæl.ɪn.dʒɪŋ',
            phoneticSpelling: 'per-TIK-yuh-ler-lee CHAL-in-jing',
            stressHint: 'Primary stress falls on the second syllable of "particularly" (TIK) and first of "challenging" (CHAL).',
            mouthGuide: 'Keep your tongue tip slightly behind upper teeth for the /t/ sound, then transition softly to the /j/ glide.'
          }
        }
      }
    }
  },

  // U6-11 Mock Speaking Practice
  {
    id: 'u6_11_mock_speaking_practice',
    name: 'U6-11 Mock Speaking Practice',
    description: 'Interactive speaking practice simulation showing mock listen and speak triggers clearly tagged with (Mock).',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'listening', audioLevel: 0.65 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-u6-11',
        type: 'language',
        title: 'Speaking Practice',
        status: 'running',
        userFacingState: 'Listening… (Mock Audio Input)',
        languageSession: {
          sessionId: 'sess-11',
          targetLanguage: 'English',
          practiceType: 'speaking',
          topic: 'Self Introduction & Work Background',
          sessionGoal: 'Practice answering common introduction questions verbally',
          currentPrompt: 'Could you tell me a little bit about what you do in your day-to-day job?',
          correctionIntensity: 'balanced',
          showTranslation: true,
          status: 'practicing',
          observableStateText: 'Listening… (Mock Voice Recording)',
          vocabulary: [
            { id: 'v-spk1', term: 'Day-to-day', meaning: 'Happening every day as part of a regular routine', partOfSpeech: 'adj', status: 'seen' }
          ]
        }
      }
    }
  },

  // U6-12 Session Waiting for User
  {
    id: 'u6_12_session_waiting_for_user',
    name: 'U6-12 Session Waiting for User',
    description: 'Calm observable waiting state: "Waiting for your answer…", allowing user time to reflect without timer pressure.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-u6-12',
        type: 'language',
        title: 'Dialogue Practice',
        status: 'idle',
        userFacingState: 'Waiting for your answer…',
        languageSession: {
          sessionId: 'sess-12',
          targetLanguage: 'English',
          practiceType: 'free_conversation',
          topic: 'Weekend Travel Plans',
          sessionGoal: 'Describe a place you would like to visit this year',
          currentPrompt: 'If you could travel anywhere next month, where would you choose and why?',
          correctionIntensity: 'light',
          status: 'waiting_user',
          observableStateText: 'Waiting for your answer…'
        }
      }
    }
  },

  // U6-13 Session Summary
  {
    id: 'u6_13_session_summary',
    name: 'U6-13 Session Summary',
    description: 'Completed practice session summary presenting observed facts: phrases practiced, corrections reviewed, and next steps.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-u6-13',
        type: 'language',
        title: 'Session Complete',
        status: 'completed',
        userFacingState: 'Practice Completed',
        languageSession: {
          sessionId: 'sess-13',
          targetLanguage: 'English',
          practiceType: 'roleplay',
          topic: 'Ordering Food in English',
          sessionGoal: 'Completed ordering food at a restaurant',
          status: 'completed',
          sessionSummary: {
            topicsPracticed: ['Ordering at restaurant', 'Asking for bill', 'Special requests'],
            phrasesPracticedCount: 6,
            correctionsCount: 2,
            vocabularyCount: 5,
            suggestedNextSteps: [
              'Practice dietary restriction phrases ("gluten-free", "nut allergy")',
              'Try the Coffee Shop roleplay scenario next'
            ]
          }
        }
      }
    }
  },

  // U6-14 Office Mode Language Practice
  {
    id: 'u6_14_office_mode_language_practice',
    name: 'U6-14 Office Mode Language Practice',
    description: 'Language practice adapted for silent office environments: audio buttons disabled, text input focused, zero audio leaks.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-u6-14',
        type: 'language',
        title: 'Silent Practice • Office Mode',
        status: 'idle',
        userFacingState: 'Office Mode (Silent)',
        languageSession: {
          sessionId: 'sess-14',
          targetLanguage: 'English',
          practiceType: 'sentence_correction',
          topic: 'Email Proofreading',
          sessionGoal: 'Practice silent writing corrections without audio interruption',
          currentPrompt: 'Paste your draft sentence and MAVE will provide discreet natural improvements.',
          correctionIntensity: 'balanced',
          status: 'practicing',
          observableStateText: 'Silent text mode active'
        }
      }
    }
  },

  // U6-15 Mixed Thai-English Practice
  {
    id: 'u6_15_mixed_thai_english_practice',
    name: 'U6-15 Mixed Thai-English Practice',
    description: 'Natural bilingual interaction: English practice with Thai contextual explanations, testing mixed-script layout robustness.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm-th-1', type: 'message', role: 'user', content: 'คำว่า "Bite the bullet" แปลว่าอะไร ใช้ยังไง' },
          { id: 'm-th-2', type: 'message', role: 'assistant', content: '"Bite the bullet" แปลว่า "กัดฟันทำ" หรือยอมทนเผชิญกับสถานการณ์ที่ยากลำบากหรือเจ็บปวดอย่างกล้าหาญครับ' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-u6-15',
        type: 'language',
        title: 'Idiom Study • Thai/English',
        status: 'running',
        userFacingState: 'Idiom Breakdown',
        languageSession: {
          sessionId: 'sess-15',
          targetLanguage: 'English',
          nativeLanguage: 'Thai',
          practiceType: 'vocabulary',
          topic: 'English Idioms in Daily Conversation',
          sessionGoal: 'Understand common idiomatic expressions and practice them naturally',
          currentPrompt: 'Try using "bite the bullet" in a sentence about a difficult task at work.',
          correctionIntensity: 'detailed',
          status: 'practicing',
          vocabulary: [
            { id: 'v-idiom', term: 'Bite the bullet', meaning: 'กัดฟันทำ / ยอมทนทำสิ่งที่จำเป็นแม้จะไม่ชอบ', partOfSpeech: 'idiom', exampleSentence: 'I had to bite the bullet and pay for the costly repair.', exampleTranslation: 'ฉันต้องกัดฟันจ่ายค่าซ่อมที่แสนแพง', status: 'reviewed', isSavedMock: true }
          ]
        }
      }
    }
  },

  // U6-16 Japanese Script Layout
  {
    id: 'u6_16_japanese_script_layout',
    name: 'U6-16 Japanese Script Layout',
    description: 'Japanese language session demonstrating robust rendering of Kanji, Hiragana, Katakana, and Romaji phonetic hints.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-u6-16',
        type: 'language',
        title: 'Japanese Practice',
        status: 'running',
        userFacingState: 'Speaking Session • Japanese',
        languageSession: {
          sessionId: 'sess-16',
          targetLanguage: 'Japanese',
          practiceType: 'speaking',
          topic: 'Daily Greetings & Polite Expressions',
          sessionGoal: 'Practice common workplace phrases in Japanese',
          currentPrompt: '週末はどうでしたか？ (How was your weekend?) Try responding using natural Japanese phrasing.',
          correctionIntensity: 'balanced',
          status: 'practicing',
          observableStateText: 'Waiting for your answer…',
          corrections: [
            {
              id: 'corr-jp',
              originalText: '週末は楽しかったでした。',
              correctedText: '週末は楽しかったです。',
              explanation: 'Past tense of i-adjective 楽しい is 楽しかった. Do not attach でした to past adjectives in polite form.',
              category: 'grammar',
              intensity: 'balanced'
            }
          ],
          vocabulary: [
            { id: 'v-jp1', term: 'お疲れ様でした', meaning: 'Thank you for your hard work (standard workplace greeting)', partOfSpeech: 'phrase', pronunciationHint: 'Otsukaresama deshita', status: 'practiced', isSavedMock: true },
            { id: 'v-jp2', term: '週末', meaning: 'Weekend (Saturday and Sunday)', partOfSpeech: 'noun', pronunciationHint: 'Shūmatsu', status: 'seen' }
          ]
        }
      }
    }
  },

  // U6-17 Language → General MAVE Transition
  {
    id: 'u6_17_general_mave_transition',
    name: 'U6-17 Language → General MAVE Transition',
    description: 'User asks general task ("เปิดโปรเจกต์ MAVE ให้หน่อย") mid-session. MAVE responds without getting trapped in modal language mode.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: {
        status: 'result',
        messages: [
          { id: 'm-esc-1', type: 'message', role: 'assistant', content: 'What would you like to say next in our conversation practice?' },
          { id: 'm-esc-2', type: 'message', role: 'user', content: 'พักการเรียนแป๊บหนึ่ง เปิดโปรเจกต์ MAVE ให้หน่อย' },
          { id: 'm-esc-3', type: 'message', role: 'assistant', content: 'รับทราบครับ! พักเซสชันการเรียนไว้ก่อน\n\nพร้อมเปิดโปรเจกต์ MAVE ที่ไดเรกทอรี D:\\project\\MAVE ให้เรียบร้อยครับ สามารถกลับมาฝึกภาษาต่อได้ทุกเมื่อเมื่อพร้อมครับ' }
        ],
        cards: []
      },
      workspace: {
        id: 'ws-u6-17',
        type: 'language',
        title: 'Language Session (Paused)',
        status: 'paused',
        userFacingState: 'Session Paused • General Task Active',
        languageSession: {
          sessionId: 'sess-17',
          targetLanguage: 'English',
          practiceType: 'free_conversation',
          topic: 'Daily Conversation',
          sessionGoal: 'Conversation paused while handling general user request',
          status: 'idle',
          observableStateText: 'Paused • General MAVE active'
        }
      }
    }
  },

  // U6-18 Narrow Workspace Adaptation
  {
    id: 'u6_18_narrow_workspace_adaptation',
    name: 'U6-18 Narrow Workspace Adaptation',
    description: 'Language workspace adapted for narrow desktop dimension (720px): practice area retains dominance, context wraps cleanly.',
    category: 'workspace',
    snapshot: {
      level: 'workspace',
      presentationMode: 'floating',
      presence: { state: 'idle', audioLevel: 0 },
      conversation: { status: 'idle', messages: [], cards: [] },
      workspace: {
        id: 'ws-u6-18',
        type: 'language',
        title: 'Adaptive Language Workspace',
        status: 'running',
        userFacingState: 'Narrow Viewport Adaptation',
        languageSession: {
          sessionId: 'sess-18',
          targetLanguage: 'English',
          practiceType: 'free_conversation',
          topic: 'Compact Layout Demonstration',
          sessionGoal: 'Verify responsive layout without text clipping or button overflow',
          currentPrompt: 'Can you describe your favorite hobby in 2 sentences?',
          correctionIntensity: 'light',
          status: 'practicing',
          vocabulary: [
            { id: 'v-nw1', term: 'Compact', meaning: 'Closely and neatly packed together', partOfSpeech: 'adj', status: 'seen' }
          ]
        }
      }
    }
  }
];

// Combined full scenarios array (Baseline U0 preserved first, followed by U2, then U3, then U4, then U5, then U6)
export const MOCK_SCENARIOS: MockScenario[] = [
  ...BASELINE_SCENARIOS,
  ...U2_CONVERSATION_SCENARIOS,
  ...U3_RICH_CARD_SCENARIOS,
  ...U4_CHAT_ONLY_SCENARIOS,
  ...U5_WORKSPACE_SCENARIOS,
  ...U6_LANGUAGE_SCENARIOS
];


