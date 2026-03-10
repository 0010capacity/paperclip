import { describe, expect, it } from "vitest";
import { asString, renderTemplate, resolvePathValue } from "./server-utils.js";

describe("asString", () => {
  it("returns value when it is a non-empty string", () => {
    expect(asString("hello", "fallback")).toBe("hello");
  });

  it("returns fallback when value is undefined", () => {
    expect(asString(undefined, "fallback")).toBe("fallback");
  });

  it("returns fallback when value is null", () => {
    expect(asString(null, "fallback")).toBe("fallback");
  });

  it("returns fallback when value is empty string", () => {
    expect(asString("", "fallback")).toBe("fallback");
  });

  it("returns fallback when value is whitespace-only", () => {
    expect(asString("   ", "fallback")).toBe("fallback");
    expect(asString("\t\t", "fallback")).toBe("fallback");
    expect(asString("\n\n", "fallback")).toBe("fallback");
    expect(asString("  \n\t  ", "fallback")).toBe("fallback");
  });

  it("returns value when it contains non-whitespace characters", () => {
    expect(asString("  hello  ", "fallback")).toBe("  hello  ");
  });

  it("returns fallback when value is a number", () => {
    expect(asString(123, "fallback")).toBe("fallback");
  });

  it("returns fallback when value is an object", () => {
    expect(asString({}, "fallback")).toBe("fallback");
  });
});

describe("resolvePathValue", () => {
  it("returns value for simple path", () => {
    expect(resolvePathValue({ name: "test" }, "name")).toBe("test");
  });

  it("returns value for nested path", () => {
    expect(resolvePathValue({ agent: { name: "test" } }, "agent.name")).toBe("test");
  });

  it("returns empty string for missing path", () => {
    expect(resolvePathValue({ agent: { name: "test" } }, "agent.missing")).toBe("");
  });

  it("returns empty string for null value", () => {
    expect(resolvePathValue({ agent: null }, "agent.name")).toBe("");
  });

  it("converts number to string", () => {
    expect(resolvePathValue({ count: 42 }, "count")).toBe("42");
  });

  it("converts boolean to string", () => {
    expect(resolvePathValue({ enabled: true }, "enabled")).toBe("true");
  });

  it("stringifies object value", () => {
    expect(resolvePathValue({ data: { foo: "bar" } }, "data")).toBe('{"foo":"bar"}');
  });
});

describe("renderTemplate", () => {
  it("replaces simple variable", () => {
    expect(renderTemplate("Hello {{name}}", { name: "World" })).toBe("Hello World");
  });

  it("replaces nested variable", () => {
    expect(renderTemplate("Hello {{agent.name}}", { agent: { name: "World" } })).toBe("Hello World");
  });

  it("handles whitespace around variable", () => {
    expect(renderTemplate("Hello {{ name }}", { name: "World" })).toBe("Hello World");
  });

  it("returns empty string for missing variable", () => {
    expect(renderTemplate("Hello {{missing}}", { name: "World" })).toBe("Hello ");
  });

  it("handles multiple variables", () => {
    expect(
      renderTemplate("Hello {{agent.name}}, you are {{agent.role}}", {
        agent: { name: "World", role: "Agent" },
      }),
    ).toBe("Hello World, you are Agent");
  });
});
