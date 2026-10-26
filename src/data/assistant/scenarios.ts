import type { AssistantStreamEvent } from '@/shared/api/types'

/**
 * Scripted GoGo AI replies for the dev-only mock backend (GoGo-MobileApp#378).
 * Sample data, like the design system's: place names, prices and guide titles
 * are illustrative, never real listings. Each scenario is what the contract
 * (GoGo-BE#713, 2.0.0-alpha.2) would send for one kind of question, so every
 * state of the screens can be reached by typing.
 *
 * Triggers (case- and accent-insensitive, Vietnamese or English):
 *
 * | Type…                          | You get                                                         |
 * | ------------------------------ | --------------------------------------------------------------- |
 * | anything else                  | steps, a streamed answer with a list, [1] [2] cites, sources, follow-ups |
 * | `cà phê` / `cafe`              | place result cards + "From GoGo place data" source              |
 * | `tao ke hoach` / `make a plan` | a place card and a create_room proposal → Confirm → TaskSummary |
 * | `an toi` / `dinner`            | missing details: two follow-up groups                           |
 * | `diem thuong` / `loyalty`      | no information (`notice empty`) + next steps                    |
 * | `trả lời chậm` / `slow`        | no text in time: `notice fallback` + `done fallback`            |
 * | `trả lời dài` / `long`         | a long, slow reply to try Stop (keeps the partial text)          |
 * | `bị lỗi` / `broken`            | the reply fails mid-way (`error` frame, partial text kept)      |
 * | `rot mang` / `drop`            | the stream drops and resumes from Last-Event-ID                 |
 * | `mất mạng` / `network`         | the send fails once (Not sent → Retry with the same key)         |
 * | `gioi han` / `limit`           | 429 ASSISTANT_DAILY_LIMIT, status turns `limit_reached`         |
 * | `nhieu qua` / `busy`           | 429 RATE_LIMITED with Retry-After                               |
 * | `tắt trợ lý` / `disabled`      | 503 ASSISTANT_DISABLED                                          |
 *
 * A guest session gets 403 USER_ONLY from every call, as the real API does.
 */

export type Locale = 'vi' | 'en'

export type ScenarioName =
  | 'answer'
  | 'places'
  | 'proposal'
  | 'missing'
  | 'empty'
  | 'fallback'
  | 'long'
  | 'broken'
  | 'drop'
  | 'network'
  | 'limit'
  | 'busy'
  | 'disabled'

/** An event without the fields the backend stamps on (`seq`, `messageId`). */
export type ScriptEvent = AssistantStreamEvent extends infer E
  ? E extends AssistantStreamEvent
    ? Omit<E, 'seq' | 'messageId'>
    : never
  : never

export interface ScriptStep {
  /** Milliseconds after the previous step (scaled by the backend's `speed`). */
  wait: number
  event: ScriptEvent
}

export interface Script {
  steps: ScriptStep[]
  /** Close the first connection after this many frames, without `done`. */
  dropAfter?: number
}

/** Accent-free lower case, so "Cà phê" and "ca phe" match alike. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

const TRIGGERS: [ScenarioName, RegExp][] = [
  // "rớt mạng" before "mất mạng", so the drop is not read as a failed send.
  ['drop', /\b(rot mang|drop)\b/],
  ['network', /\b(mat mang|network)\b/],
  ['disabled', /\b(tat tro ly|disabled)\b/],
  ['limit', /\b(gioi han|limit)\b/],
  ['busy', /\b(nhieu qua|busy)\b/],
  ['proposal', /(tao ke hoach|make a plan|create a plan)/],
  ['places', /(ca phe|cafe|coffee)/],
  ['missing', /\b(an toi|dinner)\b/],
  ['empty', /\b(diem thuong|loyalty)\b/],
  ['fallback', /\b(tra loi cham|slow)\b/],
  ['long', /\b(tra loi dai|long)\b/],
  ['broken', /\b(bi loi|broken)\b/],
]

export function pickScenario(text: string): ScenarioName {
  const folded = fold(text)
  for (const [name, pattern] of TRIGGERS) if (pattern.test(folded)) return name
  return 'answer'
}

/** Splits a reply into the pieces a model would stream. */
function deltas(text: string, wait = 70, size = 18): ScriptStep[] {
  const steps: ScriptStep[] = []
  for (let at = 0; at < text.length; at += size) {
    steps.push({ wait, event: { type: 'delta', text: text.slice(at, at + size) } })
  }
  return steps
}

