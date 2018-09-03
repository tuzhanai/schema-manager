/**
 * @tuzhanai/schema-manager
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import * as assert from "assert";
import ValueTypeManager from "@tuzhanai/value-type-manager";
export * from "@tuzhanai/value-type-manager";

export interface ISchemaTypeFields {
  [name: string]: ISchemaTypeFieldInfo;
}

export interface ISchemaTypeFieldInfo {
  /** 数据类型 */
  type: string | SchemaType;
  /** 备注 */
  comment?: string;
  /** 是否格式化 */
  format?: boolean;
  /** 默认值 */
  default?: any;
  /** 是否必须 */
  required?: boolean;
  /** 类型参数 */
  params?: any;
}

export interface ISchemaCheckResult {
  /** 是否成功 */
  ok: boolean;
  /** 如果失败，此项为出错信息 */
  message: string;
  /** 结果 */
  value: any;
}

export interface SchemaManagerOptions {}

export class SchemaManager {
  protected readonly map: Map<string, SchemaType> = new Map();
  public readonly type: ValueTypeManager = new ValueTypeManager();

  constructor(protected readonly options: SchemaManagerOptions = {}) {}

  /**
   * 注册Schema
   * @param name 名称
   * @param fields 字段具体信息
   */
  public register(name: string, fields: ISchemaTypeFields): this {
    this.map.set(name, new SchemaType(this, fields, name));
    return this;
  }

  /**
   * 是否已注册指定Schema
   * @param type 名称
   */
  public has(type: string): boolean {
    return this.map.has(type);
  }

  /**
   * 获取指定Schema
   * @param type 名称
   */
  public get(type: string): SchemaType {
    const s = this.map.get(type);
    assert.ok(s, `schema type "${type}" does not exists`);
    return s!;
  }

  /**
   * 检查指定Schema并返回值
   * @param type 名称
   * @param input 输入值
   */
  public value(type: string, input: any): ISchemaCheckResult {
    const { name, isArray } = parseTypeName(type);
    if (this.has(name)) {
      return this.get(type).value(input, isArray);
    }
    return this.baseTypeValue(name, isArray, input, {}, undefined);
  }

  /**
   * 检查指定基本类型并返回值
   * @param type 名称
   * @param isArray 是否为数组
   * @param input 输入值
   * @param params 类型参数
   * @param format 是否格式化
   */
  public baseTypeValue(type: string, isArray: boolean, input: any, params: any, format?: boolean): ISchemaCheckResult {
    if (isArray) {
      // 数组
      if (!Array.isArray(input)) {
        return { ok: false, message: `expected an ${type} array but got ${input}`, value: input };
      }
      const messages: string[] = [];
      const values: any[] = [];
      for (let i = 0; i < input.length; i++) {
        const ret = this.type.value(type, input[i], params, format);
        if (!ret.ok) {
          messages.push(`at array index ${i}: ${ret.message}`);
        }
        values.push(ret.value);
      }
      if (messages.length > 0) {
        return { ok: false, message: messages.join("\n"), value: values };
      }
      return { ok: true, message: "success", value: values };
    }

    return this.type.value(type, input, params, format);
  }
}
export class SchemaType {
  constructor(
    protected manager: SchemaManager,
    protected readonly fields: ISchemaTypeFields,
    public readonly name: string = "",
  ) {}

  /**
   * 从当前Schema获取仅包含指定字段的新Schema
   * @param fieldNames
   */
  public pick(...fieldNames: string[]): SchemaType {
    fieldNames.sort();
    const fields: ISchemaTypeFields = {};
    for (const n of fieldNames) {
      fields[n] = this.fields[n];
    }
    return new SchemaType(
      this.manager,
      fields,
      this.name && `Pick<${this.name}, ${fieldNames.map(n => `"${n}"`).join(" | ")}>`,
    );
  }

  /**
   * 从当前Schema获取所有字段为可选的新Schema
   */
  public partial(): SchemaType {
    const fields: ISchemaTypeFields = {};
    for (const n in this.fields) {
      fields[n] = { ...this.fields[n], required: false };
    }
    return new SchemaType(this.manager, fields, this.name && `Partial<${this.name}>`);
  }

  /**
   * 检查Schema并返回值
   * @param input
   */
  public value(input: any, isArray: boolean = false): ISchemaCheckResult {
    if (isArray) {
      // 数组
      if (!Array.isArray(input)) {
        return { ok: false, message: `expected an ${this.name} array but got ${input}`, value: input };
      }
      const messages: string[] = [];
      const values: any[] = [];
      for (let i = 0; i < input.length; i++) {
        const ret = this.value(input[i], false);
        if (!ret.ok) {
          messages.push(`at array index ${i}: ${ret.message}`);
        }
        values.push(ret.value);
      }
      if (messages.length > 0) {
        return { ok: false, message: messages.join("\n"), value: values };
      }
      return { ok: true, message: "success", value: values };
    }

    const messages: string[] = [];
    const values: Record<string, any> = {};
    for (const n in this.fields) {
      const f = this.fields[n];
      if (n in input) {
        // 尝试解析值
        const v = input[n];
        let ret: ISchemaCheckResult;
        if (f.type instanceof SchemaType) {
          ret = f.type.value(v);
        } else {
          const { name, isArray } = parseTypeName(f.type);
          if (this.manager.has(name)) {
            ret = this.manager.get(name).value(v, isArray);
          } else {
            ret = this.manager.baseTypeValue(name, isArray, v, f.params, f.format);
          }
        }
        if (!ret.ok) {
          messages.push(`at paramater ${n}: ${ret.message}`);
        }
        values[n] = ret.value;
      } else {
        // 当输入值不存在时
        if (typeof f.default !== "undefined") {
          // 如果有默认值
          values[n] = f.default;
        } else if (f.required) {
          // 如果为必填项
          messages.push(`missing required paramater ${n}`);
        }
      }
    }
    if (messages.length > 0) {
      return { ok: false, message: messages.join("\n"), value: values };
    }
    return { ok: true, message: "success", value: values };
  }
}

/**
 * 解析类型名称
 * @param type 类型
 */
export function parseTypeName(type: string): { name: string; isArray: boolean } {
  if (type.slice(-2) === "[]") {
    return { name: type.slice(0, -2), isArray: true };
  }
  return { name: type, isArray: false };
}

export default SchemaManager;
