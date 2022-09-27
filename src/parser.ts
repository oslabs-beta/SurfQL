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

class Root {
  name: string;
  fields: {};
  constructor(val: string) {
    this.name = val;
    this.fields = {} as any;
  }
}

//build root variable
function rootBuilder(string: string) {
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
    //console.log("variable", variable)
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
}

export default function parser(text: string) {
  //split the text into array lines

  // Creating helper function
  function typeSlicer(strEnd: number, cleanline: string) {
    parsing = true;
    const variable = rootBuilder(cleanline.slice(strEnd));
    const newRoot: Root = new Root(variable);
    root.push(newRoot);
    curRoot = variable;
    returnObj[curRoot] = {};
  }

  const typeIndex = 4;
  const inputIndex = 5;
  const interfaceIndex = 9;

  const arr = text.split(/\r?\n/);
  //declare status for building, only start reading when type starts
  let parsing = false;
  //declare schema types
  const schema = [];
  //declare root array to story the root queries
  const root: Array<any> = [];
  //declare query type and mutation type
  const query = [];
  const mutation = [];
  //read through line by line, conditional check
  const returnObj = {} as any;
  let curRoot: string = "";
  arr.forEach((line) => {
    const cleanline = line.trim();
    if (cleanline.slice(0, typeIndex) === "type") {
      typeSlicer(typeIndex, cleanline);
    } else if (cleanline.slice(0, 5) === "input") {
      typeSlicer(inputIndex, cleanline);
    } else if (cleanline.slice(0, 9) === "interface") {
      typeSlicer(interfaceIndex, cleanline);
    } else if (cleanline[0] === "}" || cleanline.trim().length === 0) {
      //do nothing
    } else {
      if (parsing) {
        const [variable, typeInfo] = fieldBuilder(cleanline);
        if (variable && typeInfo) {
          root[root.length - 1].fields[variable] = parsingTypeInfo(typeInfo);
          returnObj[curRoot][variable] = parsingTypeInfo(typeInfo);
        }
      }
    }
  });
  console.log(root);
  return [root, returnObj];
}