export const PLACE_IDS = {
  nhaLa: '1b2c3d4e-0000-4000-8000-000000000001',
  gocSach: '1b2c3d4e-0000-4000-8000-000000000002',
} as const

const COPY = {
  vi: {
    answer:
      'Mọi người cùng chọn, rồi chủ phòng chốt kế hoạch. Gồm bốn bước:\n\n' +
      '1. **Tạo kế hoạch** và chọn Nhóm bạn.[1]\n' +
      '2. **Chia sẻ mã mời.** Vào bằng link mời không cần tài khoản.[1]\n' +
      '3. **Mỗi người chọn riêng.** Không ai thấy lựa chọn của người khác cho đến khi ghép.[2]\n' +
      '4. **Ghép và bình chọn.** Chủ phòng chốt kế hoạch.[2]',
    guidePlans: 'GoGo guide · Kế hoạch',
    guidePlansBody: 'Tạo kế hoạch cho nhóm bạn',
    guideRooms: 'GoGo guide · Phòng',
    guideRoomsBody: 'Phòng, ghép và bình chọn',
    askNext: 'Hỏi tiếp',
    nextOptions: ['Mã mời dùng được bao lâu?', 'Thành viên có đổi kế hoạch được không?', 'Tạo kế hoạch nhóm'],
    places: 'Mình tìm được 3 quán cà phê phù hợp. Đây là hai quán gần nhất:',
    placeData: 'Dữ liệu địa điểm GoGo',
    placeOptions: ['Xem quán thứ ba', 'Lên kế hoạch ở đây', 'Mở rộng ra 5 km'],
    proposal: 'Đây là kế hoạch mình sẽ tạo. Bạn chưa nói giờ kết thúc nên mình đặt 2 tiếng.',
    roomTitle: 'Hẹn hò thứ Bảy',
    missing: 'Được thôi. Mình cần thêm hai thông tin trước khi gợi ý địa điểm:',
    people: 'Bao nhiêu người, tính cả bạn?',
    peopleOptions: ['3', '4', '5', '6 trở lên'],
    budget: 'Ngân sách mỗi người',
    budgetOptions: ['Dưới 300k', '300–500k', '500–800k', 'Không quan trọng'],
    alsoAsk: 'Bạn cũng có thể',
    alsoOptions: ['GoGo làm được gì?', 'Tìm địa điểm'],
    long:
      'Ngân sách theo người và tổng cho nhóm là cùng một khoản tiền, tính theo hai cách. ' +
      'Với **Theo người**, ngân sách của mỗi thành viên được nhân với số người để ra tổng của nhóm. ' +
      'Với **Tổng nhóm**, cả nhóm dùng chung một con số và GoGo chia đều khi gợi ý địa điểm. ' +
      'Khi bạn đổi số người trong phòng, cách tính theo người sẽ tự cập nhật tổng, còn tổng nhóm giữ nguyên.',
    broken: 'Để bình chọn, bạn mở kế hoạch và ',
    drop: 'Mã mời dùng được trong 7 ngày. Hết hạn thì chủ phòng tạo mã mới trong phần Mời.[1]',
  },
  en: {
    answer:
      'Everyone weighs in, then the host makes the final call. It takes four steps:\n\n' +
      '1. **Create a plan** and choose Friend group.[1]\n' +
      '2. **Share the invite code.** Joining by invite link needs no account.[1]\n' +
      '3. **Everyone picks separately.** Nobody sees the others’ choices until you match.[2]\n' +
      '4. **Match and vote.** The host locks in the plan.[2]',
    guidePlans: 'GoGo guide · Plans',
    guidePlansBody: 'Create a friend group plan',
    guideRooms: 'GoGo guide · Rooms',
    guideRoomsBody: 'Rooms, matching and voting',
    askNext: 'Ask next',
    nextOptions: ['How long does an invite code last?', 'Can members change the plan?', 'Start a group plan'],
    places: 'I found 3 cafés that match. Here are the two closest:',
    placeData: 'GoGo place data',
    placeOptions: ['Show the third café', 'Plan a date here', 'Widen to 5 km'],
    proposal: 'Here’s the plan I’ll create. You didn’t say when it ends, so I set 2 hours.',
    roomTitle: 'Saturday date',
    missing: 'Happy to. I need two details before I can suggest places:',
    people: 'How many people, including you?',
    peopleOptions: ['3', '4', '5', '6 or more'],
    budget: 'Budget per person',
    budgetOptions: ['Under 300k', '300–500k', '500–800k', 'Doesn’t matter'],
    alsoAsk: 'You could also',
    alsoOptions: ['What can GoGo do?', 'Search places instead'],
    long:
      'Per person and group total describe the same money, counted two ways. ' +
      'With **Per person**, each member’s budget is multiplied by the number of people to give the group total. ' +
      'With **Group total**, the whole group shares one number and GoGo splits it when it suggests places. ' +
      'If the number of people changes, per person updates the total, and a group total stays as it is.',
    broken: 'To vote, open the plan and ',
    drop: 'An invite code lasts 7 days. After that the host creates a new one under Invite.[1]',
  },
} as const

