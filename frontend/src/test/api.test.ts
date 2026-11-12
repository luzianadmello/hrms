// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import api from "../services/api";

describe("API Authentication Configuration", () => {
  // AUTH-76
  it("sends requests with credentials instead of a Bearer token", async () => {
    let requestConfig: any;

    api.defaults.adapter = async (config) => {
      requestConfig = config;

      return {
        data: { success: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    await api.get("/test-endpoint");

    expect(requestConfig.withCredentials).toBe(true);

    expect(
      requestConfig.headers.get("Authorization")
    ).toBeUndefined();
  });
});