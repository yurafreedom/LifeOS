/* global React */
const { useState: useStateEF, useRef: useRefEF, useEffect: useEffectEF } = React;

/* Inline-editable field. Click → input; blur or Enter → save.
   Used across profile cards for name / age / city / numeric fields. */
function EditableField({ value, onChange, placeholder, type = 'text', mono = false, suffix, multiline = false, width }) {
  const [editing, setEditing] = useStateEF(false);
  const [draft, setDraft] = useStateEF(value);
  const ref = useRefEF(null);

  useEffectEF(() => { setDraft(value); }, [value]);
  useEffectEF(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if (ref.current.select && !multiline) ref.current.select();
    }
  }, [editing, multiline]);

  function commit() {
    setEditing(false);
    if (draft !== value) onChange(type === 'number' ? (draft === '' ? null : Number(draft)) : draft);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }
  function onKey(e) {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
    if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  }

  const empty = value == null || value === '';
  const cls = "ef-display" + (empty ? " is-empty" : "") + (mono ? " mono" : "");

  if (editing) {
    return multiline ? (
      <textarea ref={ref}
                className={"ef-input ef-input-multi" + (mono ? " mono" : "")}
                value={draft == null ? '' : draft}
                placeholder={placeholder}
                style={width ? { width } : undefined}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKey}
                rows={3} />
    ) : (
      <input ref={ref}
             type={type === 'number' ? 'text' : type}
             inputMode={type === 'number' ? 'decimal' : undefined}
             className={"ef-input" + (mono ? " mono" : "")}
             value={draft == null ? '' : draft}
             placeholder={placeholder}
             style={width ? { width } : undefined}
             onChange={e => setDraft(e.target.value)}
             onBlur={commit}
             onKeyDown={onKey} />
    );
  }
  return (
    <button className={cls}
            style={width ? { width } : undefined}
            onClick={() => setEditing(true)}
            type="button">
      {empty ? placeholder : (
        <React.Fragment>
          <span>{value}</span>
          {suffix && <span className="ef-suffix mono">{suffix}</span>}
        </React.Fragment>
      )}
    </button>
  );
}

window.EditableField = EditableField;
