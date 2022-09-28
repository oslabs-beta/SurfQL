// Parser V1 workflow:
// 1. Use node fs to read a schema file, which returns the file in text string.
// 2. Pass the string into the parser module and it will return an array of root objects.
// The rootObject.name == graphql schema type name.
// The rootObject.fields is an object which has all info for the fields of this type (as keys)
// and data type for the field (as value for the key).

//Parser V2:
//able to skip front lines
//return field info.
//return an object for autocomplete and an array for display (can definitely simplify)

//Parser V3:
//Takes in Mutation and Query type.
//Handling Interface

class Root {
  name: string;
  fields: any;
  interface: string | null;
  constructor(val: string, interfaceVal: string | null) {
    this.name = val;
    this.fields = {};
    this.interface = interfaceVal;
  }
};

class Enum {
  name: string;
  value: string[];
  constructor(val: string) {
    this.name = val;
    this.value = [];
  }
};

//build root variable, nameBuilder works for type and interface
function nameBuilder(string: string): [string, string | null] {
  const cleanstr = string.trim();
  if (cleanstr.includes(" ")) {
    const [variable, mid, interfaceVal] = cleanstr.split(" ");
    return [variable, interfaceVal];
  } else {
    let variable = cleanstr;
    return [variable, null];
  }
}

//use the function to build field and return array of [variable, current ending+1]
function fieldBuilder(string: string) {
  //determine whether it is mutation resolver function, see if ( exists
  if (string.indexOf("(") > -1) {
    // it may be a resolver function that contains '(' and ')'
    let resArr = string.split("(");
    const variable = `${resArr[0].trim()}()`;
    //split again by closing ) and save the second part
    const lastIndex = string.lastIndexOf(":");
    const typeInfo = `${string.slice(lastIndex + 1)}`;
    return [variable, typeInfo];
  } else {
    // it's a regular type field
    const arr = string.split(":");
    if (arr.length === 2) {
      const variable = arr[0].trim();
      const typeInfo = arr[1].trim();
      return [variable, typeInfo];
    } else {
      return [undefined];
    }
  }
}

function parsingTypeInfo(string: string) {
  //remove [ ] or ! if any
  const cleanStr = string.trim();
  let parsedType = "";
  let i = 0;
  if (cleanStr[0] === "[") {
    //means it is a defined type
    i = 1;
  }
  while (
    i < cleanStr.length &&
    cleanStr[i] !== "]" &&
    cleanStr[i] !== "!" &&
    cleanStr[i] !== " "
  ) {
    parsedType += cleanStr[i++];
  }
  return parsedType;
};



export default function parser(text: string) {
  //declare schema types
  const schema = [];
  //declare root array to story the root queries
  const root: Array<any> = [];
  //declare query type and mutation type
  const queryMutation: Array<Root> = [];
  //declare a enum array
  const enumArr: Array<Enum> = [];
  //declare a input array
  const inputArr: Array<Root> = [];

  //build up the constants
  const typeIndex = 4;
  const inputIndex = 5;
  const interfaceIndex = 9;
  const enumIndex = 4;
  
  //declare status for parsing type, interface input
  let parsing = false;
  //declare status for checking parsing Enum
  let parsingEnum = false;
  //declare status for checking parsing Input
  let parsingInput = false;


  let currentArr = 'root';
  //when parsing initialized, build the right Object and push to the right array
  function typeSlicer(strEnd: number, cleanline: string) {
    const [variable, interfaceVal] = nameBuilder(cleanline.slice(strEnd));
    if (parsing) {
      const newRoot: Root = new Root(variable, interfaceVal);
      if (variable.toLowerCase() === 'query') {
        queryMutation.push(newRoot);
        currentArr = 'queryMutation';
      } else if (variable.toLowerCase() === 'mutation') {
        queryMutation.push(newRoot);
        currentArr = 'queryMutation';
      } else {
        root.push(newRoot);
        currentArr = 'root';
      }
    } else if (parsingEnum) {
      const newEnum: Enum = new Enum(variable);
      enumArr.push(newEnum);
      currentArr = 'enum';
    } else if (parsingInput) {
      const newRoot: Root = new Root(variable, interfaceVal);
      inputArr.push(newRoot);
      currentArr = 'input';
    }
    curRoot = variable;
  }

  
  //start parsing--->//
  const arr = text.split(/\r?\n/);
  //read through line by line, conditional check
  let curRoot: string = "";
  arr.forEach((line) => {
    const cleanline = line.trim();
    //check what type it is parsing now
    if (parsingEnum) {
      if (cleanline[0] === "}") {
        parsingEnum = false; 
      } else if (cleanline.trim().length === 0) {
        //do nothing
      } else {
        if (currentArr === 'enum') {
          enumArr[enumArr.length - 1].value.push(cleanline);
        }
      }
    };
    if (parsingInput) {
      if (cleanline[0] === "}") {
        parsingInput = false;
      } else if (cleanline.trim().length === 0) {
        //do nothing
      } else {
        const [variable, typeInfo] = fieldBuilder(cleanline);
        if (variable && typeInfo) {
          inputArr[inputArr.length - 1].fields[variable] = parsingTypeInfo(typeInfo);
        }
      }
    };
    if (parsing) { //parsing query, mutation, interface, or regular type
      if (cleanline[0] === "}") {
        parsing = false;
      } else if (cleanline.trim().length === 0) {
        //do nothing
      } else {
        const [variable, typeInfo] = fieldBuilder(cleanline);
        if (variable && typeInfo) {
          if (currentArr === 'queryMutation') {
            queryMutation[queryMutation.length - 1].fields[variable] = parsingTypeInfo(typeInfo);
          } else {
            root[root.length - 1].fields[variable] = parsingTypeInfo(typeInfo);
          }
        }
      }
    } else { //parsing the field within a type
      if (cleanline.slice(0, typeIndex) === "type") {
        parsing = true;
        typeSlicer(typeIndex, cleanline);
      } else if (cleanline.slice(0, inputIndex) === "input") {
        parsingInput = true;
        typeSlicer(inputIndex, cleanline);
      } else if (cleanline.slice(0, interfaceIndex) === "interface") {
        parsing = true;
        typeSlicer(interfaceIndex, cleanline);
      } else if (cleanline.slice(0, enumIndex) === "enum") {
        parsingEnum = true;
        typeSlicer(enumIndex, cleanline);
      }
    };
  });

  console.log(root, queryMutation, enumArr, inputArr);
  return [root, queryMutation, enumArr, inputArr];
};
