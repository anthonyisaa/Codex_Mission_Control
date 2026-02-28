# GH-128: Blocked filter drops results after refresh

## Type
Bug

## Reported behavior
When the incident board is filtered to `blocked`, browser refresh clears visible results or returns an empty set despite blocked incidents existing.

## Suspected cause
Status query parameter is inconsistently normalized between route parsing and filter mapping (`blocked` vs historical alias `on_hold`).

## Reproduction
1. Open board with `?status=blocked`.
2. Confirm blocked incidents are visible.
3. Refresh browser.
4. List may become inconsistent if status mapping is stale.

## Expected
`blocked` remains stable across refresh and route hydration.

## Done when
- Mapping logic normalized.
- Regression test added for refresh/query path.
