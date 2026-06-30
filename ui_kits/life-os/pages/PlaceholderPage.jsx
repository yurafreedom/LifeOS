/* global React */
/* Generic placeholder page used for routes whose body lands in a later
   sprint (e.g. home stats, medications tracker, investments). */
function PlaceholderPage({ title, body }) {
  return (
    <div className="ph-page">
      <div className="ph-card">
        <div className="ph-eyebrow mono">{title}</div>
        <div className="ph-body">{body}</div>
      </div>
    </div>
  );
}

window.PlaceholderPage = PlaceholderPage;
