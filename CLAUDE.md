# Jaden.log

Every post has two editions with the same id: Korean `src/content/posts/<id>.mdx` and English `src/content/posts/en/<id>.mdx`, served at `/en/<id>`. UI strings live in one dictionary, `src/lib/i18n.ts`.

## English edition

When you write or migrate a post, write its English edition in the same change.

- Rewrite the same content as native English prose.
- Frontmatter: `category` and `subcategory` stay in Korean (they are taxonomy keys); `tags` go in English.
- Each SVG figure gets a separate copy with English text. On a 390px-wide screen, every label fits inside its box.
- In-post links point to the same language (`/3` → `/en/3`), and only to posts that have an English edition.
- Both editions share one layout: same reading width, same components. Never add a language-only width or layout rule (type size for Latin text in `prose.css` is the one exception).
- `astro build` fails when the two editions' skeletons differ (h2/h3, code, tables, component order, `Figure` cover/wide, `Quiz` ids and variant shapes, category and dates — `pairCheck` in `astro.config.mjs`). Fix the edition you forgot, not the check.

## Series

Register a series only in `src/lib/series.ts`. The post page renders the series list (under the table of contents on wide screens, below the post otherwise), so post bodies carry no series list. A part with no `id` is a planned part: it shows dimmed and unlinked. When you write that part, fill in its `id` instead of adding a new part.

## Cover

The cover is the body block (code, output, or `<Figure>`) shown in the macOS window on the home hero and post cards. Selection logic: `src/lib/cover.ts`.

Before committing a new or migrated post, pin a cover for each edition (`<id>` and `en/<id>`):

1. List candidates: `npm run cover -- <id>`.
2. When one block clearly shows the post's core, pin it: `npm run cover -- <id> <n>`.
   - Strong covers: a code block plus the output right after it (shown together as a back window), or a figure that draws the post's claim.
   - Small home cards show only the front window of a pair. If the front is a one-line command, the card looks empty: merge the command into the output window as its first line (`$ cmd`) and pin that window.
3. When two or more candidates are comparably good, show them with AskUserQuestion (number · kind · name · first line) and pin the one the user picks.

Done when every post in the commit shows `★ 지정한 표지` in the list, or prints `표지 후보가 없습니다`.
