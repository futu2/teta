# Teta EDSL Type System

This document formalizes the TypeScript type model used by the frontend EDSL.
It is not a SQL standard specification. It describes the static guarantees Teta
tries to provide before lowering a query to the backend SQL IR.

## Type System v2

The frontend uses one descriptor-aware SQL value algebra. A schema descriptor
contains three distinct domains:

```text
ColumnDef<SQL, Input, Output>
```

`SQL` is the value accepted by SQL expressions, `Input` is the host value
accepted by parameter bindings, and `Output` is the decoded value returned by
`decodeRow(...)` / `decodeRows(...)`. Table columns carry the descriptor's
input/output metadata through their static expression type, so `RowOf<Query>`
and `DecodedSchema<Schema>` expose decoded output rather than guessing from a
SQL brand.

Unchecked custom functions use the explicit `SqlUnknown` value. This keeps an
unknown SQL result representable in a query while preventing it from silently
becoming a host-language `any`. Use `checkedFn(...)` for operations in the
portable catalog, and use `unsafeFn<T>(...)` only when an external function's
result type is known by the caller. The shorter `fn(...)` helper is deliberately
unchecked and always returns `SqlUnknown`.

The operation catalog is shared with the SQL renderer. It carries operation
names, arity, broad result domain, and nullability policy. `checkedFn` derives
its argument and result types from that catalog, so an expression such as
`checkedFn("UPPER", user.id)` is rejected before SQL is rendered.

Nullability is represented by `Nullable<T>` / `NonNullableSql<T>`, and scalar
helpers use `PropagateSqlNull<...>` for operations whose result follows SQL
three-valued semantics. Expression phases remain nominal (`row`, `group`, and
`aggregate`) and are carried only at compile time.

## 1. Type Universes

Teta separates host values from SQL values.

```text
H ::= JavaScript/TypeScript host values
S ::= SQL value types accepted in rows and expressions
R ::= finite records from string keys to SQL value types
P ::= expression phases
D ::= runtime SQL type descriptors
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

A descriptor connects expression, input, and output domains:

```text
SqlType<S, I, O> ∈ D
encode : I -> unknown
decode : unknown -> O
```

`t.int()`, for example, has type `SqlType<SqlInt, number, number>`.

## 2. Core Judgments

The frontend is organized around these judgments:

```text
Γ ⊢ e : Expr<S, P>
Γ ⊢ q : Query<R>
Γ ⊢ step : QueryStep<R1, R2>
Δ ⊢ prepared : PreparedQuery<R, Δ>
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

Every query helper is an immutable constructor that produces a `QueryStep`:

```text
QueryStep<R1, R2> = Query<R1> -> Query<R2>
```

This purity claim concerns valid inputs and state: steps do not mutate their
arguments. Public constructors are partial at runtime and throw user errors for
invalid schemas, selectors, values, or unsupported operations.

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
distinct() : QueryStep<R, R>
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

### Typed Parameters

A standalone parameter requires runtime type evidence:

```text
d : SqlType<S, I, O>
-------------------------------
param(name, d) : Expr<S, row>
```

A prepared parameter environment `Δ` maps every name to one descriptor:

```text
Δ = { k1: SqlType<S1, I1, O1>, ..., kn: SqlType<Sn, In, On> }
refs(Δ) = { k1: Expr<S1>, ..., kn: Expr<Sn> }
bindings(Δ) = { k1: I1, ..., kn: In }
```

The preparation judgment is:

```text
Γ, refs(Δ) ⊢ build(refs(Δ)) : Query<R>
used(build) = keys(Δ)
-------------------------------------------------
prepare(Δ, build) : PreparedQuery<R, Δ>
```

Rendering a prepared query requires exactly `bindings(Δ)`. The runtime checks
the same exact key set and applies each descriptor's `encode` function before
passing values to the SQL backend. Declared-but-unused and used-but-undeclared
parameters are rejected when the prepared query is built.

## 6. Normalization and Preservation

Query construction is immutable. A step creates a new query state rather than
mutating the input state.

Normalization is a separate pure pass over frontend logical query state. It may rewrite stages
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

`toIR(...)` is also a separate pure lowering pass:

```text
LogicalQuerySpec<R> -> QueryIR<R>
```

It synthesizes backend-only stage fields while preserving row shape and
expression meaning. The frontend does not store renderer-owned `Stage`
objects.

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

Runtime freezing is an enforcement layer, not the source of truth for purity.
The source of truth is:

- readonly IR/state types
- pure constructors and query steps
- immutable public values
- normalization as a pure function

Newly allocated nodes are frozen once, while previously frozen query structure
is shared by derived queries.
