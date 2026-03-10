import type { ExprRef, SqlFloat, SqlIdentifier, SqlInt } from "../mod.ts";
import { filter, ident, join, limit, namespace, omit, orderBy, pick, pipeQuery, prefix, preset, project, projects, remap, rename, select, selectAll, spread, table, t } from "../mod.ts";

type Equal<A, B> = (
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
);
type Expect<T extends true> = T;
type ExprType<TExpr> = TExpr extends ExprRef<infer TValue> ? TValue : never;

const users = table("users", {
  id: t.int(),
  name: t.string(),
});

const orders = table("orders", {
  order_id: t.int(),
  user_id: t.int(),
  total: t.float(),
});

const leftJoined = users.join(orders, (user, order) => user.id.eq(order.user_id), { type: "left" });
const rightJoined = users.join(orders, (user, order) => user.id.eq(order.user_id), { type: "right" });
const fullJoined = users.join(orders, (user, order) => user.id.eq(order.user_id), { type: "full" });
const leftViaJoin = users.join(orders, (user, order) => user.id.eq(order.user_id), { type: "left" });
const curriedPipeline = pipeQuery(
  users,
  filter((user) => user.id.gt(0)),
  select((user) => ({
    id: user.id,
    name: user.name.upper(),
  })),
  orderBy((row) => [row.name.asc(), row.id.desc()]),
  limit(5)
);
const curriedJoin = pipeQuery(
  users,
  join(orders, (user, order) => user.id.eq(order.user_id), { type: "left" })
);

const leftSelected = leftJoined.select((row) => ({
  total: row.total.coalesce(0),
  filtered: row.total.gt(0),
  name: row.name.upper(),
}));

const rightSelected = rightJoined.select((row) => ({
  user_id: row.id.coalesce(0),
  total: row.total,
}));

const fullSelected = fullJoined.select((row) => ({
  id: row.id.coalesce(0),
  total: row.total.coalesce(0),
}));

const leftViaJoinSelected = leftViaJoin.select((row) => ({
  total: row.total.coalesce(0),
}));

const leftJoinTotal = leftJoined.columns.total.coalesce(0);
const leftJoinTotalRemaining = leftJoinTotal.sub(1);

type _LeftJoinTotal = Expect<Equal<ExprType<typeof leftJoined.columns.total>, SqlFloat | null>>;
type _RightJoinId = Expect<Equal<ExprType<typeof rightJoined.columns.id>, SqlInt | null>>;
type _FullJoinTotal = Expect<Equal<ExprType<typeof fullJoined.columns.total>, SqlFloat | null>>;
type _LeftViaJoinTotal = Expect<Equal<ExprType<typeof leftViaJoin.columns.total>, SqlFloat | null>>;
type _CurriedPipelineId = Expect<Equal<ExprType<typeof curriedPipeline.columns.id>, SqlInt>>;
type _CurriedPipelineName = Expect<Equal<ExprType<typeof curriedPipeline.columns.name>, string>>;
type _CurriedJoinTotal = Expect<Equal<ExprType<typeof curriedJoin.columns.total>, SqlFloat | null>>;
type _LeftJoinCoalescedTotal = Expect<Equal<ExprType<typeof leftJoinTotal>, SqlFloat>>;
type _LeftJoinCoalescedSub = Expect<Equal<ExprType<typeof leftJoinTotalRemaining>, SqlFloat>>;

void leftSelected;
void rightSelected;
void fullSelected;
void curriedPipeline;
void curriedJoin;
const literalIdent = ident("Row Number");
const projectedWithIdent = users.select((user) => [project(ident("User Id"), user.id)]);
const aggregatedWithIdent = orders.aggregate((order) => [
  project(ident("User Id"), order.user_id.group()),
  project(ident("Total Spend"), order.total.sum()),
]);
const hoistedProjectedWithIdent = users.select((user) =>
  projects(project(ident("User Id"), user.id), project("Name", user.name, { quoted: true }))
);
const hoistedAggregatedWithIdent = orders.aggregate((order) =>
  projects(
    project(ident("User Id"), order.user_id.group()),
    project(ident("Total Spend"), order.total.sum())
  )
);

