
class Root { //Class for regular, query, mutation, interface type
  name: string;
  fields: any;
  interface: string | null;
  constructor(val: string, interfaceVal: string | null) {
    this.name = val;
    this.fields = {};
    this.interface = interfaceVal;
  }
};

class Enum { //class for enumeration type
  name: string;
  value: string[];
  constructor(val: string) {
    this.name = val;
    this.value = [];
  }
};

class FieldInfo { //class for the field of the Root class
  returnType: string;
  arguments: any;
  constructor(type: string, argArr: null | Array<SingleArg>) {
    this.returnType = type;
    this.arguments = argArr;
  };
}

class SingleArg { //class for the argument of rht field class
  argName: string;
  inputType: string;
  defaultValue: string;
  constructor(name: string, type: string, defaultt: string | null) {
    this.argName = name;
    this.inputType = type;
    this.defaultValue= defaultt;
  }
};

class Input { //class for input type
  name: string;
  fields: any;
  constructor(val: string) {
    this.name = val;
    this.fields = {};
  }
};

class Union {
  name: String;
  options: Array<any>;
  constructor(val: String, optionArray: Array<any>) {
    this.name = val;
    this.options = optionArray;
  }
}

//build root Object, nameBuilder works for type and interface
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

//FieldBuilder for root Object, use the function to build field and return array of [variable, current ending+1]
function fieldBuilder(string: string): Array<any> {
  //determine whether it has a argument/it is mutation type
  if (string.indexOf("(") > -1) {
    // it may be a resolver function that contains '(' and ')'
    let resArr = string.split("(");
    const fieldName = `${resArr[0].trim()}`;
    //split again by closing ) and save the second part
    const lastIndex = string.lastIndexOf(":");
    const typeInfo = `${string.slice(lastIndex + 1)}`;
    //grab the argument text and parse it
    const totalArgtext = resArr[1].split(')')[0].trim();
    const argArr = buildArgArr(totalArgtext);
    return [fieldName, typeInfo, argArr];
  } else {
    // it's a regular type field
    const arr = string.split(":");
    if (arr.length === 2) {
      const fieldName = arr[0].trim();
      const typeInfo = arr[1].trim();
      return [fieldName, typeInfo, null];
    } else {
      return [undefined, undefined, undefined];
    }
  }
}

//helper function to build argsArr from argText
function buildArgArr(totalArg: string): Array<SingleArg> {
  const result = [];
  let argName = "";
  let returnType = "";
  let defaultt = "";
  let parsingType = false;
  let parsingDefault = false;
  for (let i = 0; i < totalArg.length; i++) {
    if (totalArg[i] === ":") {
      parsingType = true;
    } else if (totalArg[i] === "=") {
      parsingDefault = true;
      parsingType = false;
    } else if (totalArg[i] === ",") {
      const newArg = new SingleArg(argName, returnType, defaultt.length === 0 ? null: defaultt);
      result.push(newArg);
      parsingDefault = false;
      parsingType = false;
      argName = "";
      returnType = "";
      defaultt = "";
    } else {
      if (totalArg[i] !== " ") {
        if (parsingType) {
          returnType += totalArg[i]; 
        } else if (parsingDefault) {
          defaultt += totalArg[i];
        } else {
          argName += totalArg[i];
        }
      }
    }
  }
  const newArg = new SingleArg(argName, returnType, defaultt.length === 0 ? null: defaultt);
  result.push(newArg);
  parsingDefault = false;
  parsingType = false;
  return result;
}

//fieldbuilder for Input type fields.
function inputFieldBuilder(string: string) {
  const arr = string.split(":");
  if (arr.length === 2) {
    const variable = arr[0].trim();
    const typeInfo = arr[1].trim();
    return [variable, typeInfo];
  }
};

//helper function to parsing returned Type for the field, cleaning up the bracket.
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
  const inputArr: Array<Input> = [];
  //declare a scale array
  const scalarArr: Array<String> = [];
  //declare a union array
  const unionArr: Array<Union> = [];

  //build up the constants
  const typeIndex = 4;
  const inputIndex = 5;
  const interfaceIndex = 9;
  const enumIndex = 4;
  const scalarIndex = 6;
  const unionIndex = 5;
  
  //declare status for parsing type, interface input
  let parsing = false;
  //declare status for checking parsing Enum
  let parsingEnum = false;
  //declare status for checking parsing Input
  let parsingInput = false;
  //declare status for checking parsing Scalar
  let parsingScalar = false;
  //declare status for checking parsing Union
  let parsingUnion = false;


  let currentArr = 'root';
  //when parsing initialized, build the right Object and push to the right array
  function typeSlicer(strEnd: number, cleanline: string) {
    // const [variable, interfaceVal] = nameBuilder(cleanline.slice(strEnd));
    if (parsing) {
      const [variable, interfaceVal] = nameBuilder(cleanline.slice(strEnd));
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
      const [variable, interfaceVal] = nameBuilder(cleanline.slice(strEnd));
      const newEnum: Enum = new Enum(variable);
      enumArr.push(newEnum);
      currentArr = 'enum';
    } else if (parsingInput) {
      const [variable, interfaceVal] = nameBuilder(cleanline.slice(strEnd));
      const newInput: Input = new Input(variable);
      inputArr.push(newInput);
      currentArr = 'input';
    } else if (parsingScalar) {
      const [variable, interfaceVal] = nameBuilder(cleanline.slice(strEnd));
      scalarArr.push(variable);
      parsingScalar = false;
    } else if (parsingUnion) {
      console.log('union line', cleanline.slice(strEnd));
      const [unionName, optionArray] = unionCreator(cleanline.slice(strEnd));
      const newUnion = new Union(unionName.trim(), optionArray);
      unionArr.push(newUnion);
      parsingUnion = false;
    } 
  }

  function unionCreator(str: String): [String, Array<any>] {
    const [unionName, options] = str.replace(' ', '').split('=');
    const optionArray = options.split('|').map(el => el.trim());
    return [unionName, optionArray];
  }
  
  //start parsing--->//
  const arr = text.split(/\r?\n/);
  //read through line by line, conditional check
  let curRoot: string = "";
  arr.forEach((line) => {
    const cleanline1 = line.trim();
    const cleanline = cleanline1.split('//')[0];
    if(cleanline[0] === "#" || cleanline[0] === "/"){
      //do nothing
    };
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
        const [variable, typeInfo] = inputFieldBuilder(cleanline);
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
        const [fieldName, typeInfo, argArr] = fieldBuilder(cleanline);
        if (fieldName && typeInfo) {
          const parsedType = parsingTypeInfo(typeInfo);
          const newField = new FieldInfo(parsedType, argArr);
          if (currentArr === 'queryMutation') {
            queryMutation[queryMutation.length - 1].fields[fieldName] = newField;
          } else {
            root[root.length - 1].fields[fieldName] = newField;
          }
        }
      }
    } else { //looking for the special initiator keywords
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
      } else if (cleanline.slice(0, scalarIndex) === "scalar") {
        parsingScalar = true;
        typeSlicer(scalarIndex, cleanline);
      } else if (cleanline.slice(0, unionIndex) === "union") {
        console.log(cleanline);
        parsingUnion = true;
        typeSlicer(unionIndex, cleanline);
      }
    };
  });

  return [root, queryMutation, enumArr, inputArr, scalarArr, unionArr];
};
