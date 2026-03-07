import { loop, table, t } from "../../mod.ts";

export function createUsersTable() {
  return table("users", {
    id: t.int(),
    name: t.string(),
  });
}

export function createUsersPipelineTable() {
  return table("users", {
    id: t.int(),
    name: t.string(),
    age: t.int(),
    active: t.boolean(),
  });
}

export function createOrdersTable() {
  return table("orders", {
    order_id: t.int(),
    user_id: t.int(),
    total: t.float(),
  });
}

export function createEmployeesTable() {
  return table("employees", {
    id: t.int(),
    name: t.string(),
    manager_id: t.int(),
  });
}

export function createDialectUsersTable() {
  return table("users", {
    name: t.string(),
    created_at: t.timestamp(),
  });
}

export function buildUserPipelineQuery() {
  const users = createUsersPipelineTable();

  return users
    .filter((user) => user.active.eq(true).and(user.age.gte(18)))
    .select((user) => ({
      id: user.id,
      name: user.name.replace(" ", "_").coalesce("unknown"),
      age: user.age,
    }))
    .orderBy((user) => [user.name.asc(), user.id.desc()])
    .limit(20);
}

export function buildOrgTreeQuery() {
  const employees = createEmployeesTable();

  return loop(
    employees
      .filter((employee) => employee.manager_id.isNull())
      .select((employee) => ({
        id: employee.id,
        name: employee.name,
        manager_id: employee.manager_id,
      })),
    (self) =>
      employees.join(
          self,
          (employee, current) => employee.manager_id.eq(current.id),
          (employee) => ({
            id: employee.id,
            name: employee.name,
            manager_id: employee.manager_id,
          })
        )
  );
}

export function buildDialectMatrixQuery() {
  const users = createDialectUsersTable();

  return users.select((user) => ({
    len: user.name.characterLength(),
    bit_len: user.name.bitLength(),
    fmt: user.created_at.dateFormat("%Y-%m-%d"),
  }));
}

export function buildLiveDialectQuery() {
  const users = createDialectUsersTable();

  return users.select((user) => ({
    len: user.name.characterLength(),
    bit_len: user.name.bitLength(),
    day: user.created_at.dateTrunc("day"),
    fmt: user.created_at.dateFormat("%Y-%m-%d"),
  }));
}
