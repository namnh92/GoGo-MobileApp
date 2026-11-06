import type { ReactNode } from 'react'
import { useAdministrativeUnits, useAdministrativeVersion } from '@/shared/administrative/queries'
import { formatPlaceAddress, type PlaceAddress } from '@/shared/administrative/place-address'
import { Text, type TextProps } from './text'

type AddressProps = { place?: PlaceAddress | null; children: (address: string) => ReactNode }

/** All published-place displays share the same formatter and provinces cache. */
export function FormattedPlaceAddress({ place, children }: AddressProps) {
  return place?.areaSummary?.provinceCode && place.areaSummary.communeCode
    ? <AdministrativeAddress place={place}>{children}</AdministrativeAddress>
    : children(formatPlaceAddress(place ?? {}))
}

function AdministrativeAddress({ place, children }: AddressProps) {
  const version = useAdministrativeVersion()
  const provinces = useAdministrativeUnits(version.data?.datasetVersion)
  const province = provinces.data?.find(unit => unit.code === place?.areaSummary?.provinceCode)
  return children(formatPlaceAddress(place ?? {}, province?.fullName))
}

export function PlaceAddressText({ place, ...props }: { place?: PlaceAddress | null } & Omit<TextProps, 'children' | 'accessibilityLabel'>) {
  return <FormattedPlaceAddress place={place}>{address => address.trim()
    ? <Text {...props} accessibilityLabel={address}>{address}</Text>
    : null}</FormattedPlaceAddress>
}
