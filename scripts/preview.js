//document on load
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl);
});

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
    console.log("clickeddd");
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
  entry.setAttribute("class", "container");
  entry.setAttribute('style', 'padding: 10px');
  board.appendChild(entry);
  const category = document.createElement("h4");
  category.innerHTML = "Entry Points";
  entry.appendChild(category);
  
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
      const btn = document.createElement("a");
      btn.setAttribute('href', "#");
        //tool tip is not working as expected...
        btn.setAttribute('data-bs-toggle', "tooltip");
        btn.setAttribute('data-bs-placement', "right");
        btn.setAttribute('data-bs-title',`return hey`);
      btn.textContent = `${field}: ${root.fields[field].returnType}`;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const parent = e.target.parentNode;
        //grab typeinfo from parent node.
        const [field, fieldtype] = parent.textContent.replace(" ", "").split(":");

        schemaArr.forEach((e) => {
          if (fieldtype === e.name) {
            drawNext(schemaArr, btn, e, enumLeaf); 
          }
        });
      });
      childLi.appendChild(btn);
      //append to list fieldDisplay
      fieldDisplay.appendChild(childLi);
      //hide children initially
      fieldDisplay.hidden = true;
    }

    //append field display to root
    rootDisplay.appendChild(fieldDisplay);
    rootDisplay.addEventListener("click", function (e) {
      const children = this.querySelector("ul");
      children.hidden = !children.hidden;
    });
    //append rootDisplay to entry
    entry.appendChild(rootDisplay);

  });

  //Second div to save input type
  const inputBox = document.createElement("div");
  inputBox.setAttribute("class", "container");
  inputBox.setAttribute('style', 'padding: 10px');
  board.appendChild(inputBox);
  const category2 = document.createElement("h4");
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
      //check for type
      if (root.fields[field] in scalarTypes || root.fields[field] in enumLeaf) {
        childLi.textContent = `${field}: ${root.fields[field]}`;
      } else {
        const btn = document.createElement("a");
        btn.setAttribute('href', "#");
        btn.textContent = `${field}: ${root.fields[field]}`;
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          const parent = e.target.parentNode;
          //grab typeinfo from parent node.
          const [field, fieldtype] = parent.textContent.replace(" ", "").split(":");

          schemaArr.forEach((e) => {
            if (fieldtype === e.name) {
              drawNext(schemaArr, btn, e, enumLeaf); 
            }
          });
        });
        childLi.appendChild(btn);
      };
      //append to list fieldDisplay
      fieldDisplay.appendChild(childLi);
      //hide children initially
      fieldDisplay.hidden = true;
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
  enumBox.setAttribute("class", "container");
  enumBox.setAttribute('style', 'padding: 10px');
  board.appendChild(enumBox);
  const category3 = document.createElement("h5");
  category3.innerHTML = "Enumeration Types";
  enumBox.appendChild(category3);
  enumArr.forEach(el => {
    const enumD = document.createElement('div');
    enumBox.appendChild(enumD);
    const enumDisplay = document.createElement('a');
    enumD.appendChild(enumDisplay);
    enumDisplay.setAttribute('data-bs-toggle', 'collapse');
    enumDisplay.setAttribute('href', `#E${el.name}`);
    enumDisplay.setAttribute('style', "color:#16cfc6");
    enumDisplay.innerHTML = el.name;
    const enumChoices = document.createElement('div');
    enumChoices.setAttribute('id', `E${el.name}`);
    enumChoices.setAttribute('class', 'collapse');
    enumChoices.innerHTML = `${el.value.join('   ')}`;
    enumD.appendChild(enumChoices);
  });

  console.log(enumBox);
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
      childLi.textContent = `${field}: ${rootObj.fields[field].returnType}`;
    } else if (enumLeaf.includes(rootObj.fields[field].returnType)) {
      childLi.textContent = `${field}: ${rootObj.fields[field].returnType}`;
      childLi.setAttribute("style", "color:#16cfc6");
    } else {
      //create buttons within li
      const btn = document.createElement("a");
      btn.setAttribute('href', "#");
      btn.textContent = `${field}: ${rootObj.fields[field].returnType}`;
      //append to list item
      childLi.appendChild(btn);
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const parent = e.target.parentNode;
        const [field, fieldtype] = parent.textContent.replace(" ", '').split(":");
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
};



