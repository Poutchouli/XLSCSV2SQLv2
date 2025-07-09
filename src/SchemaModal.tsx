import { For } from 'solid-js';
import './SchemaModal.css';

interface SchemaModalProps {
  schema: {
    name: string;
    columns: { name: string; type: string }[];
  }[];
  onClose: () => void;
}

export function SchemaModal(props: SchemaModalProps) {
  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Database Schema</h2>
          <button class="close-btn" onClick={props.onClose}>×</button>
        </div>
        <div class="modal-body">
          <For each={props.schema}>
            {(table) => (
              <div class="table-schema">
                <h3>{table.name}</h3>
                <ul class="column-list">
                  <For each={table.columns}>
                    {(column) => (
                      <li>
                        <span class="column-name">{column.name}</span>
                        <span class="column-type">{column.type}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}