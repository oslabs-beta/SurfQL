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
  //call parser
  if (message.command === "sendSchemaInfo") {
    // const [schemaArr, returnObj] = parser(text);
    const schemaArr = JSON.parse(message.text);
    console.log("here it comes", schemaArr);
    draw(schemaArr);
    return;
  }
});


// //display function
function draw(array) {
const arrayTypes = ["Int","Float","String","Boolean","ID"];
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
//console.log("true", root.fields[field]);

      //create buttons within li
      const childLi = document.createElement("li");
      childLi.setAttribute("class", "fieldType-alt");

      if (arrayTypes.includes(root.fields[field])) {
      console.log(root.fields[field],"true");
      childLi.textContent = `${field}:${root.fields[field]}`;
    } else {
      const btn = document.createElement("button");
      btn.textContent = `${field}:${root.fields[field]}`;
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
            console.log("e",e);
           drawNext(array, btn, e); //array, btn buyer
          }
        });
      });
      childLi.appendChild(btn);
  }
      //append to list item

      childUl.appendChild(childLi);
      //hide children initially
      childUl.hidden = true;
      //TODO: eventlistener here
    }
    li.appendChild(childUl);
    li.addEventListener("click", function (e) {
      //console.log(e.target);
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
const arrayTypes = ["Int","Float","String","Boolean","ID"];
  //console.log('drawNext, -> ', array, node, rootObj);
  //create childUL
  const childUl = document.createElement("ul");
  childUl.setAttribute("class", "fieldGroup");
  for (const field in rootObj.fields) {
    //create buttons within li

    const childLi = document.createElement("li");
    childLi.setAttribute("class", "fieldType-alt");

      if (arrayTypes.includes(rootObj.fields[field])) {
           childLi.textContent = `${field}:${rootObj.fields[field]}`;
      } else {

            const btn = document.createElement("button");

            btn.textContent = `${field}:${rootObj.fields[field]}`;
            //append to list item
            childLi.appendChild(btn);
            //hide children initially
            // childUl.hidden = true;
            btn.addEventListener('click', function(e) {
              console.log("text")
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


    childUl.appendChild(childLi);
  }
  //node is the button but we want to appendUl
   node.addEventListener("click", function (e) {
     //locate children
     const children = this.parentNode.querySelector("ul");
     console.log("children",children);
      children.hidden = !children.hidden;
    });
  node.parentNode.appendChild(childUl);
  return;
}

