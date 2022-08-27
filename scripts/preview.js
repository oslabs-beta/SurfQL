//document on load

document.addEventListener("DOMContentLoaded", () => {
  //get board element
  const board = document.querySelector("#board");

  //add a static message
  board.innerHTML = "Grow a beautiful tree";

  const vscode = acquireVsCodeApi();
  function getSchematext() {
    vscode.postMessage({
      command: "get schema text",
    });
  }
  getSchematext();
});

//add eventListener to the window
window.addEventListener("message", (event) => {
  const message = event.data;
  console.log("message2", event);
  const text = message.text;
  console.log(text);
  //call parser
  if (message.command === "sendText") {
    const schemaArr = parser(text);
    console.log(schemaArr);
    //TODO: use schemaObj to create DOM elements
    draw(schemaArr);
    return;
  }
});

//parser function below
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
// function fieldBuilder(string) {
//   const arr = string.split(":");
//   if (arr.length === 2) {
//     const variable = arr[0].trim();
//     const typeInfo = arr[1].trim();
//     return [variable, typeInfo];
//   } else {
//     return [undefined];
//   }
// }

function fieldBuilder(string) {
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
};

// //display function
function draw(array) {
  const tree = document.createElement("div");
  tree.setAttribute("class", "tree");
  board.appendChild(tree);
  //create root ul
  const treeUL = document.createElement("ul");
  tree.appendChild(treeUL);
  //for every root in array we create a list item
  array.forEach((root) => {
    const li = document.createElement("li");
    li.setAttribute("data-fields", JSON.stringify(root.fields));
    li.setAttribute("class", "queryType-alt");
    li.innerHTML = `<span>${root.name}</span>`;
    //create childUL
    const childUl = document.createElement("ul");
    childUl.setAttribute("class", "fieldGroup");
    for (const field in root.fields) {
      //create buttons within li
      const childLi = document.createElement("li");
      const btn = document.createElement("button");
      childLi.setAttribute("class", "fieldType-alt");
      btn.textContent = `${field}:${root.fields[field]}`;
      //append to list item
      childLi.appendChild(btn);
      childUl.appendChild(childLi);
      //hide children initially
      childUl.hidden = true;
      //TODO: eventlistener here
      btn.addEventListener('click', function(e) {
        //check root.fields[field] === int, str, boolean, do nothing
        e.stopPropagation();
        const parent = e.target.parentNode;
        const [field, fieldtype] = parent.textContent.split(':');
        console.log(field, fieldtype);
        //if not, return root.field, add nested structure
        console.log(array);
        array.forEach(e => {
          if (fieldtype === e.name) {
            console.log(e);
            drawNext(array, btn, e);
          }
        });
      });
    }
    li.appendChild(childUl);
    li.addEventListener("click", function (e) {
      //locate children
      const children = this.querySelector("ul");
      children.hidden = !children.hidden;
    });
    treeUL.appendChild(li);
    //console.log(root);
  });
  return;
};

//function draw the next level fields
function drawNext(array, node, rootObj) {
  console.log('drawNext, -> ', array, node, rootObj);
  //create childUL
  const childUl = document.createElement("ul");
  childUl.setAttribute("class", "fieldGroup");
  for (const field in rootObj.fields) {
    //create buttons within li
    const childLi = document.createElement("li");
    const btn = document.createElement("button");
    childLi.setAttribute("class", "fieldType-alt");
    btn.textContent = `${field}:${rootObj.fields[field]}`;
    //append to list item
    childLi.appendChild(btn);
    childUl.appendChild(childLi);
    //hide children initially
    // childUl.hidden = true;
    btn.addEventListener('click', function(e) {
      //check root.fields[field] === int, str, boolean, do nothing
      e.stopPropagation();
      const parent = e.target.parentNode;
      const [field, fieldtype] = parent.textContent.split(':');
      console.log(field, fieldtype);
      //if not, return root.field, add nested structure
      console.log(array);
      array.forEach(e => {
        if (fieldtype === e.name) {
          drawNext(array, btn, e);
        }
      });
    });
  }
  node.appendChild(childUl);
  return;
}

//parsingFieldTypeInfor
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
