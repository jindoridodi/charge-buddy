# ChargeBuddy

Shared language for the nationwide EV-charging discovery and trip-planning product.

## Charger and listing

**Public charger**:
A charger sourced from a public charging dataset or network, with availability and price information that may be incomplete or stale.

**Peer listing**:
A charger location published by a ChargeBuddy host for other users to discover.
_Avoid_: Home charger, host charger (when referring to the published location)

**Charger**:
A discoverable charging location; it may be a public charger or a peer listing.

## Accounts and planning

**Account**:
The authenticated ChargeBuddy identity that owns private data such as vehicles, favorites, and peer listings.
_Avoid_: User (when the ownership boundary matters)

**Trip plan**:
An evaluated route from an origin to a destination, including any compatible charging stops and the assumptions used to choose them.
_Avoid_: Reservation, booking

**Data freshness**:
The time at which a charger record or price was last observed or imported; it is evidence about recency, not a guarantee that the current state is unchanged.

**Unknown availability**:
A charger state for which ChargeBuddy has no reliable current availability evidence.
_Avoid_: Available, offline (unless the source explicitly reports that state)

**Unknown price**:
A charger price state for which ChargeBuddy has no current usable price evidence; it is not a zero-cost value.

**Approximate location**:
A public map position intentionally coarse enough to support discovery without revealing a peer host's exact street address.

**Evaluated feasible plan**:
A trip plan that satisfies the configured vehicle, reserve, compatibility, detour, and search constraints within the limits ChargeBuddy evaluated.
_Avoid_: Optimal route, guaranteed route
