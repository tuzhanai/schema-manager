import { expect } from "chai";
import { SchemaManager } from "../lib";
import { build, TYPES } from "./helper";

const manager = new SchemaManager();

const stringP1 = build(TYPES.String, "StringSchema", true, "Hello");
const stringP2 = build(TYPES.String, "StringSchema");
const stringP3 = build(TYPES.String + "[]", "StringArraySchema", false, []);

const numP = build(TYPES.Number, "Number", true);
const intP = build(TYPES.Integer, "Int");

const schema1: Record<string, any> = { stringP1, stringP2, numP, intP };
const schema2: Record<string, any> = { stringP3 };
const Schema1 = manager.create(schema1);
const Schema2 = manager.create(schema2);
manager.register("schema1", schema1);
manager.register("schema2", schema2);

const schema3 = { A: { type: Schema1 }, B: { type: Schema2 } };
const Schema3 = manager.create(schema3);
manager.register("schema3", schema3);

const schema4 = { A: { type: "schema1" }, B: { type: "schema2" }, C: { type: "schema1[]" }, D: { type: "schema2[]" } };
manager.register("schema4", schema4);

describe("SchemaType", function() {
  it("success", function() {
    const data = { stringP1: "a", numP: 1.02, intP: 2 };
    const { ok, value } = Schema1.value(data);
    expect(ok).to.equal(true);
    expect(value).to.deep.equal(data);
  });

  it("remove not in schema success", function() {
    const data = { numP: 1.02, a: "xxx" };
    const { ok, value } = Schema1.value(data);
    expect(ok).to.equal(true);
    expect(value.a).to.equal(undefined);
  });

  it("default value", function() {
    const data = { numP: 1.02 };
    const { ok, value } = Schema1.value(data);
    expect(ok).to.equal(true);
    expect(value).to.deep.equal({ numP: 1.02, stringP1: "Hello" });
  });

  it("missing required paramater", function() {
    const data = { a: "xxx" };
    const { ok, message } = Schema1.value(data);
    expect(ok).to.equal(false);
    expect(message).to.equal("missing required paramater numP");
  });

  it("baseType[] success", function() {
    const data = { stringP3: ["a", "b", "c"] };
    const { ok, value } = Schema2.value(data);
    expect(ok).to.equal(true);
    expect(value.stringP3).to.deep.equal(["a", "b", "c"]);
  });

  it("baseType[] failure", function() {
    const data = { stringP3: ["a", 456, "c"] };
    const { ok, message } = Schema2.value(data);
    expect(ok).to.equal(false);
    expect(message).to.deep.equal("at paramater stringP3: at array index 1: failure");
  });

  it("type is a SchemaType instance", function() {
    const data = { A: { numP: 111 }, B: {} };
    const { ok, value } = Schema3.value(data);
    expect(ok).to.equal(true);
    expect(value).to.deep.equal({ A: { stringP1: "Hello", numP: 111 }, B: { stringP3: [] } });
  });

  it("pick", function() {
    const { ok, value } = Schema1.pick("stringP1").value({});
    expect(ok).to.equal(true);
    expect(value).to.deep.equal({ stringP1: "Hello" });
  });

  it("partial", function() {
    const { ok, value } = Schema1.partial().value({});
    expect(ok).to.equal(true);
    expect(value).to.deep.equal({ stringP1: "Hello" });
  });

  it("required", function() {
    const { ok, message, missingParamaters, invalidParamaters } = Schema1.pick("stringP2")
      .required()
      .value({});
    expect(ok).to.equal(false);
    expect(message).to.equal("missing required paramater stringP2");
    expect(missingParamaters).to.deep.equal(["stringP2"]);
    expect(invalidParamaters).to.deep.equal([]);
  });

  it("invalidParamaters", function() {
    const { ok, invalidParamaters, invalidParamaterTypes } = Schema1.pick("numP").value({ numP: "aaa" });
    expect(ok).to.equal(false);
    expect(invalidParamaters).to.deep.equal(["numP"]);
    expect(invalidParamaterTypes).to.deep.equal(["Number"]);
  });
});

describe("SchemaManager", function() {
  it("success", function() {
    const data = { stringP1: "a", numP: 1.02, intP: 2 };
    const { ok, value } = manager.value("schema1", data);
    expect(ok).to.equal(true);
    expect(value).to.deep.equal(data);
  });

  it("remove not in schema success", function() {
    const data = { numP: 1.02, a: "xxx" };
    const { ok, value } = manager.value("schema1", data);
    expect(ok).to.equal(true);
    expect(value.a).to.equal(undefined);
  });

  it("default value", function() {
    const data = { numP: 1.02 };
    const { ok, value } = manager.value("schema1", data);
    expect(ok).to.equal(true);
    expect(value).to.deep.equal({ numP: 1.02, stringP1: "Hello" });
  });

  it("missing required paramater", function() {
    const data = { a: "xxx" };
    const { ok, message } = manager.value("schema1", data);
    expect(ok).to.equal(false);
    expect(message).to.equal("missing required paramater numP");
  });

  it("baseType[] success", function() {
    const data = { stringP3: ["a", "b", "c"] };
    const { ok, value } = manager.value("schema2", data);
    expect(ok).to.equal(true);
    expect(value.stringP3).to.deep.equal(["a", "b", "c"]);
  });

  it("baseType[] failure", function() {
    const data = { stringP3: ["a", 456, "c"] };
    const { ok, message } = manager.value("schema2", data);
    expect(ok).to.equal(false);
    expect(message).to.deep.equal("at paramater stringP3: at array index 1: failure");
  });

  it("type is a SchemaType instance", function() {
    const data = { A: { numP: 111 }, B: {} };
    const { ok, value } = manager.value("schema3", data);
    expect(ok).to.equal(true);
    expect(value).to.deep.equal({ A: { stringP1: "Hello", numP: 111 }, B: { stringP3: [] } });
  });

  it("type is schema", function() {
    const data = { A: { numP: 111 }, B: {} };
    const { ok, value } = manager.value("schema4", data);
    expect(ok).to.equal(true);
    expect(value).to.deep.equal({ A: { stringP1: "Hello", numP: 111 }, B: { stringP3: [] } });
  });

  it("type is schema[]", function() {
    const data = { C: [{ numP: 111 }, { numP: 222 }], D: [{}, { stringP3: ["666"] }] };
    const { ok, value } = manager.value("schema4", data);
    expect(ok).to.equal(true);
    expect(value).to.deep.equal({
      C: [{ stringP1: "Hello", numP: 111 }, { stringP1: "Hello", numP: 222 }],
      D: [{ stringP3: [] }, { stringP3: ["666"] }],
    });
  });

  it("forEach", function() {
    const schemas: string[] = [];
    manager.forEach((_, key) => {
      schemas.push(key);
    });
    expect(schemas.length).to.equal(4);
  });
});
