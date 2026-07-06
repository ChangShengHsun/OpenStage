import { useState } from 'react';
import type { ReactElement } from 'react';
import { useEditor } from '../state/store';
import { getLocalUser } from '../state/user';

interface CommentsSectionProps {
  /** Null = comments on the whole selected formation. */
  performerId: string | null;
}

export function CommentsSection({ performerId }: CommentsSectionProps): ReactElement {
  const selectedFormationId = useEditor((s) => s.selectedFormationId);
  const comments = useEditor((s) => s.comments);
  const addComment = useEditor((s) => s.addComment);
  const removeComment = useEditor((s) => s.removeComment);
  const [draft, setDraft] = useState('');

  const visible = comments.filter(
    (c) => c.formationId === selectedFormationId && c.performerId === performerId,
  );

  const submit = (): void => {
    addComment(draft, performerId, getLocalUser().name);
    setDraft('');
  };

  return (
    <>
      <div className="panel-title">Comments</div>
      <div className="panel-section">
        {visible.length === 0 && <span className="mono">No comments yet.</span>}
        {visible.map((c) => (
          <div key={c.id} className="comment-row">
            <div className="comment-head">
              <span className="comment-author">{c.authorName}</span>
              <button
                type="button"
                className="comment-delete"
                aria-label={`Delete comment: ${c.text.slice(0, 30)}`}
                onClick={() => removeComment(c.id)}
              >
                ×
              </button>
            </div>
            <div className="comment-text">{c.text}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            aria-label="New comment"
            placeholder={
              performerId === null ? 'Note on this formation…' : 'Note on this performer…'
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          <button type="button" className="btn" disabled={draft.trim() === ''} onClick={submit}>
            Add
          </button>
        </div>
      </div>
    </>
  );
}
