# Persistent peer charger reservations

Authenticated drivers can reserve future time slots on another account's published Peer listing. Reservations are immediately confirmed and persisted, visible only to driver and host, and cancellable by either participant before the start. The database serializes slot creation, validates power/energy/time constraints and snapshots the host price. Paused listings cannot receive new reservations. Exact addresses remain private.

Payments, payouts, host approvals, notifications and charger hardware control remain deferred. A reservation is a scheduling record, not proof of payment or a guarantee of charging access.

This extends the previously deferred reservation boundary in ADR 0002. It does not make the other deferred features available.

**Status:** accepted
