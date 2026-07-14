# Teta EDSL Type System

This document formalizes the TypeScript type model used by the frontend EDSL.
It is not a SQL standard specification. It describes the static guarantees Teta
tries to provide before lowering a query to the backend SQL IR.

## 1. Type Universes

Teta separates host values from SQL values.

```text
H ::= JavaScript/TypeScript host values
S ::= SQL value types accepted in rows and expressions
R ::= finite records from string keys to SQL value types
P ::= expression phases
```

The SQL value universe is:

```text
S ::= SqlInt
    | SqlFloat
    | SqlBigInt
    | SqlDecimal
    | SqlString
    | SqlBoolean
    | SqlDate
    | SqlTimestamp
    | SqlUuid
    | SqlBytes
    | SqlJson<T>
    | null
    | readonly S[]
```

Rows are non-empty records:

```text
R ::= { k1: S1, ..., kn: Sn } where n >= 1
```

The implementation name for row records is `QueryColumns`.

## 2. Core Judgments

The frontend is organized around these judgments:

```text
Γ ⊢ e : Expr<S, P>
Γ ⊢ q : Query<R>
Γ ⊢ step : QueryStep<R1, R2>
```

`Γ` is the callback environment. In a row callback, `Γ` maps each visible column
name to a typed column expression:

```text
Γ(row R) = { k: Column<R[k], k> for k in keys(R) }
```

`Expr<S, P>` is a typed SQL expression with value type `S` and phase `P`.
The phase is phantom metadata:

```text
P ::= row | group | aggregate
```

Runtime expression values do not carry phase fields. Phases exist only to
separate ordinary row expressions, grouped keys, and aggregate outputs in
TypeScript.

## 3. Query Roots

Table schemas introduce root queries:

```text
schema(t) = R
--------------------------------
table(source, t) : Query<R>
```

Inline values introduce root queries by normalizing literal rows:

```text
rows = [r1, ..., rn], n >= 1
sameKeys(rows), normalize(rows) = R
--------------------------------------
values(rows) : Query<R>
```

Both forms allocate an initial scope and a typed `columns` object.

## 4. Query Steps

Every query helper is a pure function that produces a `QueryStep`:

```text
QueryStep<R1, R2> = Query<R1> -> Query<R2>
```

`pipe(q, s1, ..., sn)` applies those functions left to right. Type preservation
is ordinary function composition:

```text
q : Query<R0>
s1 : QueryStep<R0, R1>
...
sn : QueryStep<Rn-1, Rn>
-------------------------
pipe(q, s1, ..., sn) : Query<Rn>
```

### Shape-Preserving Steps

Filters, sorts, and limits keep the current row shape:

```text
Γ(row R) ⊢ p : Expr<SqlBoolean | null, row>
-------------------------------------------
filter(Γ => p) : QueryStep<R, R>

Γ(row R) ⊢ o : OrderItem | readonly OrderItem[]
------------------------------------------------
sort(Γ => o) : QueryStep<R, R>

n ∈ Nat
-------------------------
take(n) : QueryStep<R, R>
```

`filter` accepts nullable booleans because SQL predicates are evaluated with
three-valued logic.

### Projection Steps

`map` replaces the row shape with the expression values of the returned object:

```text
Γ(row R) ⊢ { k1: e1, ..., kn: en }
ei : Expr<Si, row> or compatible literal
------------------------------------------------
map(Γ => { k1: e1, ..., kn: en }) : QueryStep<R, { k1: S1, ..., kn: Sn }>
```

`fold` also replaces the row shape, but every projected expression must be a
grouped key or aggregate output:

```text
Γ(row R) ⊢ { k1: e1, ..., kn: en }
phase(ei) ∈ { group, aggregate }
-------------------------------------------------
fold(Γ => { k1: e1, ..., kn: en }) : QueryStep<R, { k1: S1, ..., kn: Sn }>
```

`group(e)` changes only the phase:

```text
Γ ⊢ e : Expr<S, row>
--------------------
Γ ⊢ group(e) : Expr<S, group>
```

