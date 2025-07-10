import { createSignal, For, Show } from 'solid-js';
import * as XLSX from 'xlsx';
import './Modal.css'; // We can reuse the existing modal CSS

// Define the shape of a sheet that the modal will work with
export interface SheetInfo {
  name: string;
  data: any[][]; // Array of arrays representing rows
}

type XlsOptionsModalProps = {
  isOpen: boolean;
  sheets: SheetInfo[];
  onClose: () => void;
  onImport: (selectedSheets: SheetInfo[], rowsToIgnore: number, separator: string) => void;
};

export function XlsOptionsModal(props: XlsOptionsModalProps) {
  const [selectedSheets, setSelectedSheets] = createSignal<string[]>([]);
  const [rowsToIgnore, setRowsToIgnore] = createSignal(0);
  const [separator, setSeparator] = createSignal(',');

  const handleCheckboxChange = (sheetName: string, checked: boolean) => {
    if (checked) {
      setSelectedSheets(prev => [...prev, sheetName]);
    } else {
      setSelectedSheets(prev => prev.filter(name => name !== sheetName));
    }
  };

  const handleImportClick = () => {
    const sheetsToImport = props.sheets.filter(s => selectedSheets().includes(s.name));
    if (sheetsToImport.length > 0) {
      props.onImport(sheetsToImport, rowsToIgnore(), separator());
    }
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay">
        <div class="modal-content" style={{ "max-width": "700px" }} onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>Excel Import Options</h3>
            <button class="modal-close-btn" onClick={props.onClose}>×</button>
          </div>
          <div class="modal-body" style={{ "max-height": "70vh" }}>
            <div class="import-controls">
              <label>
                Rows to ignore from top:
                <input
                  type="number"
                  min="0"
                  value={rowsToIgnore()}
                  onInput={(e) => setRowsToIgnore(parseInt(e.currentTarget.value) || 0)}
                />
              </label>
              <label>
                Separator (for header generation):
                <select value={separator()} onChange={(e) => setSeparator(e.currentTarget.value)}>
                  <option value=",">,</option>
                  <option value=";">;</option>
                  <option value="\t">Tab</option>
                  <option value="|">|</option>
                </select>
              </label>
            </div>

            <p>Select sheets to import:</p>
            <For each={props.sheets}>
              {(sheet) => (
                <div class="sheet-container">
                  <label class="sheet-checkbox">
                    <input
                      type="checkbox"
                      onChange={(e) => handleCheckboxChange(sheet.name, e.currentTarget.checked)}
                    />
                    <strong>{sheet.name}</strong>
                  </label>
                  <div class="data-preview" style={{ "margin-top": "5px" }}>
                    <div class="data-table">
                      <table>
                        <tbody>
                          <For each={sheet.data.slice(0, 3)}>
                            {(row) => <tr><For each={row}>{(cell) => <td>{cell}</td>}</For></tr>}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
          <div class="modal-footer">
            <button onClick={handleImportClick} disabled={selectedSheets().length === 0}>
              Import {selectedSheets().length} Selected Sheet(s)
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}