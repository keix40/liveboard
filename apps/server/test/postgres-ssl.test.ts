import { describe, expect, it } from "vitest";
import { postgresSslOption } from "../src/persistence/postgres-ssl.js";

describe("postgresSslOption", () => {
  it("uses verify-full semantics for Neon-style URLs", () => {
    const ssl = postgresSslOption("postgres://u:p@ep-x.us-east-2.aws.neon.tech/db?sslmode=verify-full");
    expect(ssl).toEqual({ rejectUnauthorized: true });
  });

  it("allows require without strict verify", () => {
    const ssl = postgresSslOption("postgres://u:p@host/db?sslmode=require");
    expect(ssl).toEqual({ rejectUnauthorized: false });
  });
});