function guideSources(locale: Locale) {
  const copy = COPY[locale]
  return [
    {
      index: 1,
      kind: 'guide_document',
      documentId: '0f6a1e2b-1111-4000-8000-000000000001',
      versionId: '0f6a1e2b-2222-4000-8000-000000000003',
      slug: 'plans.create',
      title: copy.guidePlans,
      description: copy.guidePlansBody,
    },
    {
      index: 2,
      kind: 'guide_document',
      documentId: '0f6a1e2b-1111-4000-8000-000000000002',
      versionId: '0f6a1e2b-2222-4000-8000-000000000004',
      slug: 'rooms.voting',
      title: copy.guideRooms,
      description: copy.guideRoomsBody,
    },
  ]
}

const CHECKED_AT = '2026-10-20T03:00:00Z'

function nhaLaCard() {
  return {
    kind: 'place' as const,
    placeId: PLACE_IDS.nhaLa,
    available: true,
    facts: {
      name: 'Nhà Lá Café',
      addressText: 'Võ Văn Tần, Quận 3',
      priceMin: 45_000,
      priceMax: 90_000,
      currency: 'VND',
      gogoRating: 4.6,
      gogoRatingCount: 32,
      openNow: true,
      checkedAt: CHECKED_AT,
    },
  }
}

/** Next Saturday at the given local hour, as UTC ISO. */
export function nextSaturdayAt(hour: number, now: Date): string {
  const date = new Date(now)
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7 || 7))
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

