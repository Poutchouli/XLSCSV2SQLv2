import { For, Show } from 'solid-js';
import './Modal.css';

type ModalProps = {
  isOpen: boolean;
  title: string;
  tableNames: string[];
  onClose: () => void;
};

export function Modal(props: ModalProps) {
  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={props.onClose}>
        <div class="modal-content" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>{props.title}</h3>
            <button class="modal-close-btn" onClick={props.onClose}>×</button>
          </div>
          <div class="modal-body">
            <Show when={props.tableNames.length > 0} fallback={<p>No tables have been uploaded to SQLite yet.</p>}>
              <ul class="table-list">
                <For each={props.tableNames}>
                  {(name) => <li>{name}</li>}
                </For>
              </ul>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}