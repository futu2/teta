import * as R from "remeda";
import type { ExprRef, SqlFloat, SqlInt } from "../mod.ts";
import { filter, join, limit, orderBy, pipeQuery, select, table, t } from "../mod.ts";

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
const remedaPickedSelection = users.select(R.pick(["id"]));
const remedaOmittedSelection = users.select((user) => ({
  ...R.omit(user, ["name"]),
  upper_name: user.name.upper(),
}));
const remedaOmittedAggregate = orders.aggregate((order) =>
  R.omit({
    user_id: order.user_id.group(),
    order_count: order.order_id.count(),
    total_spend: order.total.sum(),
  }, ["order_count"])
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

const projectedWithQuotedKey = users.select((user) => ({ ["User Id"]: user.id }));
const aggregatedWithQuotedKey = orders.aggregate((order) => ({
  ["User Id"]: order.user_id.group(),
  ["Total Spend"]: order.total.sum(),
}));
const loopBase = users.select((user) => ({ id: user.id }));
const looped = loopBase.loop((self) => self.filter((row) => row.id.gt(0)));

type _LeftJoinTotal = Expect<Equal<ExprType<typeof leftJoined.columns.total>, SqlFloat | null>>;
type _RightJoinId = Expect<Equal<ExprType<typeof rightJoined.columns.id>, SqlInt | null>>;
type _FullJoinTotal = Expect<Equal<ExprType<typeof fullJoined.columns.total>, SqlFloat | null>>;
type _LeftViaJoinTotal = Expect<Equal<ExprType<typeof leftViaJoin.columns.total>, SqlFloat | null>>;
type _CurriedPipelineId = Expect<Equal<ExprType<typeof curriedPipeline.columns.id>, SqlInt>>;
type _CurriedPipelineName = Expect<Equal<ExprType<typeof curriedPipeline.columns.name>, string>>;
type _CurriedJoinTotal = Expect<Equal<ExprType<typeof curriedJoin.columns.total>, SqlFloat | null>>;
type _RemedaPickedId = Expect<Equal<ExprType<typeof remedaPickedSelection.columns.id>, SqlInt>>;
type _RemedaOmittedId = Expect<Equal<ExprType<typeof remedaOmittedSelection.columns.id>, SqlInt>>;
type _RemedaOmittedUpperName = Expect<Equal<ExprType<typeof remedaOmittedSelection.columns.upper_name>, string>>;
type _RemedaOmittedAggregateUserId = Expect<Equal<ExprType<typeof remedaOmittedAggregate.columns.user_id>, SqlInt>>;
type _RemedaOmittedAggregateTotalSpend = Expect<Equal<ExprType<typeof remedaOmittedAggregate.columns.total_spend>, SqlFloat>>;
type _LeftJoinCoalescedTotal = Expect<Equal<ExprType<typeof leftJoinTotal>, SqlFloat>>;
type _LeftJoinCoalescedSub = Expect<Equal<ExprType<typeof leftJoinTotalRemaining>, SqlFloat>>;
type _ProjectedWithQuotedKey = Expect<Equal<ExprType<typeof projectedWithQuotedKey.columns["User Id"]>, SqlInt>>;
type _AggregatedWithQuotedKey = Expect<Equal<ExprType<typeof aggregatedWithQuotedKey.columns["Total Spend"]>, SqlFloat>>;
type _LoopedId = Expect<Equal<ExprType<typeof looped.columns.id>, SqlInt>>;

void leftSelected;
void rightSelected;
void fullSelected;
void curriedPipeline;
void curriedJoin;
void remedaPickedSelection;
void remedaOmittedSelection;
void remedaOmittedAggregate;
void leftViaJoinSelected;
void projectedWithQuotedKey;
void aggregatedWithQuotedKey;
void looped;

// @ts-expect-error legacy array selection syntax is removed
users.select((user) => [user.id]);

// @ts-expect-error legacy array aggregate syntax is removed
orders.aggregate((order) => [order.user_id.group()]);
