import { describe, expect, it } from "vitest";

import { decodeBasicAuthHeader, isBasicAuthAuthorized } from "./basicAuth";

const encode = (value: string) => Buffer.from(value, "utf-8").toString("base64");

describe("basicAuth", () => {
  it("decodes a valid basic auth header", () => {
    const header = `Basic ${encode("user:pass")}`;
    expect(decodeBasicAuthHeader(header)).toEqual({
      username: "user",
      password: "pass",
    });
  });

  it("validates expected credentials", () => {
    const header = `Basic ${encode("admin:secret")}`;
    expect(isBasicAuthAuthorized(header, "admin", "secret")).toBe(true);
    expect(isBasicAuthAuthorized(header, "admin", "wrong")).toBe(false);
  });
});
