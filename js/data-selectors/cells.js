/** Table inputs in the column-mapping dialog. */

export function radioCell(name, key, checked) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = key;
  input.checked = checked;
  td.appendChild(input);
  return td;
}

export function checkCell(name, key, checked) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.value = key;
  input.checked = checked;
  td.appendChild(input);
  return td;
}

export function emptyCell() {
  return document.createElement("td");
}

export function selectedRadio(name) {
  return document.querySelector(`#upload-dialog input[name="${name}"]:checked`)?.value || "";
}

export function selectedChecks(name) {
  return [...document.querySelectorAll(`#upload-dialog input[name="${name}"]:checked`)].map(
    (input) => input.value
  );
}
