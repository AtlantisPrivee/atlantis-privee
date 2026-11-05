(function initTool() {
  "use strict";
  const tool = window.ATLANTIS_TOOL;
  const { esc, icon, download, csv } = window.AP;
  const form = document.getElementById("tool-form");
  const fields = document.getElementById("form-fields");
  const output = document.getElementById("result-body");
  const errorBox = document.getElementById("form-error");
  const badge = document.getElementById("input-example");
  const start = document.getElementById("tool-start");
  const submit = document.getElementById("run-tool");
  const exampleButton = document.getElementById("try-example");
  const clearButton = document.getElementById("clear-tool");
  const picker = document.getElementById("input-file");
  const resultsPanel = document.getElementById("results-panel");
  const emptyResult = output.innerHTML;
  const fileField = tool.fields.find(field => field.type === "files");
  let counter = 0;
  let revision = 0;
  let last = null;
  let example = false;
  let exampleFiles = null;

  function inputHTML(field, id, value = "", showHint = true) {
    const hint = showHint && field.hint ? ` aria-describedby="${id}-hint"` : "";
    const required = field.required === false ? "" : ' aria-required="true"';
    const attrs = ` id="${id}" data-field="${field.id}"${hint}${required}`;
    if (field.type === "textarea") {
      return `<textarea${attrs} maxlength="${field.maxLength || 30000}" rows="4">${esc(value)}</textarea>`;
    }
    if (field.type === "select") {
      const options = field.options.map(option => `<option${option === value ? " selected" : ""}>${esc(option)}</option>`).join("");
      return `<select${attrs}><option value="">Choose an option</option>${options}</select>`;
    }
    if (field.type === "files") {
      return `<input type="file"${attrs} multiple>`;
    }
    const numberAttrs = field.type === "number"
      ? ` min="${field.min}" max="${field.max}" step="${field.step || "any"}" inputmode="${field.step === 1 ? "numeric" : "decimal"}"${typeof field.sample === "number" ? ` placeholder="e.g. ${esc(field.sample)}"` : ""}`
      : "";
    const length = field.maxLength ? ` maxlength="${field.maxLength}"` : "";
    return `<input type="${field.type}"${attrs}${numberAttrs}${length} value="${esc(value)}">`;
  }

  function label(field, id) {
    const optional = field.required === false ? '<span class="optional">Optional</span>' : "";
    return `<label for="${id}">${esc(field.label)}${optional}</label>`;
  }

  function addRow(field, values = {}, focus = false) {
    const list = fields.querySelector(`[data-row-group="${field.id}"]`);
    if (list.children.length >= field.maxRows) {
      showError(`You can add up to ${field.maxRows} entries to this list.`);
      return;
    }
    const entry = document.createElement("div");
    entry.className = "entry-card";
    const controls = field.columns.map(column => {
      const id = `input-${field.id}-${column.id}-${counter++}`;
      return `<div class="entry-cell">${label(column, id)}${inputHTML(column, id, values[column.id] ?? "", false)}</div>`;
    }).join("");
    entry.innerHTML = `<div class="entry-fields">${controls}</div><button type="button" class="remove-row">Remove ${esc(tool.entryName)}</button>`;
    entry.querySelector(".remove-row").addEventListener("click", () => {
      const neighbor = entry.nextElementSibling || entry.previousElementSibling;
      entry.remove();
      if (!list.children.length) addRow(field);
      markStale();
      (neighbor?.querySelector("input, select, textarea") || fields.querySelector(`[data-add="${field.id}"]`)).focus();
    });
    list.append(entry);
    if (focus) entry.querySelector("input, select, textarea").focus();
  }

  function renderForm() {
    fields.innerHTML = tool.fields.map(field => {
      const id = `input-${field.id}`;
      const hint = field.hint ? `<p class="hint" id="${id}-hint">${esc(field.hint)}</p>` : "";
      const title = `<div class="field-title" id="${id}-title">${esc(field.label)}</div>`;
      if (field.type === "rows") {
        return `<div class="field field-wide" role="group" aria-labelledby="${id}-title">${title}${hint}<div class="entry-list" data-row-group="${field.id}"></div><button type="button" class="add-row" data-add="${field.id}">+ Add ${esc(tool.entryName)}</button></div>`;
      }
      if (field.type === "checks") {
        const checks = field.items.map(item => `<label class="checklabel"><input type="checkbox" data-check="${field.id}" value="${esc(item)}">${esc(item)}</label>`).join("");
        return `<div class="field field-wide" role="group" aria-labelledby="${id}-title">${title}${hint}<div class="check-grid">${checks}</div></div>`;
      }
      const fullWidth = ["textarea", "files"].includes(field.type) ? " field-wide" : "";
      return `<div class="field${fullWidth}">${label(field, id)}${inputHTML(field, id)}${hint}</div>`;
    }).join("");
    for (const field of tool.fields.filter(item => item.type === "rows")) {
      addRow(field);
      fields.querySelector(`[data-add="${field.id}"]`).addEventListener("click", () => {
        markStale();
        addRow(field, {}, true);
      });
    }
  }

  function fail(message, control) {
    const error = Error(message);
    error.control = control;
    throw error;
  }

  function readControl(field, control, fieldLabel = field.label) {
    try {
      return valueOf(field, control.value, fieldLabel);
    } catch (error) {
      return fail(error.message, control);
    }
  }

  function readForm() {
    const values = {};
    for (const field of tool.fields) {
      const control = fields.querySelector(`[data-field="${field.id}"]`);
      if (field.type === "rows") {
        const list = fields.querySelector(`[data-row-group="${field.id}"]`);
        const rows = [];
        for (const [index, entry] of [...list.children].entries()) {
          const controls = field.columns.map(column => entry.querySelector(`[data-field="${column.id}"]`));
          if (controls.every(input => !input.value.trim())) continue;
          const row = Object.fromEntries(field.columns.map((column, i) => [
            column.id, readControl(column, controls[i], `${column.label} in ${tool.entryName} ${index + 1}`)
          ]));
          rows.push(row);
        }
        if (!rows.length && field.required !== false) {
          fail(`Add a complete ${tool.entryName} to continue.`, list.querySelector("input, select, textarea"));
        }
        values[field.id] = rows;
      } else if (field.type === "checks") {
        values[field.id] = [...fields.querySelectorAll(`[data-check="${field.id}"]:checked`)].map(input => input.value);
      } else if (field.type === "files") {
        const files = exampleFiles || [...control.files];
        if (!files.length) fail("Choose a file to continue.", control);
        if (files.length > 20) fail("Choose up to 20 files at a time.", control);
        if (files.some(file => file.size > 25 * 1024 * 1024)) fail("Each file must be 25 MB or smaller.", control);
        if (files.reduce((total, file) => total + file.size, 0) > 100 * 1024 * 1024) fail("Choose up to 100 MB of files in total.", control);
        values[field.id] = files;
      } else {
        values[field.id] = readControl(field, control);
      }
    }
    return values;
  }

  function populate(values) {
    for (const field of tool.fields) {
      if (field.type === "rows") {
        const items = values[field.id] || [];
        fields.querySelector(`[data-row-group="${field.id}"]`).replaceChildren();
        for (const item of items.length ? items : [{}]) addRow(field, item);
      } else if (field.type === "checks") {
        const selected = values[field.id] || [];
        fields.querySelectorAll(`[data-check="${field.id}"]`).forEach(input => {
          input.checked = selected.includes(input.value);
        });
      } else if (field.type !== "files") {
        fields.querySelector(`[data-field="${field.id}"]`).value = values[field.id] ?? "";
      }
    }
  }

  function validateImport(values) {
    for (const field of tool.fields) {
      const entry = values[field.id];
      if (field.type === "rows") {
        if (!Array.isArray(entry) || entry.length > field.maxRows || (field.required !== false && !entry.length)) {
          throw Error(`Check the saved list of ${field.label.toLowerCase()}.`);
        }
        for (const item of entry) {
          if (!item || typeof item !== "object") throw Error("Check the entries in the saved list.");
          for (const column of field.columns) valueOf(column, item[column.id], column.label);
        }
      } else if (field.type === "checks") {
        if (!Array.isArray(entry) || entry.some(item => !field.items.includes(item))) {
          throw Error("The saved checklist contains an unknown choice.");
        }
      } else {
        valueOf(field, entry, field.label);
      }
    }
  }

  function clearError() {
    errorBox.hidden = true;
    fields.querySelectorAll('[aria-invalid="true"]').forEach(control => control.removeAttribute("aria-invalid"));
  }

  function showError(message, control) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    if (control) control.setAttribute("aria-invalid", "true");
    (control || errorBox).focus();
  }

  function markStale() {
    revision += 1;
    clearError();
    if (last) {
      last.stale = true;
      output.querySelectorAll("[data-export]").forEach(button => { button.disabled = true; });
      output.querySelector(".stale").hidden = false;
    }
    if (example) badge.textContent = "Example inputs · edited";
  }

  function metricHTML(metric) {
    return `<div class="metric"><div class="label">${esc(metric.label)}</div><div class="value">${esc(metric.value)}</div>${metric.detail ? `<div class="detail">${esc(metric.detail)}</div>` : ""}</div>`;
  }

  function chartHTML(series) {
    const visible = series.slice(0, 12);
    if (!visible.length) return "";
    const max = Math.max(1, ...visible.map(item => Math.abs(item.value)));
    const bars = visible.map(item => {
      const width = Math.min(100, Math.abs(item.value) / max * 100);
      return `<div class="bar"><div class="bar-label"><span>${esc(item.label)}</span><span>${esc(fmt(item.value))}</span></div><div class="bar-track" aria-hidden="true"><div class="bar-fill${item.value < 0 ? " negative" : ""}" style="width:${width}%"></div></div></div>`;
    }).join("");
    return `<div class="bars" aria-label="Result comparison">${bars}</div>`;
  }

  function tableHTML(table) {
    if (!table) return "";
    const headers = table.headers.map(cell => `<th scope="col">${esc(cell)}</th>`).join("");
    const rows = table.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("");
    return `<div class="result-scroll" role="region" aria-label="Result table" tabindex="0"><table class="result-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function exportButton(kind, text, type = "secondary") {
    return `<button class="button ${type}" type="button" data-export="${kind}">${text}</button>`;
  }

  function renderResult(result, values) {
    last = { r: result, v: values, report: reportText(result, values), stale: false };
    const sample = example ? '<p class="example-badge">Example result</p>' : "";
    const extras = [
      exportButton("txt", "Download text"),
      result.table ? exportButton("csv", "Download CSV") : "",
      result.calendar ? exportButton("ics", "Download calendar") : "",
      exportButton("print", "Print / PDF"),
      exportButton("workspace", "Add to workspace")
    ].join("");
    output.innerHTML = `<div class="result-content">
      <p class="stale" hidden>Inputs changed. Select ${esc(tool.action)} to refresh the result.</p>
      ${sample}<h3 class="result-title" id="result-title" tabindex="-1">${esc(result.title)}</h3>
      <div class="metrics">${result.metrics.map(metricHTML).join("")}</div>
      ${chartHTML(result.series)}${tableHTML(result.table)}
      ${result.text ? `<div class="report-text" tabindex="0">${esc(result.text)}</div>` : ""}
      ${result.notes.map(note => `<p class="note">${esc(note)}</p>`).join("")}
      <div class="report-actions">${exportButton("copy", "Copy report", "primary")}</div>
      <details class="export-more"><summary>More ways to save</summary><div class="report-actions">${extras}</div></details>
      <p class="result-status" id="report-status" role="status"></p>
    </div>`;
    output.querySelectorAll("[data-export]").forEach(button => {
      button.addEventListener("click", () => exportResult(button.dataset.export));
    });
    resultsPanel.dataset.complete = "true";
    const title = document.getElementById("result-title");
    title.focus({ preventScroll: true });
    const { top, bottom } = title.getBoundingClientRect();
    if (top < 95 || bottom > window.innerHeight) title.scrollIntoView({ block: "start", behavior: "instant" });
  }

  async function run() {
    if (submit.disabled) return;
    clearError();
    const started = revision;
    submit.disabled = true;
    exampleButton.disabled = true;
    submit.textContent = "Working…";
    try {
      const values = readForm();
      const result = await tool.calculate(values);
      if (started !== revision) return;
      if (result.metrics.some(item => typeof item.value === "number" && !Number.isFinite(item.value))) {
        throw Error("These entries produce a result outside the supported range.");
      }
      renderResult(result, values);
    } catch (error) {
      if (started === revision) showError(error.message || "Check your entries and try again.", error.control);
    } finally {
      submit.disabled = false;
      exampleButton.disabled = false;
      submit.innerHTML = `${esc(tool.action)} ${icon("arrow")}`;
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    run();
  });
  form.addEventListener("input", markStale);
  form.addEventListener("change", event => {
    if (event.target === picker) return;
    if (event.target.type === "file") {
      exampleFiles = null;
      example = false;
      badge.hidden = true;
    }
    markStale();
  });

  exampleButton.addEventListener("click", () => {
    markStale();
    example = true;
    if (fileField) {
      fields.querySelector(`[data-field="${fileField.id}"]`).value = "";
      exampleFiles = [new File(["Atlantis Privee example file. This is not evidence.\n"], "example-not-evidence.txt", {
        type: "text/plain", lastModified: Date.UTC(2026, 9, 1)
      })];
    }
    populate(Object.fromEntries(tool.fields.map(field => [field.id, field.sample])));
    badge.textContent = "Example inputs";
    badge.hidden = false;
    run();
  });

  clearButton.addEventListener("click", () => {
    markStale();
    example = false;
    exampleFiles = null;
    last = null;
    renderForm();
    output.innerHTML = emptyResult;
    resultsPanel.dataset.complete = "false";
    badge.hidden = true;
    fields.querySelector("input, select, textarea")?.focus();
  });

  if (!fileField) {
    document.getElementById("save-inputs").addEventListener("click", () => {
      try {
        const values = readForm();
        const content = JSON.stringify({ version: 1, tool: tool.id, values, example }, null, 2);
        download(`${tool.slug}-inputs.json`, content, "application/json");
      } catch (error) {
        showError(error.message, error.control);
      }
    });
    document.getElementById("load-inputs").addEventListener("click", () => picker.click());
    picker.addEventListener("change", async () => {
      const file = picker.files[0];
      if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024) throw Error("Choose an input file of 2 MB or smaller.");
        const data = JSON.parse(await file.text());
        if (data.version !== 1 || data.tool !== tool.id || !data.values || typeof data.values !== "object") {
          throw Error("Choose an input file downloaded from this tool.");
        }
        validateImport(data.values);
        markStale();
        populate(data.values);
        example = Boolean(data.example);
        badge.textContent = "Example inputs";
        badge.hidden = !example;
      } catch (error) {
        showError(`Could not load the file. ${error.message}`);
      } finally {
        picker.value = "";
      }
    });
  }

  function valueOf(f,raw,label){const s=String(raw??'').trim();if(!s){if(f.required!==false)throw Error(label+': enter a value.');return f.type==='number'?null:'';}
 if(f.type==='number'){if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))throw Error(label+': enter a number.');const x=Number(s);if(!Number.isFinite(x)||x<f.min||x>f.max)throw Error(label+': use a number from '+f.min+' to '+f.max+'.');if(f.step===1&&!Number.isInteger(x))throw Error(label+': use a whole number.');return x;}
 if(f.type==='date'){dateValue(s);return s;}
 if(f.type==='select'&&!f.options.includes(s))throw Error(label+': choose a listed option.');if(s.length>(f.maxLength||30000))throw Error(label+': this entry is too long.');return s;
}

function reportText(r,v){const lines=['ATLANTIS PRIVÉE | '+tool.name,example?'EXAMPLE DATA — not your actual records':'YOUR ENTERED DATA','Generated: '+new Date().toISOString(),'','PURPOSE',tool.description,'','INPUTS'];for(const f of tool.fields){const val=v[f.id];lines.push(f.label+':');if(f.type==='rows')val.forEach(row=>lines.push('  '+f.columns.map(c=>c.label+' = '+(row[c.id]===null?'Not entered':row[c.id])).join(' | ')));else if(f.type==='files')val.forEach(file=>lines.push('  '+file.name+' ('+file.size+' bytes)'));else lines.push(Array.isArray(val)?val.join('; '):val===null?'Not entered':String(val));}lines.push('','RESULT',r.title);r.metrics.forEach(m=>lines.push(m.label+': '+m.value));if(r.table){lines.push('',r.table.headers.join(' | '));r.table.rows.forEach(row=>lines.push(row.join(' | ')));}if(r.text)lines.push('',r.text);lines.push('','REVIEW NOTES',...r.notes,'','METHOD',tool.method,'','LIMITATIONS',tool.limits,'',window.ATLANTIS_DISCLAIMER);return lines.join('\n');}

function ics(r){const escape=s=>String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');const fold=line=>{let out='',part='',size=0;for(const ch of line){const len=new TextEncoder().encode(ch).length;if(size+len>73){out+=part+'\r\n ';part='';size=1;}part+=ch;size+=len;}return out+part;};const stamp=new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Atlantis Privee//Personal Date Planner//EN','CALSCALE:GREGORIAN'];for(const [i,e]of r.calendar.entries()){const next=new Date(dateValue(e.date)+86400000).toISOString().slice(0,10).replace(/-/g,'');lines.push('BEGIN:VEVENT','UID:'+Date.now()+'-'+i+'@atlantisprivee.com','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+e.date.replace(/-/g,''),'DTEND;VALUE=DATE:'+next,'SUMMARY:'+escape(e.title),'DESCRIPTION:'+escape(e.description),'END:VEVENT');}lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';}

async function exportResult(kind){if(!last||last.stale)return;const status=output.querySelector('#report-status');try{if(kind==='copy'){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(last.report);}else{const copyBox=document.createElement('textarea');copyBox.value=last.report;copyBox.style.cssText='position:fixed;left:-10000px;top:0';document.body.append(copyBox);copyBox.select();const ok=document.execCommand('copy');copyBox.remove();if(!ok)throw Error('Clipboard access is unavailable. Download the TXT report instead.');}status.textContent='Report copied.';}if(kind==='txt')download(tool.slug+'-report.txt',last.report);if(kind==='csv')download(tool.slug+'-table.csv',csv(last.r.table.headers,last.r.table.rows),'text/csv;charset=utf-8');if(kind==='ics')download('atlantis-important-dates.ics',ics(last.r),'text/calendar;charset=utf-8');if(kind==='print')window.print();if(kind==='workspace'){window.AP.addReport(tool.name+(example?' (example)':''),last.report);status.textContent='Added to this tab’s workspace.';}}catch(e){status.textContent=e.message;}}
  renderForm();
  start.hidden = true;
  form.hidden = false;
  exampleButton.hidden = false;
  window.APToolTest = { readForm, run, populate, get last() { return last; } };
})();
