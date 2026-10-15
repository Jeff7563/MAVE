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

// Combined full scenarios array (Baseline U0 preserved first, followed by U2 specific)
export const MOCK_SCENARIOS: MockScenario[] = [
  ...BASELINE_SCENARIOS,
  ...U2_CONVERSATION_SCENARIOS
];
