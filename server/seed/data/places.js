/*
 * The U42 seed cities as stored places { countryCode, city, placeId } (G-1, §3.20). Looked up once through
 * the places service (English names) on 2026-10-30, so seeding never calls Google.
 */
export const PLACES = {
  london: { countryCode: 'GB', city: 'London', placeId: 'ChIJdd4hrwug2EcRmSrV3Vo6llI' },
  manchester: { countryCode: 'GB', city: 'Manchester', placeId: 'ChIJ2_UmUkxNekgRqmv-BDgUvtk' },
  dublin: { countryCode: 'IE', city: 'Dublin', placeId: 'ChIJL6wn6oAOZ0gRoHExl6nHAAo' },
  berlin: { countryCode: 'DE', city: 'Berlin', placeId: 'ChIJAVkDPzdOqEcRcDteW0YgIQQ' },
  munich: { countryCode: 'DE', city: 'Munich', placeId: 'ChIJ2V-Mo_l1nkcRfZixfUq4DAE' },
  paris: { countryCode: 'FR', city: 'Paris', placeId: 'ChIJD7fiBh9u5kcRYJSMaMOCCwQ' },
  lyon: { countryCode: 'FR', city: 'Lyon', placeId: 'ChIJl4foalHq9EcR8CG75CqrCAQ' },
  madrid: { countryCode: 'ES', city: 'Madrid', placeId: 'ChIJgTwKgJcpQg0RaSKMYcHeNsQ' },
  barcelona: { countryCode: 'ES', city: 'Barcelona', placeId: 'ChIJ5TCOcRaYpBIRCmZHTz37sEQ' },
  amsterdam: { countryCode: 'NL', city: 'Amsterdam', placeId: 'ChIJVXealLU_xkcRja_At0z9AGY' },
  warsaw: { countryCode: 'PL', city: 'Warsaw', placeId: 'ChIJAZ-GmmbMHkcR_NPqiCq-8HI' },
  lisbon: { countryCode: 'PT', city: 'Lisbon', placeId: 'ChIJO_PkYRozGQ0R0DaQ5L3rAAQ' },
  stockholm: { countryCode: 'SE', city: 'Stockholm', placeId: 'ChIJywtkGTF2X0YRZnedZ9MnDag' },
}
