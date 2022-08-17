//The parser function takes in a string which is from the readFile.
//You can require the module in other files.

const parser = (text) => {
    //split the text into array lines
    const arr = text.split(/\r?\n/);
    //declare root array to story the root queries
    const root = [];
    //read through line by line, conditional check
    arr.forEach(line => {
        //check if the first 4 char === type, if so, create a instance of tree, push to root
        //if type, push Variable to Root array
        //and push the varible to Variable Obj. property = property, value = type
        //end when parathethis ends
        if (line.slice(0,4) === 'type') {
            const variable = rootBuilder(line.slice(4));
            const newRoot = new Root(variable);
            root.push(newRoot)
        } else if (line[0] === '}' || line.trim().length == 0){
            //do nothing
        } else {
            const [variable, typeInfo] = fieldBuilder(line);
            root[root.length-1].fields[variable] = typeInfo;
        }
    })
    console.log(root);
    return root
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
        if (cleanstr[i] == ' ') return variable;
        variable += cleanstr[i];
    }
    return variable
}

//use the function to build field and return array of [variable, current ending+1]
function fieldBuilder(string) {
    const arr = string.split(':');
    if (arr.length == 2) {
        const variable = arr[0].trim();
        const typeInfo = arr[1].trim();
        return [variable, typeInfo]
    } else {
        return undefined;
    }

}



module.exports = parser;