Aggregate helpers produce aggregate phase expressions:

```text
Γ ⊢ e : Expr<S, row>
--------------------
Γ ⊢ count(e) : Expr<SqlInt, aggregate>
Γ ⊢ sum(e)   : Expr<number-like(S), aggregate>
```

The runtime planner unwraps group markers into `GROUP BY` expressions.

### Joins

For `join(right, options)`, the predicate callback sees two environments:

```text
ΓL(row L), ΓR(row R) ⊢ on : Expr<SqlBoolean | null, row>
```

The output shape depends on join type and selection:

```text
inner: nullableSide(L, R) = L & R
left:  nullableSide(L, R) = L & Nullable<R>
right: nullableSide(L, R) = Nullable<L> & R
full:  nullableSide(L, R) = Nullable<L> & Nullable<R>
```

Default merge is only valid when output names do not overlap. If names overlap,
the user must provide a merge projection such as `dropOverlapLeft()`,
`prefixOverlapRight(prefix)`, or an explicit `select` callback.

### Unnest

`unnest` preserves existing columns and appends generated columns:

```text
Γ(row R) ⊢ collection : Expr<readonly S[] | S[] | null, row>
selection = { value: V, ordinality?: O }
------------------------------------------------------------
unnest(Γ => collection, selection) : QueryStep<R, R & { V: S, O?: SqlInt }>
```

With outer unnesting, generated values may be nullable where the dialect
semantics require null-extension.

### Set Operations

Set operations require compatible row names and SQL value types:

```text
compatible(R1, R2)
-------------------------------
union(Query<R2>)    : QueryStep<R1, R1>
unionAll(Query<R2>) : QueryStep<R1, R1>
```

The current implementation requires matching output column names in order.

## 5. Expression Typing

Expression helpers are typed constructors over `Expr<S, P>`.

Comparison preserves SQL nullable predicate behavior:

```text
compatibleComparable(S1, S2)
----------------------------------------------
eq(Expr<S1>, Expr<S2>) : Expr<SqlBoolean | null>
```

Arithmetic is limited to number-like SQL domains:

```text
numberLike(S1), numberLike(S2)
-----------------------------------------
add(Expr<S1>, Expr<S2>) : Expr<numberJoin(S1, S2)>
```

Nullability propagates through many expression helpers:

```text
containsNull(S)
-------------------------------
f(Expr<S>) : Expr<Result | null>
```

Helpers such as `coalesce` remove nullability when a non-null fallback is
provided.

Literals are admitted through `ExprInput<S>`:

```text
ExprInput<S> ::= Expr<S, P> | host literal compatible with S
```

This keeps user code concise while preserving SQL-domain checks.

## 6. Normalization and Preservation

Query construction is immutable. A step creates a new query state rather than
mutating the input state.

Normalization is a separate pure pass over query state. It may rewrite stages
when the rewrite preserves type and SQL meaning. Current frontend normalization
merges adjacent filters:

```text
filter(p); filter(q)  ==>  filter(p AND q)
```

The preservation obligation for every normalization rule is:

```text
if Γ ⊢ q : Query<R> and normalize(q) = q'
then Γ ⊢ q' : Query<R>
and render(q) is semantically equivalent to render(q')
```

Renderer canonicalization, such as stable internal scope names, is separate
from frontend normalization.

## 7. Runtime Opaqueness

Public query values expose only:

```text
Query<R> = {
  kind: "query",
  columns: ColumnRefs<R>
}
```

Compiler state is stored behind a package-private symbol. This is intentional:
user code should not depend on source, stage, CTE, or generated-name internals.

Runtime freezing is a development assertion, not the source of truth for
purity. The source of truth is:

- readonly IR/state types
- pure constructors and query steps
- immutable public values
- normalization as a pure function

Deep freezing is enabled by default in all environments. Set
`TETA_FREEZE_QUERY_VALUES` or `TETA_FREEZE_EXPR_VALUES` to `0` or `false` to
disable it explicitly.
