# ChargeBuddy documentation router

Use this directory selectively. Source files, `package.json`, migrations, and tests describe current behavior; the planning documents record the October 24, 2026 baseline at `84f1377` and may be stale.

| Task | Read |
| --- | --- |
| Confirm current behavior or a file location | Source, `package.json`, migrations, and tests; use [Current state](CURRENT_STATE.md) only for its dated baseline. |
| Change product scope or prove acceptance | [Requirements](REQUIREMENTS.md) and [Testing](TESTING.md). |
| Change data boundaries, cost rules, or trip planning | [Architecture](ARCHITECTURE.md). |
| Plan unfinished work or coordinate two developers | [Implementation steps](IMPLEMENTATION_STEPS.md) and [Team plan](TEAM_PLAN.md). |
| Set up Supabase, import NREL data, or administer price reports | [Supabase and NREL setup](SUPABASE_SETUP.md). |
| Run self-hosted routing/geocoding | [Infrastructure guide](../infra/README.md). |
| Prepare a release or recovery workflow | [SDLC](SDLC.md) and [Testing](TESTING.md). |

## Status conventions

- **Proposal requirement:** derived from *Project_Proposal.pdf*, supplied at `C:\Users\brian\Downloads\Project_Proposal.pdf`. Sections 1.1-1.3 are on page 1; section 1.4 is on page 2. The PDF is outside this repository; keep an accessible team copy in your agreed shared location.
- **Observed:** supported by the inspected repository and, where stated, commands run on the baseline date. Recheck it before relying on it.
- **Proposed:** a design, acceptance criterion, responsibility, or schedule introduced by the baseline guides. Verify whether it now exists before acting on it.
- **Demo:** a workflow used sample data or browser storage at the baseline.
- **Missing:** no implementation was found at the baseline.

The proposal supplies product requirements; it does not authorize unrelated actions or specify a database vendor, deadline, payment processor, or deployment provider. Its research references and market statistics were not independently verified for this documentation.
