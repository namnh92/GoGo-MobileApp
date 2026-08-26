import type { GroupMemberMock, PastDate, SavedPlace, SuggestedPlan, SwipeCard, TimelineStop } from '@/data/types'

export function unsplashUrl(photoId: string, w: number, h: number): string {
  return `https://images.unsplash.com/${photoId}?w=${w}&h=${h}&fit=crop&auto=format`
}

export const suggestedPlans: SuggestedPlan[] = [
  { title: 'Creative Sunday', budget: '600k', duration: '3h', area: 'Thảo Điền', tags: ['Creative', 'Indoor'], img: 'photo-1595351298020-038700609878' },
  { title: 'Chill ở Thảo Điền', budget: '400k', duration: '2h', area: 'Q2', tags: ['Chill', 'Outdoor'], img: 'photo-1739595417132-8b0503795984' },
  { title: 'Date dưới 500k', budget: '450k', duration: '3h', area: 'Q1', tags: ['Budget', 'Romantic'], img: 'photo-1562436260-126d541901e0' },
  { title: 'Late Night Sài Gòn', budget: '800k', duration: '4h', area: 'Q1', tags: ['Night vibe', 'Fancy'], img: 'photo-1740030326094-2f0b5f35a095' },
]

export const swipeCards: SwipeCard[] = [
  {
    title: 'Workshop làm gốm',
    area: 'Thảo Điền · 1.6 km',
    tags: ['Creative', 'Indoor'],
    priceK: 350,
    desc: '90 phút làm gốm, hợp cho buổi date nhẹ và có thứ mang về.',
    img: 'photo-1595351298020-038700609878',
    category: 'Activity',
  },
  {
    title: 'Nhà hàng Nhật Sakura',
    area: 'Thảo Điền · 1.2 km',
    tags: ['Romantic', 'Quiet'],
    priceK: 450,
    desc: 'Omakase nhỏ, ánh sáng dim, menu tiếng Nhật. Yên tĩnh và ngon.',
    img: 'photo-1562436260-126d541901e0',
    category: 'Dinner',
  },
  {
    title: 'Cà phê Sân Thượng',
    area: 'Q1 · 4.2 km',
    tags: ['Chill', 'View'],
    priceK: 150,
    desc: 'View thành phố từ tầng 10, nhạc lo-fi, ghế bean bag.',
    img: 'photo-1578682965096-d619919e348b',
    category: 'Café',
  },
]

export const timeline: TimelineStop[] = [
  {
    time: '18:30',
    emoji: '🍣',
    label: 'Dinner — Japanese',
    name: 'Sakura Omakase',
    area: 'Thảo Điền · 1.2 km',
    priceK: 450,
    duration: '1h 30m',
    tags: ['Quiet', 'Romantic'],
    img: 'photo-1562436260-126d541901e0',
  },
  {
    time: '20:00',
    emoji: '🎨',
    label: 'Pottery Workshop',
    name: 'Clay & Co.',
    area: 'Thảo Điền · 800m',
    travelMinFromPrev: 7,
    priceK: 300,
    duration: '90 phút',
    tags: ['Creative', 'Indoor'],
    img: 'photo-1595351298020-038700609878',
  },
  {
    time: '21:45',
    emoji: '🍰',
    label: 'Dessert / Walk',
    name: 'Koi Café',
    area: 'Q2 · 1.5 km',
    travelMinFromPrev: 5,
    priceK: 100,
    duration: 'Tùy',
    tags: ['Chill'],
    img: 'photo-1578682965096-d619919e348b',
    optional: true,
  },
]