export function script(name: ScenarioName, locale: Locale, now: Date, proposalId: string): Script {
  const copy = COPY[locale]
  switch (name) {
    case 'places':
      return {
        steps: [
          { wait: 250, event: { type: 'step', step: 'searching_places' } },
          ...deltas(copy.places),
          { wait: 300, event: { type: 'card', card: nhaLaCard() } },
          {
            wait: 200,
            event: {
              type: 'card',
              card: {
                kind: 'place',
                placeId: PLACE_IDS.gocSach,
                available: true,
                facts: {
                  name: 'Góc Sách Coffee',
                  addressText: 'Trần Quốc Thảo, Quận 3',
                  priceMin: 35_000,
                  priceMax: 70_000,
                  currency: 'VND',
                  openNow: false,
                  checkedAt: CHECKED_AT,
                },
              },
            },
          },
          {
            wait: 100,
            event: { type: 'sources', sources: [{ index: 1, kind: 'place_data', title: copy.placeData, checkedAt: CHECKED_AT }] },
          },
          {
            wait: 100,
            event: {
              type: 'follow_ups',
              groups: [{ field: 'next', label: copy.askNext, options: copy.placeOptions.map(label => ({ label, text: label })) }],
            },
          },
          { wait: 50, event: { type: 'done', status: 'complete' } },
        ],
      }
    case 'proposal': {
      const startAt = nextSaturdayAt(20, now)
      const endAt = new Date(Date.parse(startAt) + 2 * 3600_000).toISOString()
      return {
        steps: [
          { wait: 250, event: { type: 'step', step: 'reading_plan' } },
          ...deltas(copy.proposal),
          { wait: 200, event: { type: 'card', card: nhaLaCard() } },
          {
            wait: 250,
            event: {
              type: 'proposal',
              proposal: {
                id: proposalId,
                kind: 'create_room',
                status: 'pending',
                values: [
                  { field: 'title', value: copy.roomTitle, origin: 'assumed', editable: true },
                  { field: 'type', value: 'couple', origin: 'explicit', editable: true },
                  { field: 'startAt', value: startAt, origin: 'explicit', editable: true },
                  { field: 'endAt', value: endAt, origin: 'assumed', editable: true },
                  { field: 'placeId', value: PLACE_IDS.nhaLa, origin: 'explicit', editable: false },
                  { field: 'budgetMode', value: 'total', origin: 'assumed', editable: true },
                  { field: 'budgetAmount', value: 300_000, origin: 'explicit', editable: true },
                ],
                createdAt: now.toISOString(),
                expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
              },
            },
          },
          { wait: 50, event: { type: 'done', status: 'complete' } },
        ],
      }
    }
    case 'missing':
      return {
        steps: [
          { wait: 250, event: { type: 'step', step: 'writing' } },
          ...deltas(copy.missing),
          {
            wait: 150,
            event: {
              type: 'follow_ups',
              groups: [
                { field: 'people', label: copy.people, options: copy.peopleOptions.map(label => ({ label, text: label })) },
                { field: 'budget', label: copy.budget, options: copy.budgetOptions.map(label => ({ label, text: label })) },
              ],
            },
          },
          { wait: 50, event: { type: 'done', status: 'complete' } },
        ],
      }
    case 'empty':
      return {
        steps: [
          { wait: 300, event: { type: 'step', step: 'reading_guide' } },
          { wait: 500, event: { type: 'notice', notice: { kind: 'empty', copyKey: 'assistant.notice.empty' } } },
          {
            wait: 100,
            event: {
              type: 'follow_ups',
              groups: [{ field: 'next', label: copy.alsoAsk, options: copy.alsoOptions.map(label => ({ label, text: label })) }],
            },
          },
          { wait: 50, event: { type: 'done', status: 'complete' } },
        ],
      }
    case 'fallback':
      return {
        steps: [
          { wait: 300, event: { type: 'step', step: 'reading_guide' } },
          {
            wait: 2500,
            event: { type: 'notice', notice: { kind: 'fallback', reason: 'timeout', copyKey: 'assistant.notice.fallback' } },
          },
          { wait: 50, event: { type: 'done', status: 'fallback' } },
        ],
      }
    case 'long':
      return {
        steps: [{ wait: 250, event: { type: 'step', step: 'reading_guide' } }, ...deltas(copy.long, 260, 10), { wait: 50, event: { type: 'done', status: 'complete' } }],
      }
    case 'broken':
      return {
        steps: [
          { wait: 250, event: { type: 'step', step: 'writing' } },
          ...deltas(copy.broken),
          {
            wait: 400,
            event: {
              type: 'error',
              error: {
                code: 'ASSISTANT_PROVIDER_UNAVAILABLE',
                message: 'The assistant could not finish this reply',
                field_errors: [],
                request_id: 'mock-request',
                retryable: true,
              },
            },
          },
        ],
      }
    case 'drop':
      return {
        dropAfter: 3,
        steps: [
          { wait: 250, event: { type: 'step', step: 'reading_guide' } },
          ...deltas(copy.drop, 120),
          { wait: 100, event: { type: 'sources', sources: [guideSources(locale)[1]!] } },
          { wait: 50, event: { type: 'done', status: 'complete' } },
        ],
      }
    default:
      return {
        steps: [
          { wait: 250, event: { type: 'step', step: 'reading_guide' } },
          { wait: 400, event: { type: 'step', step: 'writing' } },
          ...deltas(copy.answer),
          { wait: 100, event: { type: 'sources', sources: guideSources(locale) } },
          {
            wait: 100,
            event: {
              type: 'follow_ups',
              groups: [{ field: 'next', label: copy.askNext, options: copy.nextOptions.map(label => ({ label, text: label })) }],
            },
          },
          { wait: 50, event: { type: 'done', status: 'complete' } },
        ],
      }
  }
}

