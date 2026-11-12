import type { ReactNode } from 'react'
import { View } from 'react-native'

export const ROOM_FACT_ORDER = ['name', 'area', 'budget', 'schedule'] as const
type RoomFact = typeof ROOM_FACT_ORDER[number]

/** Missing facts stay omitted; each screen supplies its own row presentation. */
export function RoomFacts({ facts }: { facts: Partial<Record<RoomFact, ReactNode>> }) {
  return ROOM_FACT_ORDER.map(fact => facts[fact] == null ? null : (
    <View key={fact} testID={`room-fact-${fact}`}>{facts[fact]}</View>
  ))
}
