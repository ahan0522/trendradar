import assert from "node:assert/strict";
import { parseTwsePublishedAt } from "../lib/research-data/twse";
import { parseFredObservationValue } from "../lib/research-data/fred";
import { parseTpexRocDate } from "../lib/research-data/tpex";

function testTwseTimeParsing() {
  assert.equal(
    parseTwsePublishedAt("1150626", "63427"),
    "2026-06-26T06:34:27+08:00",
  );
  assert.equal(
    parseTwsePublishedAt("1150626", "104316"),
    "2026-06-26T10:43:16+08:00",
  );
  assert.equal(
    parseTwsePublishedAt("1150626", "5"),
    "2026-06-26T00:00:05+08:00",
  );
  assert.throws(
    () => parseTwsePublishedAt("1150626", "246000"),
    /Invalid TWSE time/,
  );
}

function testFredMissingValues() {
  assert.equal(parseFredObservationValue("3.16"), 3.16);
  assert.equal(parseFredObservationValue(" 101.25 "), 101.25);
  assert.equal(parseFredObservationValue(""), null);
  assert.equal(parseFredObservationValue("   "), null);
  assert.equal(parseFredObservationValue("."), null);
  assert.equal(parseFredObservationValue(undefined), null);
}

function testTpexDateParsing() {
  assert.equal(parseTpexRocDate("1150626"), "2026-06-26");
  assert.throws(() => parseTpexRocDate("1150230"), /Invalid TPEx ROC date/);
}

testTwseTimeParsing();
testFredMissingValues();
testTpexDateParsing();
console.log("Research data invariants: PASS");
