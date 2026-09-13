/**
 * ESLint rule: no bare string literals in JSX text positions or in a defined set of
 * user-visible props. Every user-facing string must come from the i18n dictionary.
 *
 * Allowed without a translation:
 *  - whitespace-only text and text that contains no letters (punctuation such as "–", "·", "…",
 *    digits, symbols)
 *  - single-character strings
 *  - strings inside an element or attribute preceded by an `{/* i18n-ignore *\/}` comment
 *  - the props listed in `options.allowProps` (e.g. `className`, `href`) are never checked;
 *    only the props in `checkedProps` are.
 */
const CHECKED_PROPS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'aria-description', 'aria-roledescription']);

/** Text that contains at least one letter (any script) is linguistic. */
const hasLetters = (s) => /\p{L}/u.test(s);

function hasIgnoreComment(context, node) {
  const source = context.sourceCode ?? context.getSourceCode();
  const comments = source.getCommentsBefore(node);
  if (comments.some((c) => c.value.trim() === 'i18n-ignore')) return true;
  // Also accept the comment on the parent JSX element (`{/* i18n-ignore */}` as a sibling before).
  const parent = node.parent;
  if (parent && parent.type === 'JSXElement') {
    const idx = parent.children.indexOf(node);
    for (let i = idx - 1; i >= 0; i--) {
      const sib = parent.children[i];
      if (sib.type === 'JSXText' && sib.value.trim() === '') continue;
      if (sib.type === 'JSXExpressionContainer' && sib.expression.type === 'JSXEmptyExpression') {
        const inner = source.getCommentsInside(sib);
        if (inner.some((c) => c.value.trim() === 'i18n-ignore')) return true;
      }
      break;
    }
  }
  return false;
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow bare user-facing string literals in JSX; use the i18n dictionary.' },
    schema: [],
    messages: {
      bareText: 'Bare text "{{text}}" in JSX. Use t(\'…\') from the i18n dictionary or add {/* i18n-ignore */} for non-linguistic text.',
      bareProp: 'Bare string in user-visible prop "{{prop}}". Use t(\'…\') from the i18n dictionary.',
    },
  },
  create(context) {
    return {
      JSXText(node) {
        const text = node.value.trim();
        if (text.length <= 1 || !hasLetters(text)) return;
        if (hasIgnoreComment(context, node)) return;
        context.report({ node, messageId: 'bareText', data: { text: text.slice(0, 30) } });
      },
      JSXAttribute(node) {
        const name = node.name && node.name.name;
        if (typeof name !== 'string' || !CHECKED_PROPS.has(name)) return;
        const v = node.value;
        if (!v) return;
        let literal = null;
        if (v.type === 'Literal' && typeof v.value === 'string') literal = v.value;
        else if (v.type === 'JSXExpressionContainer') {
          const e = v.expression;
          if (e.type === 'Literal' && typeof e.value === 'string') literal = e.value;
          else if (e.type === 'TemplateLiteral' && e.expressions.length === 0) literal = e.quasis.map((q) => q.value.cooked).join('');
        }
        if (literal === null) return;
        if (literal.trim().length <= 1 || !hasLetters(literal)) return;
        if (hasIgnoreComment(context, node)) return;
        context.report({ node, messageId: 'bareProp', data: { prop: name } });
      },
    };
  },
};
