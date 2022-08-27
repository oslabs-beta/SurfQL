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
  //declare root array to story the root queries
  const root = [];
  //read through line by line, conditional check
  arr.forEach((line) => {
    //check if the first 4 char === type, if so, create a instance of Root, push to root
    if (line.slice(0, 4) === "type") {
      //if type, call rootBuilder
      const variable = rootBuilder(line.slice(4));
      const newRoot = new Root(variable);
      root.push(newRoot);
    } else if (line[0] === "}" || line.trim().length === 0) {
      //do nothing
    } else {
      //if not Type or ending, call fieldBuilder
      const [variable, typeInfo] = fieldBuilder(line);
      root[root.length - 1].fields[variable] = typeInfo;
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
function fieldBuilder(string) {
  const arr = string.split(":");
  if (arr.length === 2) {
    const variable = arr[0].trim();
    const typeInfo = arr[1].trim();
    return [variable, typeInfo];
  } else {
    return undefined;
  }
}

// //display function
function draw(array) {
  // array.forEach((el) => {
  //   const block = document.createElement('div');
  //   //create a button, add onclick, when it is clicked, we create children button for each of the key-value pair in el.fields.
  //   const root = document.createElement('botton');
  //   //TODO: add class to the button
  //   root.setAttribute('class', 'queryType');
  //   root.innerHTML = el.name;
  //   root.setAttribute('data-fields', JSON.stringify(el.fields));
  //   block.appendChild(root);
  //   // vanilla dom to add Onclick
  //   root.onclick = function (e) {
  //     const root = e.target;
  //     const fields = JSON.parse(root.dataset.fields);
  //     const block = root.parentNode;
  //     console.log('field parsed back ->', fields);
  //     for (const x in fields) {
  //       const field = document.createElement('button');
  //       //add class to the button
  //       field.setAttribute('class', 'fieldType');
  //       field.innerHTML = `${x}`;
  //       block.appendChild(field);
  //     }
  //   };
  //   board.appendChild(block);
  // });
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
    console.log(root.fields);
    li.innerHTML = `<span>${root.name}</span>`;
    //create childUL
    const childUl = document.createElement("ul");
    childUl.setAttribute("class", "fieldGroup");
    for (const field in root.fields) {
      //create buttons within li
      const childLi = document.createElement("li");
      const btn = document.createElement("button");
      childLi.setAttribute("class", "fieldType-alt");
      btn.textContent = `${field}`;
      //append to list item
      childLi.appendChild(btn);
      childUl.appendChild(childLi);
      //hide children initially
      childUl.hidden = true;
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
}
//   array.forEach((el) => {
//     const block = document.createElement("div");
//     //create a button, add onclick, when it is clicked, we create children button for each of the key-value pair in el.fields.
//     const root = document.createElement("button");
//     //TODO: add class to the button
//     root.setAttribute("class", "queryType");
//     root.innerHTML = el.name;
//     root.setAttribute("data-fields", JSON.stringify(el.fields));

//     block.appendChild(root);
//     // vanilla dom to add Onclick
//     root.onclick = function (e) {
//       const root = e.target;
//       const fields = JSON.parse(root.dataset.fields);
//       const block = root.parentNode;
//       console.log("field parsed back ->", fields);
//       for (const x in fields) {
//         const field = document.createElement("button");
//         //add class to the button
//         field.setAttribute("class", "fieldType");
//         field.innerHTML = `${x}`;
//         block.appendChild(field);
//       }
//     };
//     board.appendChild(block);
//   });
//   return;
// }
