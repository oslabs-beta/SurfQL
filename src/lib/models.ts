export interface Schema {
  [key: string]: SchemaType;
}

export interface SchemaType {
  [key: string]: Field;
}

interface Field {
  arguments: any; // TODO: Understand parameters to replace the 'any'
  returnType: string;
}

export interface QueryEntry {
  [key: string]: SchemaType | any; // TODO: Understand mutation to replace the 'any'
}
