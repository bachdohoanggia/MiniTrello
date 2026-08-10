import { useEffect, useRef, useState } from 'react';
import { normalizeLink, normalizeRichText, sanitizeRichText } from '../utils/richText.js';

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Add a description…',
  disabled = false,
  ariaLabel = 'Description',
}) {
  const editorRef = useRef(null);
  const lastEmittedValue = useRef('');
  const savedRange = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (value === lastEmittedValue.current && editor.innerHTML === lastEmittedValue.current) {
      return;
    }

    const normalizedValue = normalizeRichText(value);
    if (editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue;
    }
    lastEmittedValue.current = normalizedValue;
  }, [value]);

  function emitChange() {
    const nextValue = editorRef.current?.innerHTML || '';
    lastEmittedValue.current = nextValue;
    onChange(nextValue);
    rememberSelection();
  }

  function restoreSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;

    editor.focus();
    if (!savedRange.current) return;
    selection.removeAllRanges();
    selection.addRange(savedRange.current);
  }

  function runCommand(command, commandValue = null) {
    if (disabled) return;
    restoreSelection();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  function applyTextStyle(event) {
    const tagName = event.target.value;
    runCommand('formatBlock', `<${tagName}>`);
  }

  function rememberSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  }

  function openLinkEditor() {
    if (disabled) return;
    rememberSelection();
    setLinkUrl('');
    setLinkOpen(true);
  }

  function applyLink(event) {
    event?.preventDefault();
    event?.stopPropagation();
    const href = normalizeLink(linkUrl);
    if (!href) return;

    const selection = window.getSelection();
    selection.removeAllRanges();
    if (savedRange.current) selection.addRange(savedRange.current);
    editorRef.current?.focus();

    if (selection.isCollapsed) {
      const safeText = href.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      const safeHref = href.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      document.execCommand('insertHTML', false, `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeText}</a>`);
    } else {
      document.execCommand('createLink', false, href);
    }

    emitChange();
    setLinkOpen(false);
    setLinkUrl('');
  }

  function handleLinkInputKeyDown(event) {
    if (event.key === 'Enter') {
      applyLink(event);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setLinkOpen(false);
    }
  }

  function handleEditorClick(event) {
    const anchor = event.target.closest?.('a');
    if (!anchor || !editorRef.current?.contains(anchor)) return;

    const href = normalizeLink(anchor.getAttribute('href'));
    if (!href) return;

    event.preventDefault();
    event.stopPropagation();
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function handlePaste(event) {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');

    restoreSelection();
    if (html) {
      document.execCommand('insertHTML', false, sanitizeRichText(html));
    } else {
      document.execCommand('insertText', false, text);
    }
    emitChange();
  }

  return (
    <div className={`rich-text-editor ${disabled ? 'is-disabled' : ''}`}>
      <div className="rich-text-toolbar" role="toolbar" aria-label="Description formatting">
        <select
          aria-label="Text style"
          defaultValue="p"
          disabled={disabled}
          onMouseDown={rememberSelection}
          onChange={applyTextStyle}
        >
          <option value="p">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <span className="toolbar-divider" />
        <button type="button" aria-label="Bold" title="Bold" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('bold')}><strong>B</strong></button>
        <button type="button" aria-label="Italic" title="Italic" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('italic')}><em>I</em></button>
        <span className="toolbar-divider" />
        <button type="button" aria-label="Bulleted list" title="Bulleted list" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertUnorderedList')}>• List</button>
        <button type="button" aria-label="Numbered list" title="Numbered list" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertOrderedList')}>1. List</button>
        <span className="toolbar-divider" />
        <button type="button" aria-label="Add link" title="Add link" disabled={disabled} onMouseDown={(event) => { event.preventDefault(); rememberSelection(); }} onClick={openLinkEditor}>↗ Link</button>
        <span className="toolbar-spacer" />
        <div className="toolbar-history" role="group" aria-label="Edit history">
          <button type="button" aria-label="Undo" title="Undo" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('undo')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 7 4 12l5 5" />
              <path d="M4 12h10a6 6 0 0 1 6 6" />
            </svg>
          </button>
          <button type="button" aria-label="Redo" title="Redo" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('redo')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 7 5 5-5 5" />
              <path d="M20 12H10a6 6 0 0 0-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {linkOpen && (
        <div className="rich-text-link-form">
          <input
            autoFocus
            type="text"
            inputMode="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://example.com"
            aria-label="Link URL"
            onKeyDown={handleLinkInputKeyDown}
          />
          <button type="button" onClick={applyLink} disabled={!linkUrl.trim()}>Apply</button>
          <button type="button" className="secondary" onClick={() => setLinkOpen(false)}>Cancel</button>
        </div>
      )}

      <div
        ref={editorRef}
        className="rich-text-content"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emitChange}
        onPaste={handlePaste}
        onBlur={emitChange}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onClick={handleEditorClick}
      />
    </div>
  );
}