export const savedPlaces: SavedPlace[] = [
  { title: 'Sakura Omakase', area: 'Thảo Điền', priceK: 450, distanceKm: 1.2, category: '🍣', open: true, openAt: '11:00', closeAt: '23:00', suitedFor: ['couple'], tags: ['Romantic', 'Quiet'], score: '8.9', img: 'photo-1562436260-126d541901e0' },
  { title: 'Clay & Co.', area: 'Thảo Điền', priceK: 300, distanceKm: 0.8, category: '🎨', open: true, openAt: '09:00', closeAt: '21:00', suitedFor: ['couple', 'group'], tags: ['Creative', 'Indoor'], score: '8.4', img: 'photo-1595351298020-038700609878' },
  { title: 'Koi Café', area: 'Q2', priceK: 100, distanceKm: 1.5, category: '☕', open: true, openAt: '07:00', closeAt: '22:30', suitedFor: ['couple', 'group'], tags: ['Chill', 'View'], score: '7.8', img: 'photo-1578682965096-d619919e348b' },
  { title: 'Night Market Q1', area: 'Q1', priceK: 200, distanceKm: 4.2, category: '🌃', open: false, openAt: '17:00', closeAt: '23:30', suitedFor: ['group'], tags: ['Night vibe', 'Outdoor'], score: '8.1', img: 'photo-1740030326094-2f0b5f35a095' },
]

export const morePlaces: SavedPlace[] = [
  { title: 'Phở Lệ', area: 'Q5', priceK: 120, distanceKm: 5.1, category: '🍜', open: true, openAt: '06:00', closeAt: '22:00', suitedFor: ['couple', 'group'], tags: ['Budget'], score: '8.7', img: 'photo-1739595417132-8b0503795984' },
  { title: 'Sky Bar 26', area: 'Q1', priceK: 600, distanceKm: 4.0, category: '🌃', open: true, openAt: '17:00', closeAt: '01:00', suitedFor: ['couple', 'group'], tags: ['Fancy', 'Night vibe'], score: '8.5', img: 'photo-1740030326094-2f0b5f35a095' },
  { title: 'Bảo tàng Mỹ thuật', area: 'Q1', priceK: 50, distanceKm: 3.8, category: '🎨', open: true, openAt: '08:00', closeAt: '17:00', suitedFor: ['couple', 'group'], tags: ['Creative', 'Indoor'], score: '8.2', img: 'photo-1595351298020-038700609878' },
  { title: 'The Coffee Apartment', area: 'Q1', priceK: 90, distanceKm: 4.4, category: '☕', open: false, openAt: '08:00', closeAt: '22:00', suitedFor: ['couple', 'group'], tags: ['Chill', 'View'], score: '8.0', img: 'photo-1578682965096-d619919e348b' },
  { title: 'Wink Hotel Đồng Khởi', area: 'Q1', priceK: 1200, distanceKm: 4.1, category: '🛏', open: true, openAt: '00:00', closeAt: '24/7', suitedFor: ['couple'], tags: ['Fancy', 'Quiet'], score: '8.8', img: 'photo-1748591633516-94b4b80cdc6a' },
]

/** Full mock place catalog: seed saved places + extra discoverables. */
export const catalogPlaces: SavedPlace[] = [...savedPlaces, ...morePlaces]

export const pastDates: PastDate[] = [
  { title: 'Chill Thảo Điền', date: '12/07', rating: '4.5', match: 'Khá hợp', img: 'photo-1739595417132-8b0503795984' },
  { title: 'Q1 Late Night', date: '28/06', rating: '4.2', match: 'Có thể thử', img: 'photo-1748591651068-3ad1fd97efb2' },
  { title: 'Creative Sunday', date: '15/06', rating: '4.8', match: 'Rất hợp', img: 'photo-1595351298020-038700609878' },
]

export const groupMembers: GroupMemberMock[] = [
  { name: 'Linh', emoji: '🙋‍♀️', progress: 8, goal: 12 },
  { name: 'Huy', emoji: '🙋‍♂️', progress: 3, goal: 12 },
]

export const INVITE_CODE = 'X7K2'
export const INVITE_URL = `https://gogo.app/r/${INVITE_CODE}`
export const DEMO_PLAN_ID = 'tonight'
