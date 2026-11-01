# National data strategy

The first nationwide release will use a periodically refreshed nationwide NREL/AFDC public-charger import as its base dataset instead of requiring live network APIs. Records must retain source and freshness information, and missing or stale availability and price data must remain visibly unknown rather than being presented as current facts.

**Status:** accepted

**Consequences:** Import freshness, attribution, national-scale indexing, and graceful provider/data failure become release concerns. Live network feeds remain a later integration.
