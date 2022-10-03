//document on load

document.addEventListener("DOMContentLoaded", () => {
  //get board element
  const board = document.querySelector("#board");

  //add a static message
  //board.innerHTML = "Grow a beautiful tree";

  const vscode = acquireVsCodeApi();
  function getSchematext() {
    vscode.postMessage({
      command: "get schema text",
    });
  }
  getSchematext();

  const refreshBtn = document.querySelector("#refresh");
  refreshBtn.addEventListener("click", (e) => {
    board.innerHTML = "";
    getSchematext();
  });
});

//add eventListener to the window
window.addEventListener("message", (event) => {
  const message = event.data;
  // console.log("message2", event);
  const text = message.text;
  //call parser
  if (message.command === "sendSchemaInfo") {
    // const [schemaArr, returnObj] = parser(text);
    const [schemaArr, queryMutation, enumArr, inputArr] = JSON.parse(
      message.text
    );
    console.log("here it comes", [schemaArr, queryMutation, enumArr, inputArr]);
    draw(queryMutation, schemaArr, enumArr, inputArr);
    return;
  }
});

// //display function
function draw(qmArr, schemaArr, enumArr, inputArr) {
  //create enumLeaf array for check type logic
  const enumLeaf = [];
  enumArr.forEach((e) => {
    enumLeaf.push(e.name);
  });
  const scalarTypes = ["Int", "Float", "String", "Boolean", "ID"];

  //first div called Entry to demo query and mutation info
  const entry = document.createElement("div");
  entry.setAttribute("class", "tree");
  board.appendChild(entry);
  const category = document.createElement("h3");
  category.innerHTML = "Entry Points";
  entry.appendChild(category);
  //create entry list ul
  const entryUL = document.createElement("ul");
  entry.appendChild(entryUL);
  //for every root in array we create a list item
  qmArr.forEach((root) => {
    const rootDisplay = document.createElement("li");
    rootDisplay.setAttribute("class", "queryType-alt");
    rootDisplay.innerHTML = `<span>${root.name}</span>`;
    //create fieldDisplay
    const fieldDisplay = document.createElement("ul");
    fieldDisplay.setAttribute("class", "fieldGroup");
    for (const field in root.fields) {
      //create a li for each key-value pair in the field.
      const childLi = document.createElement("li");
      childLi.setAttribute("class", "fieldType-alt");
      //May not need to check the type since it is entry. but, keep for now.
      if (scalarTypes.includes(root.fields[field].returnType)) {
        childLi.textContent = `${field}:${root.fields[field].returnType}`;
      } else if (enumLeaf.includes(root.fields[field].returnType)) {
        childLi.textContent = `${field}:${root.fields[field].returnType}`;
        childLi.setAttribute("font-weight", "600");
      } else {
        //create buttons within li
        const btn = document.createElement("button");
        btn.textContent = `${field}:${root.fields[field].returnType}`;
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          const parent = e.target.parentNode;
          //grab typeinfo from parent node.
          const [field, fieldtype] = parent.textContent.split(":");

          schemaArr.forEach((e) => {
            if (fieldtype === e.name) {
              drawNext(schemaArr, btn, e, enumLeaf); 
            }
          });
        });
        childLi.appendChild(btn);
      }
      //append to list fieldDisplay
      fieldDisplay.appendChild(childLi);
      //hide children initially
      fieldDisplay.hidden = true;
      //TODO: eventlistener here
      
    }

    //append field display to root
    rootDisplay.appendChild(fieldDisplay);
    rootDisplay.addEventListener("click", function (e) {
      const children = this.querySelector("ul");
      children.hidden = !children.hidden;
    });
    //append rootDisplay to entry
    entryUL.appendChild(rootDisplay);

  });

  //Second div to save input type
  const inputBox = document.createElement("div");
  inputBox.setAttribute("class", "tree");
  board.appendChild(inputBox);
  const category2 = document.createElement("h3");
  category2.innerHTML = "Input Types";
  inputBox.appendChild(category2);
  inputArr.forEach((root) => {
    const rootDisplay = document.createElement("li");
    rootDisplay.setAttribute("class", "queryType-alt");
    rootDisplay.innerHTML = `<span>${root.name}</span>`;
    //create fieldDisplay
    const fieldDisplay = document.createElement("ul");
    fieldDisplay.setAttribute("class", "fieldGroup");
    for (const field in root.fields) {
      //create a li for each key-value pair in the field.
      const childLi = document.createElement("li");
      childLi.setAttribute("class", "fieldType-alt");
      //May not need to check the type since it is entry. but, keep for now.
      childLi.textContent = `${field}:${root.fields[field]}`;
      //append to list fieldDisplay
      fieldDisplay.appendChild(childLi);
      //hide children initially
      fieldDisplay.hidden = true;
      //TODO: eventlistener here
    };

    //append field display to root
    rootDisplay.appendChild(fieldDisplay);
    rootDisplay.addEventListener("click", function (e) {
      const children = this.querySelector("ul");
      children.hidden = !children.hidden;
    });
    //append rootDisplay to entry
    inputBox.appendChild(rootDisplay);
  });
  


  //Third div to save Enum type
  const enumBox = document.createElement("div");
  enumBox.setAttribute("class", "tree");
  board.appendChild(enumBox);
  const category3 = document.createElement("h3");
  category3.innerHTML = "Enumeration Types";
  enumBox.appendChild(category3);
  enumArr.forEach(el => {
    const enumDisplay = document.createElement("span");
    enumDisplay.setAttribute('class', 'enumDisplay');
    enumDisplay.innerHTML = `${el.name}: ${JSON.stringify(el.value)}`;
    enumBox.appendChild(enumDisplay);
  });

  return;
}

//function draw the next level fields
function drawNext(array, node, rootObj, enumLeaf) {
  const arrayTypes = ["Int", "Float", "String", "Boolean", "ID"];
  //create field display
  const fieldDisplay = document.createElement("ul");
  fieldDisplay.setAttribute("class", "fieldGroup");
  for (const field in rootObj.fields) {
    const childLi = document.createElement("li");
    childLi.setAttribute("class", "fieldType-alt");
    //check the type to see if it is leaf
    if (arrayTypes.includes(rootObj.fields[field].returnType)) {
      childLi.textContent = `${field}:${rootObj.fields[field].returnType}`;
    } else if (enumLeaf.includes(rootObj.fields[field].returnType)) {
      childLi.textContent = `${field}:${rootObj.fields[field].returnType}`;
      childLi.setAttribute("style", "color:green");
    } else {
      //create buttons within li
      const btn = document.createElement("button");
      btn.textContent = `${field}:${rootObj.fields[field].returnType}`;
      //append to list item
      childLi.appendChild(btn);
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const parent = e.target.parentNode;
        const [field, fieldtype] = parent.textContent.split(":");
        array.forEach((e) => {
          if (fieldtype === e.name) {
            drawNext(array, btn, e, enumLeaf);
          }
        });
      });
    }

    fieldDisplay.appendChild(childLi);
  }
  //node is the button but we want to the parent of the button
  node.addEventListener("click", function (e) {
    //locate children ul
    const children = this.parentNode.querySelector("ul");
    children.hidden = !children.hidden;
  });
  node.parentNode.appendChild(fieldDisplay);
  return;
}
