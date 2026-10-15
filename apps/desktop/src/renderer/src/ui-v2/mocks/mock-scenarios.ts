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
        type: 'project',
        title: 'Runtime Config',
        status: 'idle',
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

// Combined full scenarios array (Baseline U0 preserved first, followed by U2, then U3, then U4)
export const MOCK_SCENARIOS: MockScenario[] = [
  ...BASELINE_SCENARIOS,
  ...U2_CONVERSATION_SCENARIOS,
  ...U3_RICH_CARD_SCENARIOS,
  ...U4_CHAT_ONLY_SCENARIOS
];

