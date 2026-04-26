import { Node, mergeAttributes } from "@tiptap/core";

export const Video = Node.create({
  name: "video",

  group: "block",

  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      height: {
        default: "200px",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: true,
        preload: "metadata",
        playsinline: true,
        style: `
          height:${HTMLAttributes.height};
          max-width:100%;
          border-radius:10px;
          margin:8px auto;
          display:block;
        `,
      }),
      ["source", { src: HTMLAttributes.src, type: "video/mp4" }],
    ];
  }
});