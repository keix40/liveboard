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

  it("never disables certificate verification for require/prefer/verify-ca (Neon uses sslmode=require)", () => {
    for (const mode of ["require", "prefer", "verify-ca", "REQUIRE"]) {
      const url = `postgresql://u:p@ep-x-pooler.us-east-1.aws.neon.tech/db?sslmode=${mode}&channel_binding=require`;
      const cfg = postgresPoolConfig(url);
      expect(cfg.ssl).toEqual({ rejectUnauthorized: true });
      expect(cfg.connectionString).not.toContain("sslmode=");
      expect(cfg.connectionString).toContain("channel_binding=require");
    }
  });

  it("leaves SSL off for sslmode=disable and URLs without sslmode", () => {
    expect(postgresPoolConfig("postgresql://postgres@localhost:5432/db?sslmode=disable").ssl).toBeUndefined();
    expect(postgresPoolConfig("postgresql://postgres@localhost:5432/db").ssl).toBeUndefined();
  });
});
