import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  domainHash,
  sha256,
} from "../src/identity/canonical-json.js";
import {
  evidenceBodyHash,
  governedDomainHash,
  hashingSection3Domains,
  isGovernedDomain,
  rawBytesHash,
  supplementalGovernedDomains,
} from "../src/identity/domains.js";
import {
  locateCodePointSpan,
  sliceCodePointSpan,
} from "../src/identity/spans.js";

import {
  fixtureBytes,
  fixtureJson,
  foundationTables,
} from "./support/fixture-v046.js";

const hashingSpec = readFileSync(
  "Lock/04_IMPLEMENTATION/The_Desk_Hashing_Fingerprints_and_Text_Spans_v0.1.4.md",
  "utf8",
);

describe("Hashing section 1 serializer against shipped and local vectors", () => {
  it("reproduces the shipped Unicode key-order vector and both code-point span vectors", () => {
    const vector = fixtureJson("unicode_conformance.json") as {
      spoken_text: string;
      span_vectors: { substring: string; start: number; end: number }[];
      key_order_input: Record<string, string>;
      canonical_json_utf8: string;
    };
    expect(canonicalJson(vector.key_order_input)).toBe(
      vector.canonical_json_utf8,
    );
    expect(vector.span_vectors).toHaveLength(2);
    for (const span of vector.span_vectors) {
      expect(locateCodePointSpan(vector.spoken_text, span.substring)).toEqual({
        start: span.start,
        end: span.end,
      });
      expect(
        sliceCodePointSpan(vector.spoken_text, {
          start: span.start,
          end: span.end,
        }),
      ).toBe(span.substring);
    }
  });

  it("matches the independent all-scalar JSON string escape digest (no shipped vector covers escapes)", () => {
    // Same digest produced by Python json.dumps(ensure_ascii=False) over every Unicode scalar value.
    const hash = createHash("sha256");
    for (let cp = 0; cp <= 0x10ffff; cp += 1) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      hash.update(`${JSON.stringify(String.fromCodePoint(cp))}\n`);
    }
    expect(hash.digest("hex")).toBe(
      "e43c3a9caa274875840d6bb938beefeba39fec711a54efbda4af37e474c729d3",
    );
    // The serializer emits exactly those escapes inside canonical output.
    expect(canonicalJson({ k: "\u0001\n\u007f " })).toBe(
      '{"k":"\\u0001\\n\u007f "}',
    );
  });

  it("keeps NFC/NFD text, keys and values hash-equal and rejects non-semantic numbers", () => {
    expect(domainHash("script-v2", { é: "é" })).toBe(
      domainHash("script-v2", { é: "é" }),
    );
    for (const bad of [1.5, -0, Number.NaN, 2 ** 53])
      expect(() => canonicalJson({ n: bad })).toThrow();
  });

  it("documents that JSON.parse cannot carry the lexical 1.0 of the sequence_not_integer vector", () => {
    const raw = fixtureBytes("claim_event_conformance.json").toString("utf8");
    expect(/"event_sequence":\s*1\.0\b/.test(raw)).toBe(true);
    // A parsed document silently turns 1.0 into the integer 1: lexical-number-aware parsing is required by the
    // later reducer tranche; A1 neither implements that parser nor claims this vector.
    expect(JSON.parse('{"event_sequence":1.0}')).toEqual({ event_sequence: 1 });
  });
});

describe("domain registry", () => {
  it("equals the Hashing section 3 table exactly", () => {
    const section = hashingSpec.slice(
      hashingSpec.indexOf("## 3. Artifact domains"),
      hashingSpec.indexOf("## 4. Build 1"),
    );
    const rows = [...section.matchAll(/\| [^|]+ \| `([a-z0-9-]+)` \|/g)].map(
      (m) => m[1],
    );
    expect(rows).toHaveLength(26);
    expect([...hashingSection3Domains]).toEqual(rows);
  });

  it("lists supplemental governed domains separately and keeps them out of the section 3 set", () => {
    expect([...supplementalGovernedDomains].sort()).toEqual([
      "evidence-package-scope-v1",
      "model-semantic-input-v1",
      "performance-direction-correction-input-v1",
      "render-context-v1",
    ]);
    for (const domain of supplementalGovernedDomains) {
      expect(hashingSection3Domains as readonly string[]).not.toContain(domain);
      expect(isGovernedDomain(domain)).toBe(true);
    }
    expect(hashingSpec).toContain("`model-semantic-input-v1`");
    expect(isGovernedDomain("invented-v1")).toBe(false);
    expect(() =>
      governedDomainHash("invented-v1" as "script-v2", { a: 1 }),
    ).toThrow(/Unregistered/);
  });

  it("preserves the low-level domainHash API and its exact framing", () => {
    expect(domainHash("script-v2", { a: 1 })).toBe(
      createHash("sha256").update('script-v2\n{"a":1}', "utf8").digest("hex"),
    );
    expect(governedDomainHash("script-v2", { a: 1 })).toBe(
      domainHash("script-v2", { a: 1 }),
    );
    expect(() => domainHash("Bad Domain", {})).toThrow();
  });
});

describe("raw-byte exceptions", () => {
  it("hashes evidence bodies as NFC UTF-8 bytes without quotes, domain or newline (16 shipped units)", () => {
    const units = foundationTables().evidence_units ?? [];
    expect(units).toHaveLength(16);
    for (const unit of units)
      expect(evidenceBodyHash(unit.canonical_content as string)).toBe(
        unit.content_hash,
      );
    expect(evidenceBodyHash("é")).toBe(evidenceBodyHash("é"));
    expect(evidenceBodyHash("x")).not.toBe(domainHash("x", "x"));
    expect(() => evidenceBodyHash("\ud800")).toThrow(/surrogate/);
  });

  it("hashes the isolated equal-body scenario unit to the same body hash as evidence 005 with a distinct UUID", () => {
    const scenario = (
      fixtureJson("scenarios.json") as {
        scenarios: {
          equal_body_distinct_identity: {
            rows: { evidence_units: Record<string, string>[] };
          };
        };
      }
    ).scenarios.equal_body_distinct_identity.rows.evidence_units[0];
    const base = (foundationTables().evidence_units ?? []).find(
      (unit) =>
        unit.evidence_unit_id === "d1250007-0000-4000-8000-000000000005",
    );
    expect(scenario).toBeDefined();
    expect(base).toBeDefined();
    expect(evidenceBodyHash(scenario?.canonical_content ?? "")).toBe(
      scenario?.content_hash,
    );
    expect(scenario?.content_hash).toBe(base?.content_hash);
    expect(scenario?.evidence_unit_id).not.toBe(base?.evidence_unit_id);
  });

  it("hashes audio bytes raw and reproduces the 12 audio artifact hashes", () => {
    const rows = (foundationTables().artifacts ?? []).filter((r) =>
      (r.artifact_type as string).startsWith("audio/"),
    );
    expect(rows).toHaveLength(12);
    for (const row of rows)
      expect(rawBytesHash(fixtureBytes(row.storage_uri as string))).toBe(
        row.content_hash,
      );
    expect(rawBytesHash(Buffer.from("abc"))).toBe(sha256(Buffer.from("abc")));
  });
});
