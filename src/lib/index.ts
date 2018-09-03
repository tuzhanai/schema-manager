/**
 * @tuzhanai/schema-manager
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import ValueTypeManager from "@tuzhanai/value-type-manager";

export interface SchemaManagerOptions {}

export class SchemaManager {
  constructor(protected readonly options: SchemaManagerOptions = {}) {}
}

export default SchemaManager;
