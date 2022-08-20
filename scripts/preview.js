//document on load

document.addEventListener('DOMContentLoaded', ()=> {
    //get board element
    const board = document.querySelector('#board');

    //add a static message
    board.innerHTML = 'Grow a beautiful tree';

    const vscode = acquireVsCodeApi();
	function getSchematext() {
		vscode.postMessage({
			command: 'get schema text'
		});
	}
	getSchematext();
});

//add eventListener to the window
window.addEventListener('message', event => {
    const message = event.data;
    console.log('message2', event);
    const text = message.text;
    console.log(text);
    //call parser
    if (message.command === 'sendText') {
        const schemaObj = parser(text);
        console.log(schemaObj);
        //TODO: use schemaObj to create DOM elements
        draw(schemaObj);
        return;
    }
});

//parser function below
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


//display function
function draw(array) {
    array.forEach(el => {
        const block = document.createElement('div');
        const root = document.createElement('h4');
        root.innerHTML = el.name;
        block.appendChild(root);
        for (const x in el.fields) {
            const field = document.createElement('li');
            field.innerHTML = `${x} : ${el.fields[x]}`;
            block.appendChild(field);
        };
        board.appendChild(block);
    });
    return;
}