type _IdentLiteralName = Expect<Equal<typeof literalIdent.name, "Row Number">>;
type _IdentLiteralShape = Expect<Equal<typeof literalIdent, SqlIdentifier<"Row Number">>>;
type _ProjectedWithIdent = Expect<Equal<ExprType<typeof projectedWithIdent.columns["User Id"]>, SqlInt>>;
type _AggregatedWithIdent = Expect<Equal<ExprType<typeof aggregatedWithIdent.columns["Total Spend"]>, SqlFloat>>;
type _HoistedProjectedWithIdent = Expect<Equal<ExprType<typeof hoistedProjectedWithIdent.columns["User Id"]>, SqlInt>>;
type _HoistedProjectedName = Expect<Equal<ExprType<typeof hoistedProjectedWithIdent.columns["Name"]>, string>>;
type _HoistedAggregatedWithIdent = Expect<Equal<ExprType<typeof hoistedAggregatedWithIdent.columns["Total Spend"]>, SqlFloat>>;
const composedProjectedWithSpread = users.select((user) =>
  projects(spread(user), rename(user.name.upper(), ident("Upper Name")))
);
const composedAggregatedWithSpread = orders.aggregate((order) =>
  projects(
    spread({ user_id: order.user_id.group() }),
    rename(order.total.sum(), ident("Total Spend"))
  )
);
type _ComposedProjectedId = Expect<Equal<ExprType<typeof composedProjectedWithSpread.columns.id>, SqlInt>>;
type _ComposedProjectedName = Expect<Equal<ExprType<typeof composedProjectedWithSpread.columns.name>, string>>;
type _ComposedProjectedUpperName = Expect<Equal<ExprType<typeof composedProjectedWithSpread.columns["Upper Name"]>, string>>;
type _ComposedAggregatedUserId = Expect<Equal<ExprType<typeof composedAggregatedWithSpread.columns.user_id>, SqlInt>>;
type _ComposedAggregatedTotalSpend = Expect<Equal<ExprType<typeof composedAggregatedWithSpread.columns["Total Spend"]>, SqlFloat>>;
const pickedProjectedWithSelection = users.select((user) =>
  projects(pick(user, "id"), rename(user.name.upper(), ident("Upper Name")))
);
const omittedAggregatedWithSelection = orders.aggregate((order) =>
  projects(
    omit({
      user_id: order.user_id.group(),
      order_count: order.order_id.count(),
    }, "order_count"),
    rename(order.total.sum(), ident("Total Spend"))
  )
);
type _PickedProjectionId = Expect<Equal<ExprType<typeof pickedProjectedWithSelection.columns.id>, SqlInt>>;
type _PickedProjectionUpperName = Expect<Equal<ExprType<typeof pickedProjectedWithSelection.columns["Upper Name"]>, string>>;
type _PickedProjectionKeys = Expect<Equal<keyof typeof pickedProjectedWithSelection.columns, "id" | "Upper Name">>;
type _OmittedAggregatedUserId = Expect<Equal<ExprType<typeof omittedAggregatedWithSelection.columns.user_id>, SqlInt>>;
type _OmittedAggregatedTotalSpend = Expect<Equal<ExprType<typeof omittedAggregatedWithSelection.columns["Total Spend"]>, SqlFloat>>;
type _OmittedAggregatedKeys = Expect<Equal<keyof typeof omittedAggregatedWithSelection.columns, "user_id" | "Total Spend">>;
const selectedWithSelectAll = users.select((user) =>
  projects(selectAll(user), rename(user.name.upper(), ident("Upper Name")))
);
const nestedPresetSelection = users.select((user) => {
  const basePreset = preset(selectAll({ id: user.id, name: user.name }));
  return projects(basePreset, preset(rename(user.name.upper(), ident("Upper Name"))));
});
const nestedPresetAggregate = orders.aggregate((order) => {
  const groupedPreset = preset(selectAll({ user_id: order.user_id.group() }));
  return projects(groupedPreset, preset(rename(order.total.sum(), ident("Total Spend"))));
});
type _SelectedWithSelectAllId = Expect<Equal<ExprType<typeof selectedWithSelectAll.columns.id>, SqlInt>>;
type _SelectedWithSelectAllName = Expect<Equal<ExprType<typeof selectedWithSelectAll.columns.name>, string>>;
type _NestedPresetUpperName = Expect<Equal<ExprType<typeof nestedPresetSelection.columns["Upper Name"]>, string>>;
type _NestedPresetAggregateUserId = Expect<Equal<ExprType<typeof nestedPresetAggregate.columns.user_id>, SqlInt>>;
type _NestedPresetAggregateTotalSpend = Expect<Equal<ExprType<typeof nestedPresetAggregate.columns["Total Spend"]>, SqlFloat>>;
const prefixedSelection = users.select((user) =>
  projects(prefix("user", selectAll(user)))
);
const namespacedAggregate = orders.aggregate((order) =>
  projects(
    namespace(
      "order",
      preset(
        selectAll({ user_id: order.user_id.group() }),
        rename(order.total.sum(), "total")
      )
    )
  )
);
type _PrefixedSelectionId = Expect<Equal<ExprType<typeof prefixedSelection.columns.user_id>, SqlInt>>;
type _PrefixedSelectionName = Expect<Equal<ExprType<typeof prefixedSelection.columns.user_name>, string>>;
type _NamespacedAggregateUserId = Expect<Equal<ExprType<typeof namespacedAggregate.columns.order_user_id>, SqlInt>>;
type _NamespacedAggregateTotal = Expect<Equal<ExprType<typeof namespacedAggregate.columns.order_total>, SqlFloat>>;
const separatedPrefixedSelection = users.select((user) =>
  projects(prefix("user", { separator: "__" }, selectAll(user)))
);
const remappedSelection = users.select((user) =>
  projects(remap({ id: "userId", name: ident("User Name") }, selectAll(user)))
);
const separatedNamespacedAggregate = orders.aggregate((order) =>
  projects(
    namespace(
      "order",
      { separator: "__" },
      preset(
        selectAll({ user_id: order.user_id.group() }),
        rename(order.total.sum(), "total")
      )
    )
  )
);
const remappedAggregate = orders.aggregate((order) =>
  projects(
    remap(
      { user_id: ident("User Id"), total: ident("Total Spend") },
      preset(
        rename(order.user_id.group(), "user_id"),
        rename(order.total.sum(), "total")
      )
    )
  )
);
type _SeparatedPrefixedSelectionId = Expect<Equal<ExprType<typeof separatedPrefixedSelection.columns.user__id>, SqlInt>>;
type _SeparatedPrefixedSelectionName = Expect<Equal<ExprType<typeof separatedPrefixedSelection.columns.user__name>, string>>;
type _RemappedSelectionUserId = Expect<Equal<ExprType<typeof remappedSelection.columns.userId>, SqlInt>>;
type _RemappedSelectionUserName = Expect<Equal<ExprType<typeof remappedSelection.columns["User Name"]>, string>>;
type _SeparatedNamespacedAggregateUserId = Expect<Equal<ExprType<typeof separatedNamespacedAggregate.columns["order__user_id"]>, SqlInt>>;
type _SeparatedNamespacedAggregateTotal = Expect<Equal<ExprType<typeof separatedNamespacedAggregate.columns["order__total"]>, SqlFloat>>;
type _RemappedAggregateUserId = Expect<Equal<ExprType<typeof remappedAggregate.columns["User Id"]>, SqlInt>>;
type _RemappedAggregateTotalSpend = Expect<Equal<ExprType<typeof remappedAggregate.columns["Total Spend"]>, SqlFloat>>;

