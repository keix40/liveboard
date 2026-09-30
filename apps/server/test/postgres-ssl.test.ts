import { describe, expect, it } from "vitest";
import { postgresSslOption } from "../src/persistence/postgres-ssl.js";

describe("postgresSslOption", () => {
  it("uses verify-full semantics for Neon-style URLs", () => {
    const ssl = postgresSslOption("postgres://u:p@ep-x.us-east-2.aws.neon.tech/db?sslmode=verify-full");
    expect(ssl).toEqual({ rejectUnauthorized: true });
  });

  it("verifies certificates for require/prefer/verify-ca", () => {
    for (const mode of ["require", "prefer", "verify-ca"]) {
      expect(postgresSslOption(`postgres://u:p@host/db?sslmode=${mode}`)).toEqual({
        rejectUnauthorized: true,
      });
    }
  });

  it("leaves SSL off for disable and missing sslmode", () => {
    expect(postgresSslOption("postgres://u:p@localhost/db?sslmode=disable")).toBeUndefined();
    expect(postgresSslOption("postgres://u:p@localhost/db")).toBeUndefined();
  });
});
