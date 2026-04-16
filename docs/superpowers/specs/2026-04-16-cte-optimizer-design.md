# CTE Optimizer Design

Date: 2026-04-16
Status: Approved for planning

## Summary

Add a shared render-layer optimizer that removes unused CTEs and merges structurally duplicate non-recursive CTEs before the final SQL AST is attached to the parser output.

The optimizer applies to both `optimized` and `readable` render strategies, and it treats base CTEs, readable-stage CTEs, hoisted join CTEs, and nested subquery CTEs through one common pipeline.

## Goals

- Remove CTEs that are never referenced by the final rendered query.
- Deduplicate structurally identical non-recursive CTEs even when they come from different lowering paths.
- Apply cleanup uniformly across both render strategies.
- Keep the optimization at the AST and `With[]` layer so builders do not need local dedupe logic.
- Cover the new behavior with regression tests before implementation.

## Non-Goals

- Changing query semantics or projection contents.
- Introducing user-facing configuration for CTE optimization aggressiveness.
- Deduplicating recursive CTE definitions in the first version.
- Reworking stage planning or generated CTE naming rules beyond reference rewrites required by dedupe.

## Current Behavior

CTEs are produced in several places during query lowering:

- base `withs` are materialized through `materializeBaseCtes(...)`
- readable-mode stage boundaries emit `cte_0`, `cte_1`, and so on
- non-lateral join subqueries can be hoisted into named CTEs
- nested pipeline compilation can attach inner `with` lists to intermediate ASTs

Today those CTEs are concatenated and attached to the final AST in `buildPipelineParserAst(...)` without any shared optimization pass.

As a result:

- duplicate non-recursive CTE bodies can survive into the final SQL
- CTEs that were generated during lowering but are no longer referenced can still be emitted
- readable and optimized strategies rely on their local lowering behavior instead of a single cleanup rule

## Proposed Change

Introduce a new helper module in the render layer, `packages/teta/src/edsl/sql/render/cte_optimize.ts`, and run it from `buildPipelineParserAst(...)` immediately before `ast.with` is assigned.

The optimizer accepts the final `SelectAst` plus the merged `With[]` list and performs two passes:

1. Reachability analysis

- walk the outer query AST to find referenced CTE names
- recursively walk live CTE bodies to discover transitive dependencies
- discard any CTE not reachable from the outer query

2. Structural deduplication

- consider only live non-recursive CTEs
- compute a structural fingerprint from each `With.stmt.ast`
- choose the first equivalent CTE as canonical
- rewrite references in the outer query and all surviving CTE bodies to the canonical name
- remove duplicate definitions after rewrite

The final optimized `With[]` remains in dependency-safe original order, minus entries that were eliminated.

## Architecture

The optimizer lives at the boundary where lowering has already completed but SQL stringification has not started yet. That gives it visibility into every CTE source without forcing earlier lowering code to coordinate dedupe decisions.

Integration stays narrow:

- `renderPipelineAst(...)` continues to build base CTEs, stage CTEs, and the final select AST
- `buildPipelineParserAst(...)` becomes the single integration point for optimization
- existing builders such as `build.ts`, `source_join.ts`, and `recursive_cte.ts` remain focused on lowering, not global cleanup

This architecture makes aggressive cleanup available in both render modes and across nested subquery compilation.

## Components

Primary module:

- `packages/teta/src/edsl/sql/render/cte_optimize.ts`

Responsibilities:

- collect referenced table names from `SelectAst` nodes and nested subqueries
- build a dependency graph between CTEs
- compute live CTE set from the outer query root
- fingerprint eligible CTE bodies for structural equivalence
- build and apply a rename map for canonical deduped names
- return the compacted `With[]` list in stable dependency order

Supporting integration:

- `packages/teta/src/edsl/sql/render/pipeline_cte.ts`

Responsibility:

- merge base and generated CTEs
- call the optimizer with the outer `SelectAst`
- attach only optimized CTEs to `ast.with`

## Data Flow

1. Existing lowering builds the outer `SelectAst`, base CTE list, and generated stage CTE list.
2. `buildPipelineParserAst(...)` merges the CTE arrays.
3. The optimizer traverses the outer query AST and marks directly referenced CTE names.
4. The optimizer follows references inside live CTE bodies until it reaches a fixed point.
5. The optimizer fingerprints live non-recursive CTE bodies and identifies canonical definitions.
6. The optimizer rewrites CTE references in the outer query and surviving CTE bodies through the canonical rename map.
7. The optimizer returns the remaining CTEs, preserving dependency-safe order.
8. The final `ast.with` is assigned from that optimized list.

## Safety And Correctness Rules

- Recursive CTEs participate in reachability but are excluded from structural dedupe in the first version.
- Only exact structural matches are eligible for dedupe. If two CTE bodies are not provably identical, keep both.
- The first surviving equivalent CTE becomes canonical so output stays stable within a render.
- The optimizer must traverse nested subqueries, union branches, and CTE bodies when collecting references and applying renames.
- If a path is not understood, the safe behavior is to leave it unoptimized rather than guess at equivalence.

## Testing Strategy

Use TDD and add failing regressions before implementation.

Primary test coverage:

- dead CTE elimination in SQL output for generated stage CTEs
- dead CTE elimination for hoisted join or nested subquery cases
- dedupe of structurally identical non-recursive CTEs into one canonical `WITH` entry
- correct rewrite of canonical names in the final query and nested subqueries
- preservation of live recursive CTEs

Likely test surfaces:

- `packages/teta/tests/render_strategy.test.ts`
- `packages/teta/tests/query.test.ts`
- a new focused test file such as `packages/teta/tests/cte_optimizer.test.ts` if the scenarios become easier to read in isolation

## Risks And Mitigations

### Risk: dedupe rewrites a reference path incompletely

Mitigation:

- keep traversal logic centralized in one optimizer module
- add tests that cover nested subqueries and union branches

### Risk: fingerprinting merges CTEs that only appear similar

Mitigation:

- restrict dedupe to exact structural AST fingerprints
- exclude recursive CTEs from first-pass dedupe

### Risk: readable-mode SQL shape changes more than existing tests expect

Mitigation:

- update tests to assert the new aggressive cleanup behavior explicitly
- keep canonical selection stable by preferring the first surviving definition

## Implementation Notes

- Reuse existing AST clone and parser-shape helpers where possible instead of inventing a second AST representation.
- Keep the optimizer post-lowering so no new render options need to be threaded through stage builders.
- Favor small internal helpers for traversal, fingerprinting, rewrite, and liveness analysis so each piece has a clear boundary and can be tested independently.
