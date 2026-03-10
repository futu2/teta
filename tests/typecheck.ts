import * as R from "remeda";
import type {
  ExprRef,
  SqlBigInt,
  SqlBytes,
  SqlDecimal,
  SqlFloat,
  SqlInt,
  SqlJson,
  SqlUuid,
} from "../mod.ts";
import { filter, join, limit, orderBy, param, select, table, t } from "../mod.ts";

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

type ProfileMeta = {
  theme: string;
  flags: string[];
};

const profiles = table("profiles", {
  id: t.uuid(),
  external_id: t.bigint(),
  credit_limit: t.nullable(t.decimal()),
  metadata: t.json<ProfileMeta>(),
  avatar: t.nullable(t.bytes()),
  nickname: t.nullable(t.string()),
});

const leftJoined = users.join(orders, (user, order) => user.id.eq(order.user_id), { type: "left" });
const rightJoined = users.join(orders, (user, order) => user.id.eq(order.user_id), { type: "right" });
const fullJoined = users.join(orders, (user, order) => user.id.eq(order.user_id), { type: "full" });
const leftViaJoin = users.join(orders, (user, order) => user.id.eq(order.user_id), { type: "left" });
const filteredUsers = filter((user: typeof users.columns) => user.id.gt(0))(users);
const projectedUsers = select((user: typeof filteredUsers.columns) => ({
  id: user.id,
  name: user.name.upper(),
}))(filteredUsers);
const curriedPipeline = limit(5)(
  orderBy((row: typeof projectedUsers.columns) => [row.name.asc(), row.id.desc()])(projectedUsers)
);
const curriedJoin = join(
  orders,
  (user: typeof users.columns, order: typeof orders.columns) => user.id.eq(order.user_id),
  { type: "left" }
)(users);
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
const projectedProfiles = profiles.select((profile) => ({
  id: profile.id,
  external_id: profile.external_id.add(1),
  credit_limit: profile.credit_limit.coalesce(0),
  metadata: profile.metadata,
  avatar: profile.avatar,
  nickname: profile.nickname.coalesce("anonymous"),
}));
const uuidFilteredProfiles = profiles.filter((profile) =>
  profile.id.eq(param("00000000-0000-0000-0000-000000000000"))
);
const bigintFilteredProfiles = profiles.filter((profile) =>
  profile.external_id.gt(0).and(profile.external_id.eq(42n))
);

type _LeftJoinTotal = Expect<Equal<ExprType<typeof leftJoined.columns.total>, SqlFloat | null>>;
type _RightJoinId = Expect<Equal<ExprType<typeof rightJoined.columns.id>, SqlInt | null>>;
type _FullJoinTotal = Expect<Equal<ExprType<typeof fullJoined.columns.total>, SqlFloat | null>>;
type _LeftViaJoinTotal = Expect<Equal<ExprType<typeof leftViaJoin.columns.total>, SqlFloat | null>>;
type _ProjectedUsersId = Expect<Equal<ExprType<typeof projectedUsers.columns.id>, SqlInt>>;
type _ProjectedUsersName = Expect<Equal<ExprType<typeof projectedUsers.columns.name>, string>>;
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
type _ProfileId = Expect<Equal<ExprType<typeof profiles.columns.id>, SqlUuid>>;
type _ProfileExternalId = Expect<Equal<ExprType<typeof profiles.columns.external_id>, SqlBigInt>>;
type _ProfileCreditLimit = Expect<Equal<ExprType<typeof profiles.columns.credit_limit>, SqlDecimal | null>>;
type _ProfileMetadata = Expect<Equal<ExprType<typeof profiles.columns.metadata>, SqlJson<ProfileMeta>>>;
type _ProfileAvatar = Expect<Equal<ExprType<typeof profiles.columns.avatar>, SqlBytes | null>>;
type _ProfileNickname = Expect<Equal<ExprType<typeof profiles.columns.nickname>, string | null>>;
type _ProjectedProfileExternalId = Expect<Equal<ExprType<typeof projectedProfiles.columns.external_id>, SqlBigInt>>;
type _ProjectedProfileCreditLimit = Expect<Equal<ExprType<typeof projectedProfiles.columns.credit_limit>, SqlDecimal>>;
type _ProjectedProfileMetadata = Expect<Equal<ExprType<typeof projectedProfiles.columns.metadata>, SqlJson<ProfileMeta>>>;
type _ProjectedProfileAvatar = Expect<Equal<ExprType<typeof projectedProfiles.columns.avatar>, SqlBytes | null>>;
type _ProjectedProfileNickname = Expect<Equal<ExprType<typeof projectedProfiles.columns.nickname>, string>>;

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
void projectedProfiles;
void uuidFilteredProfiles;
void bigintFilteredProfiles;

// @ts-expect-error legacy array selection syntax is removed
users.select((user) => [user.id]);

// @ts-expect-error legacy array aggregate syntax is removed
orders.aggregate((order) => [order.user_id.group()]);
