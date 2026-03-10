import { omit, pick, pipe } from "remeda";
import type { ExprRef, SqlBigInt, SqlBytes, SqlDecimal, SqlFloat, SqlInt, SqlJson, SqlUuid, } from "../mod.ts";
import { filter, join, limit, orderBy, param, select, table, t, aggregate, asc, desc, eq, gt, upper, add, coalesce, count, group, loop, sum, and, sub, caseWhen, when, mapShape, groupShape, lt } from "../mod.ts";
type Equal<A, B> = ((<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false);
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
const leftJoined = join(users, orders, (user, order) => eq(user.id, order.user_id), { type: "left" });
const rightJoined = join(users, orders, (user, order) => eq(user.id, order.user_id), { type: "right" });
const fullJoined = join(users, orders, (user, order) => eq(user.id, order.user_id), { type: "full" });
const leftViaJoin = join(users, orders, (user, order) => eq(user.id, order.user_id), { type: "left" });
const filteredUsers = filter(users, (user: typeof users.columns) => gt(user.id, 0));
const projectedUsers = select(filteredUsers, (user: typeof filteredUsers.columns) => ({
    id: user.id,
    name: upper(user.name),
}));
const curriedPipeline = pipe(users, filter((user: typeof users.columns) => gt(user.id, 0)), select((user) => ({
    id: user.id,
    name: upper(user.name),
})), orderBy((row) => [asc(row.name), desc(row.id)]), limit(5));
const curriedJoin = pipe(users, join(orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id), { type: "left" }));
const remedaPickedSelection = select(users, pick(["id"]));
const remedaOmittedSelection = select(users, (user) => ({
    ...omit(user, ["name"]),
    upper_name: upper(user.name),
}));
const remedaOmittedAggregate = aggregate(orders, (order) => omit({
    user_id: group(order.user_id),
    order_count: count(order.order_id),
    total_spend: sum(order.total),
}, ["order_count"]));
const leftSelected = select(leftJoined, (row) => ({
    total: coalesce(row.total, 0),
    filtered: gt(row.total, 0),
    name: upper(row.name),
}));
const rightSelected = select(rightJoined, (row) => ({
    user_id: coalesce(row.id, 0),
    total: row.total,
}));
const fullSelected = select(fullJoined, (row) => ({
    id: coalesce(row.id, 0),
    total: coalesce(row.total, 0),
}));
const leftViaJoinSelected = select(leftViaJoin, (row) => ({
    total: coalesce(row.total, 0),
}));
const leftJoinTotal = coalesce(leftJoined.columns.total, 0);
const leftJoinTotalRemaining = sub(leftJoinTotal, 1);
const projectedWithQuotedKey = select(users, (user) => ({ ["User Id"]: user.id }));
const aggregatedWithQuotedKey = aggregate(orders, (order) => ({
    ["User Id"]: group(order.user_id),
    ["Total Spend"]: sum(order.total),
}));
const loopBase = select(users, (user) => ({ id: user.id }));
const looped = loop(loopBase, (self) => filter(self, (row) => gt(row.id, 0)));
const projectedWithCase = select(users, (user) => ({
    id: user.id,
    age_bucket: caseWhen([
        when(lt(user.id, 10), "small"),
        when(lt(user.id, 100), "medium"),
    ], "large"),
    ...mapShape({
        bumped_id: user.id,
    }, (value) => add(value, 1)),
}));
const aggregatedWithGroupShape = aggregate(orders, (order) => ({
    ...groupShape({
        user_id: order.user_id,
    }),
    total_spend: sum(order.total),
}));
const projectedProfiles = select(profiles, (profile) => ({
    id: profile.id,
    external_id: add(profile.external_id, 1),
    credit_limit: coalesce(profile.credit_limit, 0),
    metadata: profile.metadata,
    avatar: profile.avatar,
    nickname: coalesce(profile.nickname, "anonymous"),
}));
const uuidFilteredProfiles = filter(profiles, (profile) => eq(profile.id, param("00000000-0000-0000-0000-000000000000")));
const bigintFilteredProfiles = filter(profiles, (profile) => and(gt(profile.external_id, 0), eq(profile.external_id, 42n)));
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
type _ProjectedWithCaseAgeBucket = Expect<Equal<ExprType<typeof projectedWithCase.columns.age_bucket>, string>>;
type _ProjectedWithCaseBumpedId = Expect<Equal<ExprType<typeof projectedWithCase.columns.bumped_id>, SqlInt>>;
type _AggregatedWithGroupShapeUserId = Expect<Equal<ExprType<typeof aggregatedWithGroupShape.columns.user_id>, SqlInt>>;
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
void projectedWithCase;
void aggregatedWithGroupShape;
void projectedProfiles;
void uuidFilteredProfiles;
void bigintFilteredProfiles;
// @ts-expect-error legacy array selection syntax is removed
select(users, (user) => [user.id]);
// @ts-expect-error legacy array aggregate syntax is removed
aggregate(orders, (order) => [group(order.user_id)]);
