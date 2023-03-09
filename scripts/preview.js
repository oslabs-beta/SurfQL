// Global Memory
let followCode = false;

//document on load
document.addEventListener("DOMContentLoaded", () => {
  //get board element
  const board = document.querySelector("#board");
  const vscode = acquireVsCodeApi();
  function getSchematext() {
    vscode.postMessage({
      command: "get schema text",
    });
  }
  getSchematext();

  // Refresh button functionality
  const refreshBtn = document.querySelector("#refresh");
  refreshBtn.addEventListener("click", (e) => {
    board.innerHTML = "";
    getSchematext();
  });

  // Live update button functionality
  const liveUpdateBtn = document.querySelector("#follow-code");
  liveUpdateBtn.addEventListener('click', (e) => {
    // Invert functionality and appearance
    followCode = !followCode;
    liveUpdateBtn.classList.toggle('btn-selected');
    liveUpdateBtn.innerText =
      followCode 
        ? '' // Will switch between: ⏺(default) and ⏹(hover) via CSS
        : 'Track';
  });
});

//add eventListener to the window
window.addEventListener("message", (event) => {
  const message = event.data;
  //call parser
  if (message.command === "sendSchemaInfo") {
    const [schemaArr, queryMutation, enumArr, inputArr, scalarArr, unionArr] =
      JSON.parse(message.text);
    draw(queryMutation, schemaArr, enumArr, inputArr, scalarArr, unionArr);
    return;
  } else if (message.command === "followCode" && followCode) {
    const [historyArray, typedFields] = JSON.parse(message.text);
    openTo(historyArray, typedFields);
  }
});

// //display function
function draw(qmArr, schemaArr, enumArr, inputArr, scalarArr, unionArr) {
  //create enumLeaf array for check type logic
  const enumLeaf = [];
  enumArr.forEach((e) => {
    enumLeaf.push(e.name);
  });
  const scalarTypes = ["Int", "Float", "String", "Boolean", "ID"].concat(
    scalarArr
  );

  //first div called Entry to demo query and mutation info
  const entry = document.createElement("div");
  entry.setAttribute("class", "container");
  entry.setAttribute("style", "padding: 10px");
  board.appendChild(entry);
  const category = document.createElement("h5");
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
      btnBasic(btn);
      btn.setAttribute(
        "data-bs-title",
        `return ${root.fields[field].returnType} type`
      );
      const tooltip = new bootstrap.Tooltip(btn);
      btn.textContent = `${field}: ${root.fields[field].returnType}`;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const parent = e.target.parentNode;
        //grab typeinfo from parent node.
        const [field, fieldtype] = parent.textContent
          .replace(" ", "")
          .split(":");
        schemaArr.forEach((e) => {
          if (fieldtype === e.name) {
            drawNext(schemaArr, btn, e, enumLeaf, scalarTypes, unionArr);
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
  inputBox.setAttribute("style", "padding: 10px");
  board.appendChild(inputBox);
  const category2 = document.createElement("h5");
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
      if (
        scalarTypes.includes(root.fields[field]) ||
        enumLeaf.includes(root.fields[field])
      ) {
        childLi.textContent = `${field}: ${root.fields[field]}`;
      } else {
        const btn = document.createElement("a");
        btn.setAttribute("class", "notleaf");
        btn.textContent = `${field}: ${root.fields[field]}`;
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          const parent = e.target.parentNode;
          //grab typeinfo from parent node.
          const [field, fieldtype] = parent.textContent
            .replace(" ", "")
            .split(":");
          schemaArr.forEach((e) => {
            if (fieldtype === e.name) {
              drawNext(schemaArr, btn, e, enumLeaf, scalarTypes, unionArr);
            }
          });
        });
        childLi.appendChild(btn);
      }
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
    inputBox.appendChild(rootDisplay);
  });

  //Third div to save Enum type
  const enumBox = document.createElement("div");
  enumBox.setAttribute("class", "container");
  enumBox.setAttribute("style", "padding: 10px");
  board.appendChild(enumBox);
  const category3 = document.createElement("h5");
  category3.innerHTML = "Enumeration Types";
  enumBox.appendChild(category3);
  enumArr.forEach((el) => {
    const enumD = document.createElement("li");
    enumBox.appendChild(enumD);
    const enumDisplay = document.createElement("a");
    enumD.appendChild(enumDisplay);
    enumDisplay.setAttribute("data-bs-toggle", "collapse");
    enumDisplay.setAttribute("href", `#E${el.name}`);
    enumDisplay.setAttribute("style", "color:rgb(170,170,170");
    enumDisplay.setAttribute("class", "notleaf");
    enumDisplay.innerHTML = el.name;
    const enumChoices = document.createElement("div");
    enumChoices.setAttribute("id", `E${el.name}`);
    enumChoices.setAttribute("class", "collapse");
    enumChoices.innerHTML = `${el.value.join(",")}`;
    enumD.appendChild(enumChoices);
  });
  return;
}