/** History the mock starts with, relative to now: two today, two yesterday, three earlier. */
export function seedHistory(locale: Locale): { title: string; question: string; answer: string; daysAgo: number; hour: number }[] {
  const vi = locale === 'vi'
  return [
    { title: vi ? 'Quán cà phê yên tĩnh ở Quận 3' : 'Quiet cafés in District 3', question: vi ? 'Tìm quán cà phê yên tĩnh ở Quận 3' : 'Find a quiet café in District 3', answer: vi ? 'Mình tìm được 3 quán mở sau 22 giờ, dưới 100k.' : 'Found 3 cafés open past 10 pm under 100k.', daysAgo: 0, hour: -1 },
    { title: vi ? 'Kế hoạch nhóm bạn' : 'Friend group plans', question: vi ? 'Kế hoạch nhóm hoạt động thế nào?' : 'How do friend group plans work?', answer: vi ? 'Mọi người chọn riêng, rồi chủ phòng chốt.' : 'Everyone picks separately, then the host decides.', daysAgo: 0, hour: -3 },
    { title: vi ? 'Kế hoạch thứ Bảy cho hai người' : 'Saturday plan for two', question: vi ? 'Lên kế hoạch thứ Bảy cho hai đứa' : 'Plan Saturday for the two of us', answer: vi ? 'Đã tạo kế hoạch · Thứ Bảy' : 'Plan created · Saturday', daysAgo: 1, hour: 20 },
    { title: vi ? 'Mã mời không dùng được' : 'Invite code not working', question: vi ? 'Mã mời của mình không dùng được' : 'My invite code does not work', answer: vi ? 'Nhờ chủ phòng tạo mã mới.' : 'Ask the host to create a new code.', daysAgo: 1, hour: 14 },
    { title: vi ? 'Đổi màu chủ đề' : 'Change the theme colour', question: vi ? 'Đổi màu chủ đề ở đâu?' : 'Where do I change the theme colour?', answer: vi ? 'Có bốn màu trong Cài đặt.' : 'Four accent colours in Settings.', daysAgo: 5, hour: 21 },
    { title: vi ? 'Theo người hay tổng nhóm?' : 'Per person or group total?', question: vi ? 'Ngân sách theo người khác tổng nhóm thế nào?' : 'Per person or group total?', answer: vi ? 'Theo người: tổng nhóm = ngân sách × số người.' : 'Per person: group total = budget × people.', daysAgo: 8, hour: 18 },
    { title: vi ? 'Xoá tài khoản' : 'Delete my account', question: vi ? 'Xoá tài khoản thì mất gì?' : 'What goes when I delete my account?', answer: vi ? 'Những gì bị xoá và những gì còn lại.' : 'What is removed and what stays.', daysAgo: 14, hour: 9 },
  ]
}
