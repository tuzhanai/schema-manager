/**
 * @gz/schema-manager
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 * @author Yourtion Guo <yourtion@gmail.com>
 */

import * as assert from "assert";
import { ValueTypeManager } from "@tuzhanai/value-type-manager";
export * from "@tuzhanai/value-type-manager";

// Scheam 的类型结构
export interface ISchemaTypeFields {
  [name: string]: ISchemaTypeFieldInfo;
}

// Scheam 字段的详细信息
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
  /** 缺少的参数列表 */
  missingParamaters?: string[];
  /** 错误的参数列表 */
  invalidParamaters?: string[];
  /** 错误的参数类型列表 */
  invalidParamaterTypes?: string[];
  /** 结果 */
  value: any;
}

export interface SchemaManagerOptions {
  /* 自定义ValueTypeManager实例 */
  type?: ValueTypeManager;
  /** 如果为true则解析时遇到第一个错误即停止接续解析 */
  abortEarly?: boolean;
}

export class SchemaManager {
  protected readonly map: Map<string, SchemaType> = new Map();
  public readonly type: ValueTypeManager;

  constructor(protected readonly options: SchemaManagerOptions = {}) {
    if (options.type) {
      this.type = options.type;
    } else {
      this.type = new ValueTypeManager();
    }
  }

  /**
   * 获取 abortEarly 选项
   */
  public get isAbortEarly(): boolean {
    return this.options.abortEarly || false;
  }

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
   * 遍历类型
   * @param iter 迭代函数
   */
  public forEach(iter: (value: SchemaType, key: string, map: Map<string, SchemaType>) => void) {
    return this.map.forEach(iter);
  }

  /**
   * 创建Schema但不自动注册
   * @param fields 字段信息
   * @param name Schema名称
   */
  public create(fields: ISchemaTypeFields, name?: string): SchemaType {
    return new SchemaType(this, fields, name);
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
    const ret = this.baseTypeValue(name, isArray, input, {}, undefined);
    if (ret.ok) return ret;
    return { ...ret, missingParamaters: [], invalidParamaters: [], invalidParamaterTypes: [] };
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
          if (this.isAbortEarly) break;
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
      this.name && `Pick<${this.name}, ${fieldNames.map((n) => `"${n}"`).join(" | ")}>`,
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
   * 从当前Schema获取所有字段为必填的新Schema
   */
  public required(): SchemaType {
    const fields: ISchemaTypeFields = {};
    for (const n in this.fields) {
      fields[n] = { ...this.fields[n], required: true };
    }
    return new SchemaType(this.manager, fields, this.name && `Required<${this.name}>`);
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
          if (this.manager.isAbortEarly) break;
        }
        values.push(ret.value);
      }
      if (messages.length > 0) {
        return { ok: false, message: messages.join("\n"), value: values };
      }
      return { ok: true, message: "success", value: values };
    }

    const messages: string[] = [];
    const missingParamaters: string[] = [];
    const invalidParamaters: string[] = [];
    const invalidParamaterTypes: string[] = [];
    const values: Record<string, any> = {};
    // 遍历处理输入的 input 信息，与 对应的 Schema Type 的配置进行比较
    for (const n in this.fields) {
      const f = this.fields[n];
      const v = input[n] === undefined ? f.default : input[n];

      // 判断是否缺失某个字段
      if (v === undefined) {
        if (f.required) {
          messages.push(`missing required paramater ${n}`);
          missingParamaters.push(n);
          if (this.manager.isAbortEarly) break;
        }
        // 没有该字段，直接循环下一个 字段
        continue;
      }

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
        invalidParamaters.push(n);
        invalidParamaterTypes.push(f.type instanceof SchemaType ? f.type.name : f.type);
        if (this.manager.isAbortEarly) break;
      }
      values[n] = ret.value;
    }
    if (messages.length > 0) {
      return {
        ok: false,
        message: messages.join("\n"),
        missingParamaters,
        invalidParamaters,
        invalidParamaterTypes,
        value: values,
      };
    }
    return { ok: true, message: "success", value: values };
  }

  /**
   * 获取 schema swagger 的展开信息
   * @param {boolean} [isArray=false]
   * @returns {Record<string, any>} ISchemaTypeFieldInfo
   * @memberof SchemaType
   */
  public swaggerValue(): {
    required: Array<string>;
    properties: Record<string, any>;
  } {
    const values: Record<string, any> = {};
    const required: Array<string> = [];
    for (const n in this.fields) {
      const f = this.fields[n];
      values[n] = {};
      // 判断是否是嵌套的 Schema
      if (f.type instanceof SchemaType) {
        let { required, properties } = f.type.swaggerValue();
        values[n] = {
          type: "object",
          required: required,
          properties: properties,
        };
      } else {
        const { name, isArray } = parseTypeName(f.type);
        if (this.manager.has(name) && isArray) {
          let { required, properties } = this.manager.get(name).swaggerValue();
          values[n].type = "array";
          values[n].description = f.comment || "";
          values[n].items = {
            type: "object",
            required: required,
            properties: properties,
          };
        } else if (this.manager.has(name)) {
          let { required, properties } = this.manager.get(name).swaggerValue();
          values[n] = {
            type: "object",
            required: required,
            description: f.comment || "",
            properties: properties,
          };
        } else if (isArray) {
          values[n] = {
            type: "array",
            description: f.comment,
            enum: f.params || [],
            items: {
              type: this.manager.type.get(name).info.swaggerType,
            },
          };
          f.default ? (values[n].default = f.default) : "";
          f.required ? required.push(n) : "";
        } else {
          values[n] = {
            type: this.manager.type.get(name).info.swaggerType,
            description: f.comment,
            enum: f.params || [],
          };
          f.default ? (values[n].default = f.default) : "";
          f.required ? required.push(n) : "";
        }
      }
    }
    return {
      required,
      properties: values,
    };
  }
}

/**
 * 解析类型名称 判断在书写类型的时候 是否是 "type[]" 这种格式，是否是数组类型
 * @param type 类型
 */
export function parseTypeName(type: string): { name: string; isArray: boolean } {
  if (type.slice(-2) === "[]") {
    return { name: type.slice(0, -2), isArray: true };
  }
  return { name: type, isArray: false };
}

export default SchemaManager;
