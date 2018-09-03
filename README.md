# @tuzhanai/schema-manager

数据 Schema 管理器

## 安装

```bash
npm i @tuzhanai/schema-manager -S
```

## 使用方法

```typescript
import SchemaManager from "@tuzhanai/schema-manager";

const manager new SchemaManager();

// 注册基本类型
manager.type.register("Boolean", {
  checker: (v: any) => typeof v === "boolean" || (typeof v === "string" && validator.isBoolean(v)),
  formatter: (v: any) => String(v).toLowerCase() === "true",
  description: "布尔值",
  tsType: "boolean",
  isBuiltin: true,
  isDefaultFormat: true,
});

// 注册Schema
manager.register("Schema1", {
  field1: {
    type: "String",
    default: "hello, world"
  },
  field2: {
    type: "Boolean",
    default: false
  }
});

// 校验并获得参数值
const { ok, message, value } = manager.value("Schema1", { field1: "xxx", field2: "true"});
// => { ok: true, message: "success", value: { field1: "xxx", field2: true }}
```

## License

```text
MIT License

Copyright (c) 2018 兔展

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
