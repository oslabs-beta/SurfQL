// Parser V1 workflow:
// 1. Use node fs to read a schema file, which returns the file in text string.
// 2. Pass the string into the parser module and it will return an array of root objects. 
// The rootObject.name == graphql schema type name.
// The rootObject.fields is an object which has all info for the fields of this type (as keys) 
// and data type for the field (as value for the key).

//Parser V2:
//able to skip front lines
//return field info.

function Root(val) {
    this.name = val;
    this.fields = {};
}


//build root variable
function rootBuilder(string) {
    const cleanstr = string.trim();
    let variable = '';
    for (let i = 0; i < cleanstr.length; i++) {
        if (cleanstr[i] === ' ') {
            return variable;
        };
        variable += cleanstr[i];
    }
    return variable;
}

//use the function to build field and return array of [variable, current ending+1]
function fieldBuilder(string) {
    const arr = string.split(':');
    if (arr.length === 2) {
        const variable = arr[0].trim();
        const typeInfo = arr[1].trim();
        return [variable, typeInfo];
    } else {
        return [undefined, undefined];
    }
}

function parsingTypeInfo(string) {
    const cleanStr = string.trim();
    let parsedType = '';
    let i = 0;
    if (cleanStr[0] === '[') {
        //means it is a defined type
        i = 1;
    };
    while (i < cleanStr.length && cleanStr[i] !== ']' &&  cleanStr[i] !== '!' &&  cleanStr[i] !== ' ') {
        parsedType += cleanStr[i++];
    };
    return parsedType;
}

const parser = (text) => {
    //split the text into array lines
    const arr = text.split(/\r?\n/);
    //declare status for building, only start reading when type starts
    let parsing = false;
    //declare schema types
    const schema = [];
    //declare root array to story the root queries
    const root = [];
    //declare query type and mutation type
    const query = [];
    const mutation = [];
    //read through line by line, conditional check
    arr.forEach(line => {
        const cleanline = line.trim();
        if (cleanline.slice(0,4) === 'type') {
            parsing = true;
            const variable = rootBuilder(cleanline.slice(4));
            const newRoot = new Root(variable);
            root.push(newRoot);
        } else if (cleanline[0] === '}' || cleanline.trim().length === 0){
            //do nothing
        } else {
            if (parsing) {
                const [variable, typeInfo] = fieldBuilder(cleanline);
                if (variable && typeInfo) {
                    root[root.length-1].fields[variable] = parsingTypeInfo(typeInfo);
                }
            }
        }
    })
    console.log(root);
    return root;
};



module.exports = parser;