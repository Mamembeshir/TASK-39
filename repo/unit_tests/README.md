# Unit Test Scripts

This directory contains small, focused shell-based checks for core backend behaviors.

## Scope

- Fast policy/contract checks that are useful during local review.
- Behavior probes that do not require running the full API test matrix.
- Guardrails for security and pricing invariants that are easy to regress.

Current scripts:

- `password_length_test.sh` - validates password policy enforcement.
- `production_error_no_stack_test.sh` - confirms production errors do not expose stack traces.
- `quote_pricing_test.sh` - validates quote/pricing endpoint behavior and totals.

## How to run

Run an individual script:

```bash
bash unit_tests/password_length_test.sh
```

Run all scripts:

```bash
for f in unit_tests/*_test.sh; do bash "$f"; done
```

## Fixture and environment assumptions

- API is reachable at `API_BASE_URL` (defaults to `http://localhost:4000` unless overridden by script).
- For tests requiring seeded demo users, ensure fixture seeding is enabled (`SEED_FIXTURES=true`) or seed explicitly via `npm --prefix backend run seed:fixtures`.
- Some checks assume local/dev-like configuration and are not intended to mutate production data.

## Relationship to other test suites

- Use `run_tests.sh` for full integration coverage across API and role workflows.
- Use backend `node --test ...` for JS unit tests in `backend/src/**`.
