import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
import Math from "@tiptap/extension-mathematics";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import { Subscript as BaseSubscript } from "@tiptap/extension-subscript";
import { Superscript as BaseSuperscript } from "@tiptap/extension-superscript";
import { Underline as BaseUnderline } from "@tiptap/extension-underline";
import Blockquote from "@tiptap/extension-blockquote";
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list";
import Heading from "@tiptap/extension-heading";
import { TextAlign as BaseTextAlign } from "@tiptap/extension-text-align";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import HardBreak from "@tiptap/extension-hard-break";
import { Highlight as BaseHighlight } from "@tiptap/extension-highlight";
import {
  markInputRule,
  markPasteRule,
  nodeInputRule,
  nodePasteRule,
  Node,
  mergeAttributes,
  Extension,
} from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";

const UnsetActiveMark = Extension.create({
  name: "unsetActiveMark",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-h": ({ editor }) => {
        console.log("works!!");
        return unsetActiveMarks(editor);
      },
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { empty, $from } = state.selection;

        if (!empty) return false;

        const nodeBefore = $from.nodeBefore;
        const parent = $from.parent;
        const isEmpty = parent.isTextblock && parent.content.size === 0;

        if (!isEmpty) return false;

        return unsetActiveMarks(editor);
      },
    };
  },
});

function unsetActiveMarks(editor) {
  const marksToUnset = [
    "bold",
    "italic",
    "strike",
    "code",
    "underline",
    "subscript",
    "superscript",
    "highlight",
  ];

  let didUnset = false;
  for (const mark of marksToUnset) {
    if (editor.isActive(mark)) {
      editor.commands.unsetMark(mark);
      didUnset = true;
    }
  }
  return didUnset;
}

const Subscript = BaseSubscript.extend({
  addInputRules() {
    return [
      markInputRule({
        find: /\_\{(.+?)\}$/,
        type: this.type,
      }),
      markPasteRule({
        find: /\_\{(.+?)\}/g,
        type: this.type,
      }),
    ];
  },
});

const Superscript = BaseSuperscript.extend({
  addInputRules() {
    return [
      markInputRule({
        find: /\^(.+?)\^$/,
        type: this.type,
      }),
      markPasteRule({
        find: /\^(.+?)\^/g,
        type: this.type,
      }),
    ];
  },
});

const Underline = BaseUnderline.extend({
  addInputRules() {
    return [
      markInputRule({
        find: /\>\>(.+?)\<\<$/,
        type: this.type,
      }),
      markPasteRule({
        find: /\>\>(.+?)\<\</g,
        type: this.type,
      }),
    ];
  },
});

const TextAlign = BaseTextAlign.extend({
  addInputRules() {
    const supportedTypes = ["paragraph", "heading"];
    const rules = [
      { regex: /^\=\>\s(.+)$/, align: "center" },
      { regex: /^\-\>\s(.+)$/, align: "left" },
      { regex: /^\<\-\s(.+)$/, align: "right" },
    ];

    return supportedTypes.flatMap((typeName) => {
      const type = this.editor.schema.nodes[typeName];
      if (!type) return [];

      return rules.map(({ regex, align }) =>
        nodeInputRule({
          find: regex,
          type,
          getAttributes: () => ({ textAlign: align }),
        }),
      );
    });
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        const node = $from.node();

        const isAligned = node.attrs?.textAlign && node.content.size === 0;

        if (isAligned) {
          editor.commands.updateAttributes(node.type.name, {
            textAlign: null,
          });
          return true;
        }

        return false;
      },
    };
  },
});

const EscapeChar = Node.create({
  name: "escapeChar",

  inline: true,
  group: "inline",
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      char: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-escape-char]",
        getAttrs: (el) => ({
          char: el.textContent?.[0] ?? "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-escape-char": "true" }),
      HTMLAttributes.char,
    ];
  },

  addInputRules() {
    return [
      {
        find: /\\(.)$/,
        handler: ({ match, chain, range }) => {
          return chain()
            .deleteRange(range)
            .insertContent({
              type: "escapeChar",
              attrs: {
                char: match[1],
              },
            })
            .run();
        },
      },
    ];
  },
});

const colors = ["red", "green", "blue", "rgb"];

const Highlight = BaseHighlight.extend({
  addAttributes() {
    return {
      color: {
        default: "red",
        parseHTML: (el) => el.getAttribute("data-color") || "red",
        renderHTML: (attrs) => ({
          "data-color": attrs.color,
          class: attrs.color,
        }),
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("colorToggle"),
        props: {
          handleClick(view, pos, event) {
            const { state, dispatch } = view;
            const { schema, doc } = state;
            const $pos = doc.resolve(pos);
            let found = null;
            doc.nodesBetween(pos, pos, (node, nodePos) => {
              if (!node.isText) return;
              return node.marks.forEach((mark) => {
                if (mark.type.name === "highlight") {
                  found = { mark, node, pos: nodePos };
                }
              });
            });

            if (!found) return false;
            const { mark, node, pos: markPos } = found;
            const currentColor = mark.attrs.color || "red";
            const nextColor =
              colors[(colors.indexOf(currentColor) + 1) % colors.length];
            const from = markPos;
            const to = markPos + node.nodeSize;
            const tr = state.tr
              .removeMark(from, to, schema.marks.highlight)
              .addMark(
                from,
                to,
                schema.marks.highlight.create({ color: nextColor }),
              );
            dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});

export {
  Document,
  Text,
  Paragraph,
  Bold,
  Code,
  CodeBlock,
  Math,
  Italic,
  Strike,
  Subscript,
  Superscript,
  Underline,
  Blockquote,
  BulletList,
  ListItem,
  OrderedList,
  Heading,
  TextAlign,
  HorizontalRule,
  EscapeChar,
  HardBreak,
  Highlight,
  UnsetActiveMark,
};
