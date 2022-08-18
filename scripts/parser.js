// Parser V1 workflow:
// 1. Use node fs to read a schema file, which returns the file in text string.
// 2. Pass the string into the parser module and it will return an array of root objects. 
// The rootObject.name == graphql schema type name.
// The rootObject.fields is an object which has all info for the fields of this type (as keys) 
// and data type for the field (as value for the key).

const parser = (text) => {
    //split the text into array lines
    const arr = text.split(/\r?\n/);
    //declare root array to story the root queries
    const root = [];
    //read through line by line, conditional check
    arr.forEach(line => {
        //check if the first 4 char === type, if so, create a instance of Root, push to root
        if (line.slice(0,4) === 'type') {
            //if type, call rootBuilder
            const variable = rootBuilder(line.slice(4));
            const newRoot = new Root(variable);
            root.push(newRoot);
        } else if (line[0] === '}' || line.trim().length === 0){
            //do nothing
        } else {
            //if not Type or ending, call fieldBuilder
            const [variable, typeInfo] = fieldBuilder(line);
            root[root.length-1].fields[variable] = typeInfo;
        }
    });
    console.log(root);
    return root;
};

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
        }
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
        return undefined;
    }

}



module.exports = parser;