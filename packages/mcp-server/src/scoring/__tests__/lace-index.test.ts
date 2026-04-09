/**
 * LACE Index unit tests.
 *
 * Reference: Forster et al. (2010) — Accuracy of the LACE index at predicting
 * death or urgent readmission after hospital discharge.
 *
 * Known scenario (Maria Garcia demo patient):
 *   L = 4  (5 days → bracket 4-6 = 4 pts)
 *   A = 3  (admitted via emergency = 3 pts)
 *   C = 5  (4+ Charlson comorbidities = 5 pts)
 *   E = 2  (2 ED visits in past 6 months = 2 pts)
 *   Total = 14 → HIGH risk tier → daily monitoring
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { laceL, laceA, laceC, laceE } from "@dischargeguard/shared";

// ─── laceL (Length of Stay) ──────────────────────────────────────────────────

describe("laceL — Length of Stay component", () => {
  it("returns 0 for 0 days (same-day discharge)", () => {
    assert.equal(laceL(0), 0);
  });

  it("returns 1 for 1 day", () => {
    assert.equal(laceL(1), 1);
  });

  it("returns 2 for 2 days", () => {
    assert.equal(laceL(2), 2);
  });

  it("returns 3 for 3 days", () => {
    assert.equal(laceL(3), 3);
  });

  it("returns 4 for 4 days (bracket 4-6)", () => {
    assert.equal(laceL(4), 4);
  });

  it("returns 4 for 5 days (bracket 4-6)", () => {
    assert.equal(laceL(5), 4);
  });

  it("returns 4 for 6 days (bracket 4-6)", () => {
    assert.equal(laceL(6), 4);
  });

  it("returns 5 for 7 days (bracket 7-13)", () => {
    assert.equal(laceL(7), 5);
  });

  it("returns 5 for 13 days (bracket 7-13)", () => {
    assert.equal(laceL(13), 5);
  });

  it("returns 7 for 14 days (14+ days)", () => {
    assert.equal(laceL(14), 7);
  });

  it("returns 7 for 30 days (14+ days)", () => {
    assert.equal(laceL(30), 7);
  });

  it("max value is 7", () => {
    assert.equal(laceL(100), 7);
  });
});

// ─── laceA (Acuity) ──────────────────────────────────────────────────────────

describe("laceA — Acuity (emergency admission) component", () => {
  it("returns 3 when admitted via emergency", () => {
    assert.equal(laceA(true), 3);
  });

  it("returns 0 when not admitted via emergency (elective)", () => {
    assert.equal(laceA(false), 0);
  });
});

// ─── laceC (Charlson Comorbidity) ────────────────────────────────────────────

describe("laceC — Charlson Comorbidity component", () => {
  it("returns 0 for Charlson total = 0 (no comorbidities)", () => {
    assert.equal(laceC(0), 0);
  });

  it("returns 1 for Charlson total = 1", () => {
    assert.equal(laceC(1), 1);
  });

  it("returns 2 for Charlson total = 2", () => {
    assert.equal(laceC(2), 2);
  });

  it("returns 3 for Charlson total = 3", () => {
    assert.equal(laceC(3), 3);
  });

  it("returns 5 for Charlson total = 4 (4+ comorbidities)", () => {
    assert.equal(laceC(4), 5);
  });

  it("returns 5 for Charlson total = 10 (capped at 4+)", () => {
    assert.equal(laceC(10), 5);
  });

  it("max value is 5", () => {
    assert.equal(laceC(99), 5);
  });
});

// ─── laceE (ED Visits) ───────────────────────────────────────────────────────

describe("laceE — ED visits in past 6 months component", () => {
  it("returns 0 for 0 ED visits", () => {
    assert.equal(laceE(0), 0);
  });

  it("returns 1 for 1 ED visit", () => {
    assert.equal(laceE(1), 1);
  });

  it("returns 2 for 2 ED visits", () => {
    assert.equal(laceE(2), 2);
  });

  it("returns 3 for 3 ED visits", () => {
    assert.equal(laceE(3), 3);
  });

  it("returns 4 for 4+ ED visits", () => {
    assert.equal(laceE(4), 4);
  });

  it("returns 4 for 10 ED visits (capped at 4)", () => {
    assert.equal(laceE(10), 4);
  });

  it("max value is 4", () => {
    assert.equal(laceE(99), 4);
  });
});

// ─── Composite LACE Scenarios ────────────────────────────────────────────────

describe("LACE composite — known clinical scenarios", () => {
  it("Maria Garcia demo: LOS=5d, emergency, Charlson=7, ED=2 → total=14 (HIGH)", () => {
    const L = laceL(5);   // 4
    const A = laceA(true); // 3
    const C = laceC(7);    // 5  (4+ comorbidities → 5 pts)
    const E = laceE(2);    // 2
    const total = L + A + C + E;

    assert.equal(L, 4);
    assert.equal(A, 3);
    assert.equal(C, 5);
    assert.equal(E, 2);
    assert.equal(total, 14);
    assert.ok(total >= 10, "Score ≥10 is HIGH risk");
  });

  it("Low-risk patient: LOS=2d, elective, Charlson=0, ED=0 → total=2 (LOW)", () => {
    const total = laceL(2) + laceA(false) + laceC(0) + laceE(0);
    assert.equal(total, 2);
    assert.ok(total <= 4, "Score ≤4 is LOW risk");
  });

  it("Medium-risk patient: LOS=4d, emergency, Charlson=1, ED=1 → total=9 (MEDIUM)", () => {
    const L = laceL(4);    // 4
    const A = laceA(true); // 3
    const C = laceC(1);    // 1
    const E = laceE(1);    // 1
    const total = L + A + C + E;
    assert.equal(total, 9);
    assert.ok(total >= 5 && total <= 9, "Score 5-9 is MEDIUM risk");
  });

  it("Maximum possible LACE score is 19", () => {
    const max = laceL(14) + laceA(true) + laceC(4) + laceE(4);
    assert.equal(max, 19); // 7 + 3 + 5 + 4 = 19
  });
});
