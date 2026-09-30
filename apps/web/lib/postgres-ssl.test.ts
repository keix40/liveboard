import { describe, expect, it } from "vitest";
import { postgresPoolConfig, postgresSslOption } from "./postgres-ssl.js";

describe("postgresSslOption (web)", () => {
  it("uses verify-full semantics and strips sslmode from pool URL", () => {
    const url = "postgres://u:p@ep-x.us-east-2.aws.neon.tech/db?sslmode=verify-full";
    expect(postgresSslOption(url)).toEqual({ rejectUnauthorized: true });
    const cfg = postgresPoolConfig(url);
    expect(cfg.connectionString).not.toContain("sslmode=");
    expect(cfg.ssl).toEqual({ rejectUnauthorized: true });
  });
});