void leftViaJoinSelected;
void literalIdent;
void projectedWithIdent;
void aggregatedWithIdent;
void hoistedProjectedWithIdent;
void hoistedAggregatedWithIdent;
void composedProjectedWithSpread;
void composedAggregatedWithSpread;
void pickedProjectedWithSelection;
void omittedAggregatedWithSelection;
void selectedWithSelectAll;
void nestedPresetSelection;
void nestedPresetAggregate;
void prefixedSelection;
void namespacedAggregate;
void separatedPrefixedSelection;
void remappedSelection;
void separatedNamespacedAggregate;
void remappedAggregate;

// @ts-expect-error duplicate projection keys should be rejected for select()
users.select((user) => [
  project("dup", user.id),
  project("dup", user.name),
]);

// @ts-expect-error duplicate projection keys should be rejected for aggregate()
orders.aggregate((order) => [
  project(ident("dup"), order.user_id.group()),
  project("dup", order.total.sum(), { quoted: true }),
]);

// @ts-expect-error duplicate projection keys should be rejected for hoisted projects()
projects(project("dup", users.columns.id), project("dup", users.columns.name));

// @ts-expect-error duplicate projection keys should be rejected when spread() overlaps
users.select((user) => projects(spread(user), rename(user.name, "id")));

// @ts-expect-error pick() keys should exist on the source shape
pick(users.columns, "missing");

// @ts-expect-error omit() keys should exist on the source shape
omit(users.columns, "missing");

users.select((user) =>
  // @ts-expect-error duplicate projection keys should be rejected across nested presets
  projects(preset(selectAll({ id: user.id })), preset(rename(user.name, "id")))
);

users.select((user) =>
  // @ts-expect-error duplicate projection keys should be rejected across matching prefixes
  projects(prefix("user", selectAll({ id: user.id })), namespace("user", rename(user.name, "id")))
);

// @ts-expect-error remap() keys should exist on the projection parts
remap({ missing: "x" }, selectAll(users.columns));

users.select((user) =>
  // @ts-expect-error remap() should reject duplicate output keys inside the same preset
  projects(remap({ id: "dup", name: "dup" }, selectAll(user)))
);