//function draw the next level fields
function drawNext(array, node, rootObj, enumLeaf, scalarTypes, unionArr) {
  const unionObj = {};
  unionArr.forEach((el) => {
    unionObj[el.name] = el.options;
  });
  //create field display
  const fieldDisplay = document.createElement("ul");
  fieldDisplay.setAttribute("class", "fieldGroup");
  for (const field in rootObj.fields) {
    const childLi = document.createElement("li");
    childLi.setAttribute("class", "fieldType-alt");
    //check the type to see if it is leaf
    const returnType = rootObj.fields[field].returnType;
    if (scalarTypes.includes(returnType)) {
      childLi.textContent = `${field}: ${returnType}`;
    } else if (enumLeaf.includes(returnType)) {
      childLi.textContent = `${field}: ${returnType}`;
      childLi.setAttribute("style", "color:rgb(170, 170, 170");
    } else if (Object.keys(unionObj).includes(returnType)) {
      const btn = document.createElement("a");
      btnBasic(btn);
      btn.setAttribute(
        "data-bs-title",
        `return one of the ${JSON.stringify(unionObj[returnType])} object type`
      );
      const tooltip = new bootstrap.Tooltip(btn);
      btn.textContent = `${field}: ${returnType}`;
      //append to list item
      childLi.appendChild(btn);
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    } else {
      //create buttons within li
      const btn = document.createElement("a");
      btnBasic(btn);
      btn.setAttribute("data-bs-title", `return ${returnType} object type`);
      const tooltip = new bootstrap.Tooltip(btn);
      btn.textContent = `${field}: ${returnType}`;
      //append to list item
      childLi.appendChild(btn);
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const parent = e.target.parentNode;
        const [field, fieldtype] = parent.textContent
          .replace(" ", "")
          .split(":");
        array.forEach((e) => {
          if (fieldtype === e.name) {
            drawNext(array, btn, e, enumLeaf, scalarTypes, unionArr);
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

function btnBasic(btn) {
  btn.setAttribute("class", "notleaf");
  btn.setAttribute("data-bs-toggle", "tooltip");
  btn.setAttribute("data-bs-placement", "right");
  btn.setAttribute("data-bs-trigger", "hover");
}

/**
 * Opens the schema to view the type in the given path
 * @param {string[]} schemaPath
 * @param {string[]} typedFields
 */
function openTo(schemaPath, typedFields) {
  // TODO: Close open elements that are located at the target location
  // Navigate inside the correct entry point (query/mutation)
  let currentElement = null; // The current element that is aligned with the schema path
  let schemaPathIndex = 0; // How deeply nested are we within schemaPath
  const operation = schemaPath.shift();
  const entryPoints = board.children[0].querySelectorAll('li');
  for (const entryPoint of entryPoints) {
    // Check `li` elements to find a match
    if (entryPoint.children[0].innerText === operation) {
      // Only click if the children are hidden
      if (entryPoint.children[1].hidden) {
        entryPoint.children[0].click();
      }
      currentElement = entryPoint.querySelector('ul');
      break;
    }
  }

  // No matching entry point operation was found: Stop here
  if (!currentElement) {
    throw new Error('Could not find entry point');
  }

  /* HTML structure (if properly rendered via clicks):
    <ul class="fieldGroup">
      <li class="fieldType-alt"> (repeated for each field)
        Contents are either:
          - Nothing (just innerText) if it's a scalar node
          - <a class="notleaf"> fieldName: Type </a>
            <ul clas="fieldGroup">
              (repeat)
            </ul>
      </li>
    </ul>
  */
  // Navigate to the correct leaf node
  for (let i = 0; i < currentElement.children.length && schemaPath[schemaPathIndex]; i++) {
    const element = currentElement.children[i]; // `li` element

    // Handle leaf nodes (scalar types)
    if (element.children.length === 0) {
      const fieldName = element.innerText.slice(0, element.innerText.indexOf(':'));
      // Compare the field name to the schema path
      if (fieldName === schemaPath[schemaPathIndex]) {
        schemaPathIndex++; // Not needed but here for clarity
        break; // Completed the traversal
      } else {
        continue; // Not a match, continue to next element
      }
    }

    // Handle field types (nested)
    const textContext = element.children[0].innerText;
    const fieldName = textContext.slice(0, textContext.indexOf(':'));
    // Compare the field name to the schema path
    if (fieldName === schemaPath[schemaPathIndex]) {
      // Only click if the children are not already rendered
      if (!element.children[1] || element.children[1].hidden) {
        element.children[0].click(); // Render the children (build the tree)
      }
      currentElement = element.children[1]; // Reassign to the `ul` element
      schemaPathIndex++; // Look for the next field in the schema path
      i = -1; // Reset index for next search
    }
  }

  // Style completed fields differently
  for (let i = 0; i < currentElement.children.length; i++) {
    const element = currentElement.children[i]; // `li` element
    const textContext = element.children[0]
      ? element.children[0].innerText
      : element.innerText;
    const fieldName = textContext.slice(0, textContext.indexOf(':'));
    if (typedFields.includes(fieldName)) {
      element.classList.add('typedField');
    } else {
      element.classList.remove('typedField');
    }
  }

  // Scroll to the element and have it at the top of the webview
  currentElement.parentNode.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });

}
