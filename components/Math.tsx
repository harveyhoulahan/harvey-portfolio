import katex from "katex";

/** Inline or display math via KaTeX — Jupyter-style notation in prose. */
export default function Math({
  children,
  display = false,
}: {
  children: string;
  display?: boolean;
}) {
  const html = katex.renderToString(children, {
    displayMode: display,
    throwOnError: false,
    strict: "ignore",
  });

  return (
    <span
      className={display ? "my-4 block overflow-x-auto text-[1.05em]" : "mx-0.5"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
