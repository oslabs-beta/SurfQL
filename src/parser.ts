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
  fields: {};
  constructor(val: string) {
    this.name = val;
    this.fields = {} as any;
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

//build root variable
function nameBuilder(string: string) {
  const cleanstr = string.trim();
  let variable = "";
  for (let i = 0; i < cleanstr.length; i++) {
    if (cleanstr[i] === " ") {
      return variable;
    }
    variable += cleanstr[i];
  }
  return variable;
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
    console.log("typeInfo", typeInfo);
    return [variable, typeInfo];
  } else {
    // it's a regular type field
    const arr = string.split(":");
    if (arr.length === 2) {
      const variable = arr[0].trim();
      const typeInfo = arr[1].trim();
      // console.log("a")
      return [variable, typeInfo];
    } else {
      return [undefined];
    }
  }
}

function parsingTypeInfo(string: string) {
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

//helper function to check para.


export default function parser(text: string) {


  //split the text into array lines

  // Creating helper to check where to push the Object. if it is query or mutation, push to queryMutation
  let currentArr = 'root';

  //declare status for parsing type, interface input
  let parsing = false;
  //declare status for checking parsing Enum
  let parsingEnum = false;
  function typeSlicer(strEnd: number, cleanline: string) {
    const variable = nameBuilder(cleanline.slice(strEnd));
    if (parsing) {
      const newRoot: Root = new Root(variable);
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
    }
    curRoot = variable;
    returnObj[curRoot] = {};
  }

  const typeIndex = 4;
  const inputIndex = 5;
  const interfaceIndex = 9;
  const enumIndex = 4;

  const arr = text.split(/\r?\n/);

  //declare schema types
  const schema = [];
  //declare root array to story the root queries
  const root: Array<Root> = [];
  //declare query type and mutation type
  const queryMutation: Array<Root> = [];
  //declare a enum array
  const enumArr: Array<Enum> = [];
  //read through line by line, conditional check
  const returnObj = {} as any;
  let curRoot: string = "";
  arr.forEach((line) => {
    const cleanline = line.trim();
    if (parsingEnum) {
      if (cleanline[0] === "}") {
        parsingEnum = false; //is there situation people put {} in the schema??
      } else if (cleanline.trim().length === 0) {
        //do nothing
      } else {
        if (currentArr === 'enum') {
          enumArr[enumArr.length - 1].value.push(cleanline);
        }
      }
    }
    if (parsing) {
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
            returnObj[curRoot][variable] = parsingTypeInfo(typeInfo);
          }
        }
      }
    } else {
      if (cleanline.slice(0, typeIndex) === "type") {
        parsing = true;
        typeSlicer(typeIndex, cleanline);
      } else if (cleanline.slice(0, inputIndex) === "input") {
        parsing = true;
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
  console.log(root, queryMutation, enumArr);
  return [root, queryMutation, enumArr, returnObj];
};
